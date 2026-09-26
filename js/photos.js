// Photos des vêtements (demande de Théo, 2026-09-26) : vignettes JPEG (data URL) gardées dans IndexedDB, à part de
// l'état. localStorage (5 Mo environ) est partagé entre tous les sites de theomando.github.io : cent photos le
// rempliraient. Une base par espace de stockage (tests, démo), comme les clés de js/stockage.js.

import { PHOTO_COTE, PHOTO_QUALITE } from './constantes.js';

const MAGASIN = 'photos';

function attendreRequete(requete) {
  return new Promise((ok, ko) => {
    requete.onsuccess = () => ok(requete.result);
    requete.onerror = () => ko(requete.error);
  });
}

function attendreTransaction(transaction) {
  return new Promise((ok, ko) => {
    transaction.oncomplete = () => ok();
    transaction.onerror = () => ko(transaction.error);
    transaction.onabort = () => ko(transaction.error ?? new Error('transaction annulée'));
  });
}

// Renvoie { toutes, ecrire, supprimer, remplacerTout } ; chaque opération renvoie une promesse et échoue si
// IndexedDB est indisponible (navigation privée ancienne, stockage bloqué).
export function ouvrirPhotos(espace = '', idb = globalThis.indexedDB) {
  const nom = espace ? `garde-robe-${espace}` : 'garde-robe';
  let connexion = null;
  function base() {
    if (!idb) return Promise.reject(new Error('IndexedDB indisponible'));
    if (!connexion) {
      const demande = idb.open(nom, 1);
      demande.onupgradeneeded = () => { demande.result.createObjectStore(MAGASIN); };
      connexion = attendreRequete(demande);
      connexion.catch(() => { connexion = null; });
    }
    return connexion;
  }

  return {
    // Map id du vêtement → data URL.
    async toutes() {
      const db = await base();
      const transaction = db.transaction(MAGASIN, 'readonly');
      const magasin = transaction.objectStore(MAGASIN);
      const [cles, valeurs] = await Promise.all([attendreRequete(magasin.getAllKeys()), attendreRequete(magasin.getAll())]);
      return new Map(cles.map((cle, i) => [cle, valeurs[i]]));
    },
    async ecrire(id, photo) {
      const db = await base();
      const transaction = db.transaction(MAGASIN, 'readwrite');
      transaction.objectStore(MAGASIN).put(photo, id);
      await attendreTransaction(transaction);
    },
    async supprimer(id) {
      const db = await base();
      const transaction = db.transaction(MAGASIN, 'readwrite');
      transaction.objectStore(MAGASIN).delete(id);
      await attendreTransaction(transaction);
    },
    // Import : toutes les photos remplacées en une transaction (tout ou rien).
    async remplacerTout(photos) {
      const db = await base();
      const transaction = db.transaction(MAGASIN, 'readwrite');
      const magasin = transaction.objectStore(MAGASIN);
      magasin.clear();
      for (const [id, photo] of photos) magasin.put(photo, id);
      await attendreTransaction(transaction);
    },
  };
}

// Vignette carrée d'une photo (recadrée au centre, au plus PHOTO_COTE px de côté, jamais agrandie), en JPEG.
// Décodage par <img> : JPEG et HEIC sur iPhone, orientation EXIF appliquée au dessin.
export async function vignetteDepuisFichier(fichier, { cote = PHOTO_COTE, qualite = PHOTO_QUALITE } = {}) {
  const adresse = URL.createObjectURL(fichier);
  try {
    const image = new Image();
    image.src = adresse;
    await image.decode();
    const petit = Math.min(image.naturalWidth, image.naturalHeight);
    const taille = Math.max(1, Math.min(cote, petit));
    const canvas = document.createElement('canvas');
    canvas.width = taille;
    canvas.height = taille;
    const contexte = canvas.getContext('2d');
    contexte.drawImage(image, (image.naturalWidth - petit) / 2, (image.naturalHeight - petit) / 2, petit, petit, 0, 0, taille, taille);
    return canvas.toDataURL('image/jpeg', qualite);
  } finally {
    URL.revokeObjectURL(adresse);
  }
}
