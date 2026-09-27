// Mesure tout-en-un, façon appareil photo de l'iPhone (demande de Théo, 2026-09-26) : caméra plein écran, réticule,
// couleur visée en direct, torche et fermeture en haut, déclencheur rond en bas (photo à gauche, aide à droite).
// Après la mesure, l'image se fige et une feuille monte du bas avec tout le reste, sans défilement : couleur mesurée,
// ajustement d'un toucher (proches ou noir, gris, blanc, ou tout le catalogue), type de vêtement, Enregistrer.

import { el, pastille, terminaison, armerDialogue, rearmerDialogue, choisirImage, boutonRond, tuile } from '../ui.js';
import { icone } from '../icones.js';
import {
  TYPES, LIBELLES_TYPES, SCAN_DELAI_SANS_IMAGE_MS, SCAN_APERCU_MS, NEUTRE_C_MAX,
  SCAN_IMAGES_PAR_MESURE, SCAN_INTERVALLE_IMAGES_MS, SCAN_STABLE_FENETRE,
} from '../constantes.js';
import { rgbVersHex, labDepuisHex, deltaE00, chroma } from '../couleur.js';
import { carreCentral, combinerMesures, viseeStable } from '../mesure.js';
import { plusProches } from '../catalogue.js';
import { creerCamera, ErreurCamera, mesurerSource, mesurerPhoto } from '../scan.js';
import { ouvrirSelecteur } from './selecteur-catalogue.js';
import { champMarque, choisirPhoto, proposerPhoto } from './fiche-vetement.js';

const MESSAGES_MESURE = {
  reflet: 'Reflet trop fort : incline un peu le vêtement ou éloigne le téléphone, puis recommence.',
  vide: 'Aucune image à mesurer : attends que la caméra affiche le vêtement.',
};

const ecartTexte = (ecart) => `ΔE ${ecart.toFixed(1).replace('.', ',')}`;

function attendreImage(video, delai) {
  return new Promise((resoudre) => {
    if (video.videoWidth > 0 && video.readyState >= 2) { resoudre(true); return; }
    let minuterie = null;
    const fin = (ok) => {
      clearTimeout(minuterie);
      video.removeEventListener('loadeddata', surDonnees);
      resoudre(ok);
    };
    const surDonnees = () => { if (video.videoWidth > 0) fin(true); };
    minuterie = setTimeout(() => fin(video.videoWidth > 0), delai);
    video.addEventListener('loadeddata', surDonnees);
  });
}

const CONSIGNE_COURTE = 'Vise le vêtement à plat, à 10 à 20 cm.';
const AIDE_SCAN = [
  'Place le vêtement bien à plat dans le carré, à 10 à 20 cm, puis touche le déclencheur.',
  'Un vêtement très sombre ou très clair : pose-le sur un fond neutre (drap, feuille blanche) sans remplir tout l\'écran.',
  'La torche s\'allume seule si l\'iPhone en a une ; l\'éclair en haut à droite l\'éteint.',
  'Pas de caméra ? Le bouton photo, en bas à gauche, ouvre l\'appareil photo (avec flash).',
];

