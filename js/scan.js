// Caméra du scan : flux arrière, torche, verrouillage de la balance des blancs, mesure du carré central.
// Les dépendances (mediaDevices, document, minuterie) sont injectables : les tests utilisent des doublures.
//
// Pièges iOS pris en compte (CLAUDE.md, section Scan) : l'état de la torche est tenu par l'app
// (getSettings().torch était périmé sous iOS 18.0 à 18.3, WebKit bug 280970) ; chaque applyConstraints
// renvoie l'ensemble des contraintes voulues (un appel remplace les contraintes précédentes) ; la piste
// est arrêtée à la sortie et quand l'app passe en arrière-plan (la caméra y est interdite par iOS).

import { SCAN_DELAI_BALANCE_MS } from './constantes.js';
import { carreCentral, medianeSansReflets } from './mesure.js';

export class ErreurCamera extends Error {
  constructor(code, message) {
    super(message);
    this.code = code; // 'indisponible' | 'refus' | 'erreur'
  }
}

export function creerCamera({
  mediaDevices = globalThis.navigator?.mediaDevices,
  documentCible = globalThis.document,
  planifier = (ms, fn) => setTimeout(fn, ms),
  annuler = (id) => clearTimeout(id),
  surPerte = () => {},
} = {}) {
  let flux = null;
  let piste = null;
  let capacites = {};
  let torche = false;
  let balance = null; // null (jamais réglée), 'manual' (verrouillée) ou 'continuous'
  let minuterie = null;
  let arretee = false;

  const balanceVerrouillable = () => Array.isArray(capacites.whiteBalanceMode) && capacites.whiteBalanceMode.includes('manual');

  function contraintes() {
    const voulues = {};
    if (capacites.torch === true) voulues.torch = torche;
    if (balance) voulues.whiteBalanceMode = balance;
    return { advanced: [voulues] };
  }

  function surVisibilite() {
    if (documentCible.visibilityState === 'hidden' && !arretee) {
      arreter();
      surPerte('arriere-plan');
    }
  }

  function arreter() {
    if (arretee) return;
    arretee = true;
    if (minuterie !== null) annuler(minuterie);
    minuterie = null;
    documentCible?.removeEventListener?.('visibilitychange', surVisibilite);
    for (const p of flux?.getTracks?.() ?? []) p.stop();
    torche = false;
  }

  async function demarrer() {
    if (!mediaDevices?.getUserMedia) {
      throw new ErreurCamera('indisponible', 'La caméra n\'est pas accessible dans ce navigateur.');
    }
    try {
      flux = await mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
    } catch (erreur) {
      if (erreur?.name === 'NotAllowedError' || erreur?.name === 'SecurityError') {
        throw new ErreurCamera('refus', 'L\'accès à la caméra a été refusé.');
      }
      if (['NotFoundError', 'NotReadableError', 'OverconstrainedError', 'AbortError'].includes(erreur?.name)) {
        throw new ErreurCamera('indisponible', 'Aucune caméra utilisable n\'a été trouvée.');
      }
      throw new ErreurCamera('erreur', `Erreur de caméra : ${erreur?.message ?? erreur}`);
    }
    if (arretee) {
      for (const p of flux.getTracks()) p.stop();
      throw new ErreurCamera('erreur', 'Scan annulé.');
    }
    piste = flux.getVideoTracks()[0];
    piste.addEventListener?.('ended', () => {
      if (!arretee) {
        arreter();
        surPerte('fin');
      }
    });
    documentCible?.addEventListener?.('visibilitychange', surVisibilite);
    capacites = typeof piste.getCapabilities === 'function' ? (piste.getCapabilities() ?? {}) : {};
    return { flux, torcheDisponible: capacites.torch === true, balanceVerrouillable: balanceVerrouillable() };
  }

  // Allume ou éteint la torche ; renvoie l'état obtenu, tenu par l'app.
  async function reglerTorche(allumer) {
    if (capacites.torch !== true || !piste || arretee) return false;
    const avant = torche;
    torche = allumer;
    if (!allumer && balance === 'manual') balance = 'continuous';
    if (!allumer && minuterie !== null) { annuler(minuterie); minuterie = null; }
    try {
      await piste.applyConstraints(contraintes());
    } catch {
      torche = allumer ? false : avant;
      return torche;
    }
    if (allumer && balanceVerrouillable() && balance !== 'manual' && minuterie === null) {
      // L'image se stabilise sous la torche, puis on fige la balance des blancs.
      minuterie = planifier(SCAN_DELAI_BALANCE_MS, async () => {
        minuterie = null;
        if (arretee || !torche) return;
        balance = 'manual';
        try {
          await piste.applyConstraints(contraintes());
        } catch {
          balance = null;
        }
      });
    }
    return torche;
  }

  return {
    demarrer,
    reglerTorche,
    arreter,
    etat: () => ({ torche, balance, arretee }),
  };
}

// Lit le carré central d'une source dessinable (vidéo, image) et renvoie ses pixels sRGB.
export function lireCarreCentral(source, largeur, hauteur, canvas = document.createElement('canvas')) {
  const { x, y, cote } = carreCentral(largeur, hauteur);
  canvas.width = cote;
  canvas.height = cote;
  const contexte = canvas.getContext('2d', { colorSpace: 'srgb', willReadFrequently: true });
  contexte.drawImage(source, x, y, cote, cote, 0, 0, cote, cote);
  return contexte.getImageData(0, 0, cote, cote, { colorSpace: 'srgb' }).data;
}

export function mesurerSource(source, largeur, hauteur, canvas) {
  if (!largeur || !hauteur) return { erreur: 'vide', valides: 0, total: 0 };
  return medianeSansReflets(lireCarreCentral(source, largeur, hauteur, canvas));
}

// Mesure une photo (repli sans caméra en direct). Renvoie { mesure, apercu } : apercu est une vignette
// de la photo où le carré mesuré est tracé, pour que l'utilisateur vérifie ce qui a été mesuré.
// Décodage par un élément <img> : JPEG et HEIC (Safari 17+), orientation EXIF appliquée au dessin
// (image-orientation: from-image par défaut). createImageBitmap ne se termine jamais dans Edge sans
// fenêtre en temps virtuel (constaté le 2026-09-26) : <img> garde le vrai chemin testable.
export async function mesurerPhoto(fichier, { tailleApercu = 240 } = {}) {
  const adresse = URL.createObjectURL(fichier);
  try {
    const image = new Image();
    image.src = adresse;
    await image.decode();
    const largeur = image.naturalWidth;
    const hauteur = image.naturalHeight;
    const mesure = mesurerSource(image, largeur, hauteur);
    const echelle = Math.min(1, tailleApercu / Math.max(largeur, hauteur));
    const apercu = document.createElement('canvas');
    apercu.width = Math.max(1, Math.round(largeur * echelle));
    apercu.height = Math.max(1, Math.round(hauteur * echelle));
    const contexte = apercu.getContext('2d');
    contexte.drawImage(image, 0, 0, apercu.width, apercu.height);
    const { x, y, cote } = carreCentral(largeur, hauteur);
    contexte.lineWidth = 3;
    contexte.strokeStyle = '#000000';
    contexte.strokeRect(x * echelle - 2, y * echelle - 2, cote * echelle + 4, cote * echelle + 4);
    contexte.lineWidth = 1.5;
    contexte.strokeStyle = '#ffffff';
    contexte.strokeRect(x * echelle - 2, y * echelle - 2, cote * echelle + 4, cote * echelle + 4);
    return { mesure, apercu };
  } finally {
    URL.revokeObjectURL(adresse);
  }
}