// Ouvre la caméra plein écran. Après une mesure { rgb (brute), source: 'camera' | 'photo', mode: 'torche' |
// 'sans-torche' | 'photo' }, resultat(mesure, feuille, { valider, recommencer }) remplit la feuille du bas ;
// valider(valeur) ferme et renvoie valeur, recommencer() relance la caméra. Sans resultat : « Utiliser cette mesure »
// renvoie la mesure (étalonnage). corriger(rgb, mode) sert à l'affichage en direct (étalonnage) ; consigne : une ligne.
// Renvoie null si l'utilisateur ferme.
export function ouvrirScan({ mediaDevices, titre = 'Mesurer une couleur', consigne = CONSIGNE_COURTE, astuce = null, corriger = null, resultat = resultatSimple } = {}) {
  return new Promise((resoudre) => {
    let camera = null;
    let intervalle = null;
    const canvas = document.createElement('canvas');

    const video = el('video', { class: 'scan-video', playsinline: true, muted: true, autoplay: true, 'aria-label': 'Image de la caméra' });
    video.muted = true; // propriété et attribut : lecture automatique inline sur iOS
    const figee = el('canvas', { class: 'image-figee', hidden: true, 'aria-hidden': 'true' });
    const photoFigee = el('img', { class: 'image-figee', hidden: true, alt: '' });
    const reticule = el('div', { class: 'reticule', 'aria-hidden': 'true', hidden: true });
    const direct = el('span', { class: 'pastille', 'aria-hidden': 'true' });
    const texteDirect = el('span', { class: 'texte-direct' }, '—');
    const etiquetteStable = el('span', { class: 'etiquette-stable' }, 'stable');
    const capsuleDirect = el('div', { class: 'scan-direct', hidden: true }, direct, texteDirect, etiquetteStable);
    let historique = []; // dernières mesures en direct (Lab), pour l'indicateur « stable »
    let mesureEnCours = false;
    const etat = el('p', { class: 'etat-scan', role: 'status' }, 'Ouverture de la caméra…');
    const boutonTorche = boutonRond({ icone: 'eclair', libelle: 'Torche', action: 'torche' });
    boutonTorche.hidden = true;
    boutonTorche.setAttribute('aria-pressed', 'false');
    const mesurer = el('button', { type: 'button', class: 'declencheur', disabled: true, 'data-action': 'mesurer', 'aria-label': 'Mesurer' });
    const relancer = el('button', { type: 'button', class: 'bouton petit relancer', hidden: true, 'data-action': 'relancer' }, 'Relancer la caméra');
    const photo = boutonRond({ icone: 'photo', libelle: 'Prendre une photo (avec flash)', action: 'photo' });
    const panneauAide = el('div', { class: 'aide-scan', hidden: true, id: 'aide-scan' },
      el('ul', {}, AIDE_SCAN.map((ligne) => el('li', {}, ligne))), astuce ? el('p', {}, astuce) : null);
    const aide = boutonRond({
      icone: 'aide', libelle: 'Aide', action: 'aide',
      onclick: () => { panneauAide.hidden = !panneauAide.hidden; aide.setAttribute('aria-expanded', String(!panneauAide.hidden)); },
    });
    aide.setAttribute('aria-controls', 'aide-scan');
    const feuille = el('div', { class: 'feuille-resultat', hidden: true, role: 'region', 'aria-label': 'Résultat de la mesure' });
    let suite = null; // mesure attendue pour une couleur de plus (vêtement multicolore)
    let imageAvant = null; // image figée de la mesure précédente, remontrée par « Retour à la fiche »
    const retourFeuille = el('button', { type: 'button', class: 'bouton petit relancer', hidden: true, 'data-action': 'retour-feuille' }, 'Retour à la fiche');

    const dialogue = el('dialog', { class: 'dialogue scan', 'aria-labelledby': 'titre-scan' },
      video, figee, photoFigee, reticule, capsuleDirect,
      el('header', { class: 'scan-haut' },
        boutonRond({ icone: 'fermer', libelle: 'Fermer', action: 'annuler-scan', onclick: () => terminer(null) }),
        el('h2', { id: 'titre-scan', tabindex: '-1', autofocus: true }, titre),
        boutonTorche),
      astuce ? el('p', { class: 'astuce-scan' }, astuce) : null,
      panneauAide,
      el('div', { class: 'scan-bas' },
        etat, relancer, retourFeuille,
        el('div', { class: 'commandes-scan' }, photo, mesurer, aide)),
      feuille);

    const terminer = terminaison(dialogue, (valeur) => { nettoyer(); resoudre(valeur); });

    function nettoyer() {
      clearInterval(intervalle);
      intervalle = null;
      camera?.arreter();
      video.srcObject = null;
      if (photoFigee.src) URL.revokeObjectURL(photoFigee.src);
      window.removeEventListener('resize', placerReticule);
    }

    // Le réticule couvre exactement la zone mesurée (vidéo affichée en object-fit: cover, centrée).
    function placerReticule() {
      const { videoWidth: vw, videoHeight: vh } = video;
      if (!vw || !vh) return;
      const echelle = Math.max(video.clientWidth / vw, video.clientHeight / vh);
      const cote = carreCentral(vw, vh).cote * echelle;
      reticule.style.width = `${cote}px`;
      reticule.style.height = `${cote}px`;
      dialogue.style.setProperty('--demi-reticule', `${cote / 2}px`);
      reticule.hidden = false;
    }

    function afficherTorche() {
      const { torche } = camera.etat();
      boutonTorche.replaceChildren(icone(torche ? 'eclair-plein' : 'eclair'));
      boutonTorche.setAttribute('aria-pressed', String(torche));
      boutonTorche.setAttribute('aria-label', torche ? 'Torche allumée' : 'Torche éteinte');
    }

    // Façon de mesurer, dont dépend l'étalonnage : l'exposition diffère avec ou sans torche.
    const modeCourant = () => (camera?.etat().torche ? 'torche' : 'sans-torche');

    function apercu() {
      if (mesureEnCours) return;
      const mesure = mesurerSource(video, video.videoWidth, video.videoHeight, canvas);
      const rgb = mesure.rgb && corriger ? corriger(mesure.rgb, modeCourant()) : mesure.rgb;
      direct.style.backgroundColor = rgb ? rgbVersHex(rgb) : '';
      texteDirect.textContent = rgb ? rgbVersHex(rgb) : (mesure.erreur === 'reflet' ? 'reflet' : '—');
      historique = rgb ? [...historique, labDepuisHex(rgbVersHex(rgb))].slice(-SCAN_STABLE_FENETRE) : [];
      capsuleDirect.classList.toggle('stable', historique.length === SCAN_STABLE_FENETRE && viseeStable(historique));
    }

    function surPerte(raison) {
      clearInterval(intervalle);
      mesurer.disabled = true;
      relancer.hidden = false;
      boutonTorche.hidden = true;
      etat.textContent = raison === 'arriere-plan'
        ? 'Caméra arrêtée quand l\'app est passée en arrière-plan.'
        : 'La caméra s\'est arrêtée.';
    }

    async function lancer() {
      camera?.arreter();
      clearInterval(intervalle);
      delete dialogue.dataset.etape;
      feuille.hidden = true;
      figee.hidden = true;
      photoFigee.hidden = true;
      mesurer.disabled = true;
      relancer.hidden = true;
      boutonTorche.hidden = true;
      reticule.hidden = true;
      capsuleDirect.hidden = true;
      etat.textContent = suite ? 'Vise la couleur suivante du vêtement.' : 'Ouverture de la caméra…';
      retourFeuille.hidden = !suite;
      historique = [];
      capsuleDirect.classList.remove('stable');
      const courante = creerCamera({ mediaDevices, surPerte });
      camera = courante;
      try {
        const info = await courante.demarrer();
        if (camera !== courante || !dialogue.isConnected) { courante.arreter(); return; }
        video.srcObject = info.flux;
        video.play().catch(() => {});
        const image = await attendreImage(video, SCAN_DELAI_SANS_IMAGE_MS);
        if (camera !== courante || !dialogue.isConnected) return;
        if (!image) {
          etat.textContent = 'La caméra ne renvoie pas d\'image. Relance-la ou prends une photo.';
          relancer.hidden = false;
          return;
        }
        placerReticule();
        capsuleDirect.hidden = false;
        mesurer.disabled = false;
        intervalle = setInterval(apercu, SCAN_APERCU_MS);
        if (info.torcheDisponible) {
          boutonTorche.hidden = false;
          const allumee = await courante.reglerTorche(true);
          afficherTorche();
          etat.textContent = allumee ? consigne
            : 'La torche n\'a pas pu s\'allumer : mesure à la lumière ambiante, ou prends une photo avec flash.';
        } else {
          etat.textContent = `${consigne} Pas de torche : lumière ambiante, ou photo avec flash.`;
        }
      } catch (erreur) {
        if (camera !== courante || !dialogue.isConnected) return;
        const message = erreur instanceof ErreurCamera ? erreur.message : 'Caméra indisponible.';
        etat.textContent = `${message} Prends une photo avec le bouton en bas à gauche.`;
        relancer.hidden = !(erreur instanceof ErreurCamera && erreur.code === 'indisponible');
      }
    }

    // Image figée, caméra coupée (torche éteinte), puis feuille du résultat.
    // « Autre couleur » (vêtement multicolore) : la caméra repart ; la mesure suivante va à suite() et la feuille,
    // gardée telle quelle, réapparaît avec la nouvelle couleur.
    function afficherResultat(mesure) {
      clearInterval(intervalle);
      camera?.arreter();
      reticule.hidden = true;
      capsuleDirect.hidden = true;
      panneauAide.hidden = true;
      retourFeuille.hidden = true;
      dialogue.dataset.etape = 'resultat';
      feuille.dataset.images = String(mesure.images ?? 1);
      feuille.hidden = false;
      if (suite) {
        const rappel = suite;
        suite = null;
        rappel(mesure);
      } else {
        feuille.replaceChildren();
        resultat(mesure, feuille, {
          valider: (valeur) => terminer(valeur),
          recommencer: () => { suite = null; lancer(); },
          mesurerAutre: (rappel) => {
            suite = rappel;
            imageAvant = [figee, photoFigee].find((image) => !image.hidden) ?? null;
            lancer();
          },
        });
        feuille.scrollTop = 0;
      }
      rearmerDialogue(dialogue); // nouveaux boutons sous le doigt : anti double tape
    }

    // Retour à la feuille sans mesurer (après « Autre couleur »).
    retourFeuille.addEventListener('click', () => {
      suite = null;
      camera?.arreter();
      clearInterval(intervalle);
      reticule.hidden = true;
      capsuleDirect.hidden = true;
      retourFeuille.hidden = true;
      if (imageAvant) imageAvant.hidden = false;
      dialogue.dataset.etape = 'resultat';
      feuille.hidden = false;
      rearmerDialogue(dialogue);
    });

    boutonTorche.addEventListener('click', async () => {
      boutonTorche.disabled = true;
      const voulu = !camera.etat().torche;
      const obtenu = await camera.reglerTorche(voulu);
      boutonTorche.disabled = false;
      afficherTorche();
      if (obtenu !== voulu) etat.textContent = voulu ? 'La torche n\'a pas pu s\'allumer (surchauffe ?).' : 'La torche n\'a pas pu s\'éteindre.';
    });

    // Mesure stable : SCAN_IMAGES_PAR_MESURE images en une seconde environ, combinées par médiane (js/mesure.js).
    mesurer.addEventListener('click', async () => {
      if (mesureEnCours) return;
      mesureEnCours = true;
      const courante = camera;
      const consigneAvant = etat.textContent;
      mesurer.disabled = true;
      mesurer.classList.add('en-cours');
      etat.textContent = 'Mesure en cours : ne bouge pas…';
      const mesures = [];
      for (let i = 0; i < SCAN_IMAGES_PAR_MESURE; i++) {
        if (i > 0) await new Promise((suite) => { setTimeout(suite, SCAN_INTERVALLE_IMAGES_MS); });
        if (camera !== courante || !dialogue.isConnected) { mesureEnCours = false; return; }
        mesures.push(mesurerSource(video, video.videoWidth, video.videoHeight, canvas));
      }
      mesureEnCours = false;
      mesurer.classList.remove('en-cours');
      const mesure = combinerMesures(mesures);
      if (mesure.erreur) {
        mesurer.disabled = false;
        etat.textContent = MESSAGES_MESURE[mesure.erreur] ?? consigneAvant;
        return;
      }
      const mode = modeCourant();
      figee.width = video.videoWidth;
      figee.height = video.videoHeight;
      figee.getContext('2d').drawImage(video, 0, 0);
      figee.hidden = false;
      etat.textContent = consigneAvant;
      afficherResultat({ rgb: mesure.rgb, source: 'camera', mode, images: mesure.images });
    });

    relancer.addEventListener('click', () => lancer());

    photo.addEventListener('click', async () => {
      const promesse = choisirImage(); // pendant le geste : iOS ouvre l'appareil photo
      // Une seule capture à la fois sur iOS : on libère la caméra pour l'appareil photo.
      camera?.arreter();
      clearInterval(intervalle);
      mesurer.disabled = true;
      const fichier = await promesse;
      if (!dialogue.isConnected) return;
      if (!fichier) {
        etat.textContent = 'Aucune photo prise.';
        relancer.hidden = false;
        return;
      }
      try {
        const { mesure } = await mesurerPhoto(fichier);
        if (mesure.erreur) {
          etat.textContent = MESSAGES_MESURE[mesure.erreur];
          relancer.hidden = false;
          return;
        }
        if (photoFigee.src) URL.revokeObjectURL(photoFigee.src);
        photoFigee.src = URL.createObjectURL(fichier);
        photoFigee.hidden = false;
        afficherResultat({ rgb: mesure.rgb, source: 'photo', mode: 'photo' });
      } catch {
        etat.textContent = 'Impossible de lire cette photo. Réessaie, ou choisis la couleur dans le catalogue.';
        relancer.hidden = false;
      }
    });

    video.addEventListener('resize', placerReticule);
    window.addEventListener('resize', placerReticule);
    document.body.append(dialogue);
    armerDialogue(dialogue);
    dialogue.showModal();
    lancer();
  });
}

// Feuille par défaut (étalonnage) : couleur mesurée, « Recommencer » ou « Utiliser cette mesure ».
function resultatSimple(mesure, feuille, { valider, recommencer }) {
  const hex = rgbVersHex(mesure.rgb);
  feuille.append(
    el('div', { class: 'poignee', 'aria-hidden': 'true' }),
    el('div', { class: 'resultat-entete' }, pastille(hex, { classe: 'resultat-pastille' }),
      el('div', { class: 'infos' }, el('strong', {}, 'Couleur mesurée'), el('span', { class: 'discret' }, hex))),
    el('div', { class: 'boutons-resultat' },
      el('button', { type: 'button', class: 'bouton', 'data-action': 'recommencer', onclick: recommencer }, 'Recommencer'),
      el('button', { type: 'button', class: 'bouton principal', 'data-action': 'utiliser-mesure', onclick: () => valider(mesure) }, 'Utiliser cette mesure')));
}

// Feuille du résultat pour un vêtement : tout sur un écran. mesure : { rgb (corrigée si étalonnage), brut? }.
// Vêtement multicolore (demande de Théo, 2026-09-27) : « Autre couleur » relance la caméra pour mesurer la couleur
// suivante (3 au plus) ; chaque couleur s'ajuste d'un toucher comme la première (pastille active).
// valider({ type, couleurs: [{ hex, couleur }], hex, couleur, marque, photo }) : couleurs[0] est la principale ;
// couleur = couleur du catalogue retenue (null = couleur mesurée) ; marque et photo (vignette) facultatives.
// options.corrigerMesure : correction d'étalonnage des mesures suivantes (la première arrive déjà corrigée).
export function remplirResultatVetement(app, actions, mesure, feuille, { valider, recommencer, mesurerAutre }, { typeImpose = null, corrigerMesure = (m) => m } = {}) {
  // L'exposition automatique de l'iPhone fausse surtout les noirs, gris et blancs (un noir remonte vers le gris,
  // la torche le bleuit) : les neutres du catalogue restent à un toucher, du plus foncé au plus clair.
  const neutresCatalogue = app.catalogue.couleurs.filter((c) => chroma(c.lab) <= NEUTRE_C_MAX).sort((x, y) => x.lab.L - y.lab.L);
  function entree(m) {
    const hexMesure = rgbVersHex(m.rgb);
    const labMesure = labDepuisHex(hexMesure);
    return {
      hexMesure, labMesure, brut: m.brut ?? null, couleur: null,
      proches: plusProches(labMesure, app.catalogue, 12),
      neutres: neutresCatalogue.map((c) => ({ couleur: c, ecart: deltaE00(labMesure, c.lab) })),
    };
  }
  const couleurs = [entree(mesure)];
  let actif = 0;
  let type = typeImpose;
  let onglet = 'proches';
  let photo = null;
  let photoProposee = false;
  const courante = () => couleurs[actif];
  const hexFinal = (c) => c.couleur?.hex ?? c.hexMesure;
  const montrerPhoto = (choisie) => {
    boutonPhoto.replaceChildren(el('img', { src: choisie, alt: '' }));
    boutonPhoto.classList.add('avec-photo');
  };
  const [champ, suggestions] = champMarque(app, '', { classe: 'champ champ-marque', placeholder: 'Marque (facultatif)' });
  const boutonPhoto = el('button', {
    type: 'button', class: 'bouton-photo', 'data-action': 'photo-resultat', 'aria-label': 'Photo du vêtement (facultatif)',
    onclick: async () => {
      const choisie = await choisirPhoto();
      if (!choisie) return;
      photo = choisie;
      montrerPhoto(choisie);
    },
  }, icone('camera'));

  const pastilleEntete = pastille(hexFinal(courante()), { classe: 'resultat-pastille' });
  const nomEntete = el('strong', {});
  const detailEntete = el('span', { class: 'discret' });
  const noteEtalonnage = el('p', { class: 'note-resultat', 'data-info': 'etalonnage' });
  const puces = el('div', { class: 'puces-couleurs', role: 'group', 'aria-label': 'Couleurs du vêtement' });
  const rangee = el('div', { class: 'rangee-choix', role: 'listbox', 'aria-label': 'Couleur retenue' });
  const enregistrer = el('button', {
    type: 'button', class: 'bouton principal', 'data-action': 'enregistrer-scan',
    // Sans photo : on la propose une fois (plus simple pour retrouver le vêtement), puis on enregistre.
    onclick: async () => {
      if (!photo && !photoProposee) {
        photoProposee = true;
        const choisie = await proposerPhoto();
        if (choisie) { photo = choisie; montrerPhoto(choisie); }
      }
      const liste = couleurs.map((c) => ({ hex: hexFinal(c), couleur: c.couleur }));
      valider({ type, couleurs: liste, hex: liste[0].hex, couleur: liste[0].couleur, marque: champ.value, photo });
    },
  }, 'Enregistrer');

  // Une pastille par couleur (touchée : c'est elle qui s'ajuste), ✕ en coin pour une couleur secondaire, puis
  // « Autre couleur ».
  function majPuces() {
    puces.replaceChildren(el('span', { class: 'etiquette-puces' }, 'Couleurs'), ...couleurs.map((c, i) => el('span', { class: 'couleur-mesure' },
      el('button', {
        type: 'button', class: 'puce-couleur', 'data-index': i, 'aria-pressed': String(i === actif),
        'aria-label': i === 0 ? 'Couleur principale' : `Couleur ${i + 1}`,
        onclick: () => { actif = i; remplirRangee(); },
      }, pastille(hexFinal(c))),
      ...(i > 0 ? [el('button', {
        type: 'button', class: 'retirer-puce', 'data-action': 'retirer-couleur-mesure', 'data-index': i, 'aria-label': `Retirer la couleur ${i + 1}`,
        onclick: () => { couleurs.splice(i, 1); if (actif >= i) actif -= 1; remplirRangee(); },
      }, icone('fermer'))] : []))),
    ...(couleurs.length < 3 && mesurerAutre ? [el('button', {
      type: 'button', class: 'ajouter-puce', 'data-action': 'ajouter-couleur-mesure', 'aria-label': 'Mesurer une autre couleur du vêtement',
      onclick: () => mesurerAutre((suivante) => {
        couleurs.push(entree(corrigerMesure(suivante)));
        actif = couleurs.length - 1;
        remplirRangee();
      }),
    }, icone('plus'), 'Autre couleur')] : []));
  }

  function majEntete() {
    const c = courante();
    pastilleEntete.style.backgroundColor = hexFinal(c);
    nomEntete.textContent = c.couleur ? c.couleur.nom : (couleurs.length > 1 ? `Couleur mesurée ${actif + 1}` : 'Couleur mesurée');
    detailEntete.textContent = c.couleur
      ? `${c.couleur.hex}, au lieu de la mesure ${c.hexMesure}`
      : `${c.hexMesure} · la plus proche : ${c.proches[0].couleur.nom} (${ecartTexte(c.proches[0].ecart)})`;
    noteEtalonnage.hidden = !c.brut;
    noteEtalonnage.textContent = c.brut ? `Corrigée par l'étalonnage (mesure brute ${rgbVersHex(c.brut)}).` : '';
    for (const carte of rangee.querySelectorAll('[data-couleur]')) {
      carte.setAttribute('aria-selected', String(carte.dataset.couleur === (c.couleur?.id ?? 'mesure')));
    }
    majPuces();
    enregistrer.disabled = type === null;
  }

  const carte = (id, hex, nom, detail, onclick, classe = '') => el('button', {
    type: 'button', class: `carte-choix ${classe}`.trim(), role: 'option', 'data-couleur': id, 'aria-selected': 'false', onclick,
  }, pastille(hex, { classe: 'grande' }), el('span', { class: 'nom' }, nom), el('span', { class: 'detail' }, detail));

  function remplirRangee() {
    const c = courante();
    const liste = onglet === 'proches' ? c.proches : c.neutres;
    rangee.replaceChildren(
      carte('mesure', c.hexMesure, 'Mesure', c.hexMesure, () => { courante().couleur = null; majEntete(); }, 'mesure'),
      ...liste.map(({ couleur: choix, ecart }) => carte(choix.id, choix.hex, choix.nom, ecartTexte(ecart), () => { courante().couleur = choix; majEntete(); })),
      el('button', {
        type: 'button', class: 'carte-choix tout', 'data-action': 'tout-catalogue',
        onclick: async () => {
          const choisie = await ouvrirSelecteur({
            catalogue: app.catalogue, titre: 'Couleur la plus juste', reference: courante().labMesure, ...actions.favorisPourSelecteur(),
          });
          if (choisie) { courante().couleur = choisie; majEntete(); }
        },
      }, icone('mosaique'), el('span', { class: 'nom' }, 'Tout le catalogue')));
    rangee.scrollLeft = 0;
    majEntete();
  }

  const segments = el('div', { class: 'segments', role: 'group', 'aria-label': 'Couleurs proposées' },
    [['proches', 'Les plus proches'], ['neutres', 'Noir, gris, blanc']].map(([valeur, libelle]) => el('button', {
      type: 'button', class: 'segment', 'data-segment': valeur, 'aria-pressed': String(valeur === onglet),
      onclick: (evenement) => {
        onglet = valeur;
        for (const b of segments.children) b.setAttribute('aria-pressed', String(b === evenement.currentTarget));
        remplirRangee();
      },
    }, libelle)));

  const grilleTypes = el('div', { class: 'grille-types-scan', role: 'group', 'aria-label': 'Type de vêtement' },
    TYPES.filter((t) => t !== 'bijoux').map((t) => tuile({
      icone: t, libelle: LIBELLES_TYPES[t], 'data-type': t, 'aria-pressed': String(t === type),
      onclick: (evenement) => {
        type = t;
        for (const b of grilleTypes.children) b.setAttribute('aria-pressed', String(b === evenement.currentTarget));
        majEntete();
      },
    })));

  feuille.append(
    el('div', { class: 'poignee', 'aria-hidden': 'true' }),
    el('div', { class: 'resultat-entete' }, pastilleEntete, el('div', { class: 'infos' }, nomEntete, detailEntete)),
    puces,
    noteEtalonnage,
    el('p', { class: 'etiquette-resultat' }, 'Plus juste ? Touche une couleur'),
    segments, rangee,
    el('p', { class: 'etiquette-resultat' }, 'Type de vêtement'),
    grilleTypes,
    el('div', { class: 'ligne-marque-photo' }, champ, suggestions, boutonPhoto),
    el('div', { class: 'boutons-resultat' },
      el('button', { type: 'button', class: 'bouton', 'data-action': 'recommencer', onclick: recommencer }, 'Recommencer'),
      enregistrer));
  remplirRangee();
}
