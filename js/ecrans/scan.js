// Mesure tout-en-un, façon appareil photo de l'iPhone (demande de Théo, 2026-09-26) : caméra plein écran, réticule,
// couleur visée en direct, torche et fermeture en haut, déclencheur rond en bas (photo à gauche, aide à droite).
// Photo (photothèque ou appareil photo) : elle s'affiche en entier avec un pointeur par couleur du vêtement, à poser
// sur le vêtement (demande de Théo, 2026-09-27) ; le déclencheur mesure alors sous chaque pointeur.
// Après la mesure, l'image se fige et une feuille monte du bas avec tout le reste, sans défilement : couleur mesurée,
// ajustement d'un toucher (proches ou noir, gris, blanc, ou tout le catalogue), type de vêtement, Enregistrer.

import { el, pastille, terminaison, armerDialogue, rearmerDialogue, choisirImage, boutonRond, tuile } from '../ui.js';
import { icone } from '../icones.js';
import {
  TYPES, LIBELLES_TYPES, SCAN_DELAI_SANS_IMAGE_MS, SCAN_APERCU_MS, NEUTRE_C_MAX,
  SCAN_IMAGES_PAR_MESURE, SCAN_INTERVALLE_IMAGES_MS, SCAN_STABLE_FENETRE, SCAN_FRACTION_POINTEUR, POINTEURS_MAX,
} from '../constantes.js';
import { rgbVersHex, labDepuisHex, deltaE00, chroma } from '../couleur.js';
import { carreCentral, combinerMesures, viseeStable } from '../mesure.js';
import { plusProches } from '../catalogue.js';
import { creerCamera, ErreurCamera, mesurerSource, preparerPhoto, mesurerPoint } from '../scan.js';
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
  'Le bouton photo, en bas à gauche, mesure une photo de la photothèque, ou une photo prise avec l\'appareil photo (avec flash).',
  'Sur une photo, pose un pointeur sur chaque couleur du vêtement (un toucher, ou fais-le glisser), puis touche le déclencheur.',
];

// Places des pointeurs ajoutés sur une photo (de 0 à 1), avant que l'utilisateur les déplace.
const PLACES_POINTEURS = [{ x: 0.5, y: 0.5 }, { x: 0.35, y: 0.5 }, { x: 0.65, y: 0.5 }];

// Ouvre la caméra plein écran. Après une mesure { rgb (brute), source: 'camera' | 'photo', mode: 'torche' |
// 'sans-torche' | 'photo', autres? (couleurs des pointeurs suivants, même forme) }, resultat(mesure, feuille,
// { valider, recommencer, mesurerAutre }) remplit la feuille du bas ; valider(valeur) ferme et renvoie valeur,
// recommencer() revient à la caméra (ou aux pointeurs de la photo) ; mesurerAutre(rappel, restantes) mesure une
// couleur de plus (restantes pointeurs au plus sur une photo) et la passe à rappel. Sans resultat : « Utiliser cette mesure »
// renvoie la mesure (étalonnage). corriger(rgb, mode) sert à l'affichage en direct (étalonnage) ; consigne : une ligne.
// mode (étalonnage, une façon de mesurer à la fois) : 'torche' (torche allumée, sans bascule), 'sans-torche' (jamais
// allumée) ou 'photo' (pas de caméra : le déclencheur ouvre l'appareil photo, puis un seul pointeur) ; null : au choix
// de l'utilisateur.
// Renvoie null si l'utilisateur ferme.
export function ouvrirScan({ mediaDevices, titre = 'Mesurer une couleur', consigne = CONSIGNE_COURTE, astuce = null, corriger = null, resultat = resultatSimple, mode = null } = {}) {
  return new Promise((resoudre) => {
    let camera = null;
    let intervalle = null;
    const canvas = document.createElement('canvas');

    const video = el('video', { class: 'scan-video', playsinline: true, muted: true, autoplay: true, 'aria-label': 'Image de la caméra' });
    video.muted = true; // propriété et attribut : lecture automatique inline sur iOS
    const figee = el('canvas', { class: 'image-figee', hidden: true, 'aria-hidden': 'true' });
    // Photo et pointeurs : la photo entière entre l'en-tête et les commandes ; un pointeur par couleur (POINTEURS_MAX
    // au plus, un seul pour l'étalonnage), déplacé d'un toucher ou en le faisant glisser.
    const imagePlacement = el('img', { class: 'photo-placement', alt: 'Photo à mesurer' });
    const calque = el('div', { class: 'calque-pointeurs' });
    const placement = el('div', { class: 'placement', hidden: true, 'data-action': 'placer-pointeur' }, imagePlacement, calque);
    const barrePointeurs = el('div', { class: 'barre-pointeurs', hidden: true, role: 'group', 'aria-label': 'Pointeurs' });
    let photoCourante = null; // { adresse, largeur, hauteur, pixels } (js/scan.js, preparerPhoto)
    let pointeurs = []; // [{ x, y }] de 0 à 1 dans la photo
    let actif = 0;
    let pointeursMax = 1;
    let restantesSuite = 1; // pointeurs permis pour « Autre couleur » (couleurs restantes du vêtement)
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
    const photo = boutonRond({ icone: 'photo', libelle: 'Mesurer une photo (photothèque ou appareil photo)', action: 'photo' });
    // Façon de mesurer imposée : pas de photo en plus pendant la caméra (garde la place) ; « Par photo » : le déclencheur
    // l'ouvre, puis ce bouton change de photo.
    const cacherPhoto = (cacher) => { photo.style.visibility = cacher ? 'hidden' : ''; };
    cacherPhoto(Boolean(mode));
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
      video, figee, placement, reticule, capsuleDirect,
      el('header', { class: 'scan-haut' },
        boutonRond({ icone: 'fermer', libelle: 'Fermer', action: 'annuler-scan', onclick: () => terminer(null) }),
        el('h2', { id: 'titre-scan', tabindex: '-1', autofocus: true }, titre),
        boutonTorche),
      astuce ? el('p', { class: 'astuce-scan' }, astuce) : null,
      panneauAide,
      el('div', { class: 'scan-bas' },
        barrePointeurs, etat, relancer, retourFeuille,
        el('div', { class: 'commandes-scan' }, photo, mesurer, aide)),
      feuille);

    const terminer = terminaison(dialogue, (valeur) => { nettoyer(); resoudre(valeur); });

    function nettoyer() {
      clearInterval(intervalle);
      intervalle = null;
      camera?.arreter();
      video.srcObject = null;
      libererPhoto();
      window.removeEventListener('resize', placerReticule);
      window.removeEventListener('resize', placerPhoto);
    }

    function libererPhoto() {
      if (photoCourante) URL.revokeObjectURL(photoCourante.adresse);
      photoCourante = null;
      imagePlacement.removeAttribute('src');
    }

    // ---- Pointeurs sur une photo ----
    // Rectangle de la photo à l'écran (object-fit: contain dans la zone de placement).
    function cadrePhoto() {
      const zone = placement.getBoundingClientRect();
      const echelle = Math.min(zone.width / photoCourante.largeur, zone.height / photoCourante.hauteur);
      const largeur = photoCourante.largeur * echelle;
      const hauteur = photoCourante.hauteur * echelle;
      return { zone, echelle, largeur, hauteur, gauche: zone.left + (zone.width - largeur) / 2, haut: zone.top + (zone.height - hauteur) / 2 };
    }

    // Chaque pointeur montre exactement la zone mesurée (au moins 18 px pour rester visible et touchable).
    function dessinerPointeurs() {
      if (!photoCourante) return;
      const cadre = cadrePhoto();
      const cote = Math.max(18, SCAN_FRACTION_POINTEUR * Math.min(photoCourante.largeur, photoCourante.hauteur) * cadre.echelle);
      calque.replaceChildren(...pointeurs.map((p, i) => el('span', {
        class: 'pointeur', 'data-pointeur': i, 'data-actif': String(i === actif), 'aria-hidden': 'true',
        style: {
          left: `${cadre.gauche - cadre.zone.left + p.x * cadre.largeur}px`, top: `${cadre.haut - cadre.zone.top + p.y * cadre.hauteur}px`,
          width: `${cote}px`, height: `${cote}px`,
        },
      }, el('span', { class: 'numero-pointeur' }, String(i + 1)))));
    }

    // La photo occupe la place entre l'en-tête et les commandes (qui changent de hauteur avec les pointeurs).
    function placerPhoto() {
      if (placement.hidden || dialogue.dataset.etape !== 'placement') { dessinerPointeurs(); return; }
      const haut = dialogue.querySelector('.scan-haut').getBoundingClientRect().bottom + 8;
      const bas = dialogue.querySelector('.scan-bas').getBoundingClientRect().top;
      placement.style.top = `${haut}px`;
      placement.style.bottom = `${Math.max(0, window.innerHeight - bas)}px`;
      dessinerPointeurs();
    }

    // Puces des pointeurs : couleur visée en direct (corrigée comme l'aperçu de la caméra), ✕, « + Pointeur ».
    function majBarre() {
      barrePointeurs.replaceChildren(...pointeurs.map((p, i) => {
        const mesure = mesurerPoint(photoCourante, p.x, p.y);
        const rgb = mesure.rgb && corriger ? corriger(mesure.rgb, 'photo') : mesure.rgb;
        return el('span', { class: 'couleur-mesure' },
          el('button', {
            type: 'button', class: 'puce-pointeur', 'data-index': i, 'aria-pressed': String(i === actif),
            'aria-label': `Pointeur ${i + 1}${rgb ? `, ${rgbVersHex(rgb)}` : ''}`,
            onclick: () => { actif = i; dessinerPointeurs(); majBarre(); },
          }, el('span', { class: 'pastille', style: { backgroundColor: rgb ? rgbVersHex(rgb) : 'transparent' } }), String(i + 1)),
          i > 0 ? el('button', {
            type: 'button', class: 'retirer-puce', 'data-action': 'retirer-pointeur', 'data-index': i, 'aria-label': `Retirer le pointeur ${i + 1}`,
            onclick: () => { pointeurs.splice(i, 1); if (actif >= i) actif -= 1; majPointeurs(); },
          }, icone('fermer')) : null);
      }), ...(pointeurs.length < pointeursMax ? [el('button', {
        type: 'button', class: 'ajouter-puce', 'data-action': 'ajouter-pointeur', 'aria-label': 'Ajouter un pointeur pour une autre couleur',
        onclick: () => {
          const libre = PLACES_POINTEURS.find((place) => !pointeurs.some((p) => Math.hypot(p.x - place.x, p.y - place.y) < 0.05)) ?? PLACES_POINTEURS[0];
          pointeurs.push({ ...libre });
          actif = pointeurs.length - 1;
          majPointeurs();
        },
      }, icone('plus'), 'Pointeur')] : []));
    }

    function majPointeurs() {
      majBarre();
      placerPhoto();
    }

    // Toucher la photo y pose le pointeur actif (toucher un pointeur le rend actif) ; glisser le déplace.
    let glisse = false;
    let barrePrevue = false;
    function deplacerVers(evenement) {
      const cadre = cadrePhoto();
      pointeurs[actif] = {
        x: Math.min(1, Math.max(0, (evenement.clientX - cadre.gauche) / cadre.largeur)),
        y: Math.min(1, Math.max(0, (evenement.clientY - cadre.haut) / cadre.hauteur)),
      };
      dessinerPointeurs();
      if (!barrePrevue) {
        barrePrevue = true;
        requestAnimationFrame(() => { barrePrevue = false; if (photoCourante) majBarre(); });
      }
    }
    placement.addEventListener('pointerdown', (evenement) => {
      if (dialogue.dataset.etape !== 'placement' || !photoCourante) return;
      const cible = evenement.target.closest('[data-pointeur]');
      if (cible) actif = Number(cible.dataset.pointeur);
      glisse = true;
      try { placement.setPointerCapture(evenement.pointerId); } catch { /* pointeur déjà relâché */ }
      deplacerVers(evenement);
    });
    placement.addEventListener('pointermove', (evenement) => { if (glisse) deplacerVers(evenement); });
    const lacher = () => {
      if (!glisse) return;
      glisse = false;
      if (photoCourante) majBarre();
    };
    placement.addEventListener('pointerup', lacher);
    placement.addEventListener('pointercancel', lacher);

    // Photo prête : caméra coupée, photo entière et pointeurs. nouveaux : un seul pointeur, au centre (photo nouvelle,
    // ou couleur de plus) ; sinon les pointeurs d'avant (« Recommencer »).
    function afficherPlacement({ nouveaux = true } = {}) {
      clearInterval(intervalle);
      camera?.arreter();
      camera = null;
      dialogue.dataset.etape = 'placement';
      for (const element of [feuille, figee, reticule, capsuleDirect, panneauAide, boutonTorche]) element.hidden = true;
      relancer.hidden = mode === 'photo'; // retour à la caméra en direct
      retourFeuille.hidden = !suite;
      cacherPhoto(false); // changer de photo
      // Une seule couleur attendue (étalonnage, couleur d'une fiche ou d'une envie : feuille simple) : un seul pointeur.
      pointeursMax = mode || resultat === resultatSimple ? 1 : (suite ? restantesSuite : POINTEURS_MAX);
      if (nouveaux || pointeurs.length === 0) pointeurs = [{ ...PLACES_POINTEURS[0] }];
      pointeurs = pointeurs.slice(0, pointeursMax);
      actif = Math.min(actif, pointeurs.length - 1);
      if (nouveaux) actif = 0;
      placement.hidden = false;
      barrePointeurs.hidden = false;
      imagePlacement.src = photoCourante.adresse;
      mesurer.disabled = false;
      etat.textContent = suite ? 'Place le pointeur sur la couleur suivante du vêtement (ou choisis une autre photo).'
        : pointeursMax > 1 ? 'Place le pointeur sur le vêtement (un toucher ou glisse-le) ; « Pointeur » pour une autre couleur.'
          : 'Place le pointeur sur le vêtement (un toucher ou glisse-le), puis touche le déclencheur.';
      majPointeurs();
      rearmerDialogue(dialogue);
    }

    // Déclencheur sur une photo : une couleur par pointeur, dans l'ordre des pointeurs.
    function mesurerPointeurs() {
      const mesures = pointeurs.map((p) => mesurerPoint(photoCourante, p.x, p.y));
      const rate = mesures.findIndex((m) => m.erreur);
      if (rate >= 0) {
        etat.textContent = mesures[rate].erreur === 'reflet'
          ? `Reflet trop fort sous le pointeur ${rate + 1} : déplace-le un peu.`
          : `Rien à mesurer sous le pointeur ${rate + 1}.`;
        return;
      }
      const [premiere, ...autres] = mesures.map((m) => ({ rgb: m.rgb, source: 'photo', mode: 'photo' }));
      afficherResultat({ ...premiere, ...(autres.length > 0 ? { autres } : {}) });
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
      placement.hidden = true;
      barrePointeurs.hidden = true;
      cacherPhoto(Boolean(mode));
      mesurer.disabled = true;
      relancer.hidden = true;
      boutonTorche.hidden = true;
      reticule.hidden = true;
      capsuleDirect.hidden = true;
      etat.textContent = suite ? 'Vise la couleur suivante du vêtement.' : 'Ouverture de la caméra…';
      retourFeuille.hidden = !suite;
      historique = [];
      capsuleDirect.classList.remove('stable');
      if (mode === 'photo') {
        etat.textContent = consigne;
        mesurer.disabled = false;
        return;
      }
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
          etat.textContent = mode ? 'La caméra ne renvoie pas d\'image. Relance-la.' : 'La caméra ne renvoie pas d\'image. Relance-la ou prends une photo.';
          relancer.hidden = false;
          return;
        }
        if (mode === 'torche' && !info.torcheDisponible) {
          courante.arreter();
          etat.textContent = 'Pas de torche sur cet appareil : étalonne plutôt « Sans torche » ou « Par photo ».';
          return;
        }
        placerReticule();
        capsuleDirect.hidden = false;
        intervalle = setInterval(apercu, SCAN_APERCU_MS);
        if (info.torcheDisponible && mode !== 'sans-torche') {
          boutonTorche.hidden = mode === 'torche'; // torche imposée : pas de bascule
          const allumee = await courante.reglerTorche(true);
          if (camera !== courante || !dialogue.isConnected) return;
          afficherTorche();
          if (mode === 'torche' && !allumee) {
            etat.textContent = 'La torche n\'a pas pu s\'allumer (surchauffe ?). Relance la caméra un peu plus tard.';
            relancer.hidden = false;
            return;
          }
          etat.textContent = allumee ? consigne
            : 'La torche n\'a pas pu s\'allumer : mesure à la lumière ambiante, ou prends une photo avec flash.';
        } else {
          etat.textContent = mode ? consigne : `${consigne} Pas de torche : lumière ambiante, ou photo avec flash.`;
        }
        mesurer.disabled = false; // après la torche : la mesure se fait dans la bonne lumière
      } catch (erreur) {
        if (camera !== courante || !dialogue.isConnected) return;
        const message = erreur instanceof ErreurCamera ? erreur.message : 'Caméra indisponible.';
        etat.textContent = mode ? `${message} Tu peux étalonner « Par photo » à la place.` : `${message} Choisis ou prends une photo avec le bouton en bas à gauche.`;
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
      barrePointeurs.hidden = true;
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
          // Photo : on revient à ses pointeurs ; sinon à la caméra.
          recommencer: () => {
            suite = null;
            if (photoCourante) afficherPlacement({ nouveaux: false });
            else lancer();
          },
          mesurerAutre: (rappel, restantes = 1) => {
            suite = rappel;
            restantesSuite = restantes;
            imageAvant = [figee, placement].find((image) => !image.hidden) ?? null;
            if (photoCourante) afficherPlacement();
            else lancer();
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
      barrePointeurs.hidden = true;
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
      if (dialogue.dataset.etape === 'placement') { mesurerPointeurs(); return; }
      if (mode === 'photo') { prendrePhoto(); return; } // pendant le geste : iOS ouvre l'appareil photo
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
      const facon = modeCourant(); // torche ou sans torche, au moment de la mesure
      figee.width = video.videoWidth;
      figee.height = video.videoHeight;
      figee.getContext('2d').drawImage(video, 0, 0);
      figee.hidden = false;
      etat.textContent = consigneAvant;
      afficherResultat({ rgb: mesure.rgb, source: 'camera', mode: facon, images: mesure.images });
    });

    relancer.addEventListener('click', () => { libererPhoto(); lancer(); });

    // Photo : à appeler pendant le geste (iOS n'ouvre la photothèque ou l'appareil photo qu'ainsi).
    async function prendrePhoto() {
      const promesse = choisirImage();
      // Une seule capture à la fois sur iOS : on libère la caméra pour l'appareil photo. camera = null : un démarrage de
      // la caméra encore en cours s'arrête là, sans réécrire l'écran de la photo.
      camera?.arreter();
      camera = null;
      clearInterval(intervalle);
      mesurer.disabled = true;
      // Échec : avec une photo déjà là ou en mode photo, le déclencheur reste utilisable ; sinon, on relance la caméra.
      const echec = (message) => {
        etat.textContent = message;
        if (mode === 'photo' || photoCourante) mesurer.disabled = false;
        else relancer.hidden = false;
      };
      const fichier = await promesse;
      if (!dialogue.isConnected) return;
      if (!fichier) {
        echec(mode === 'photo' ? 'Aucune photo prise. Touche le déclencheur pour recommencer.' : 'Aucune photo prise.');
        return;
      }
      try {
        const nouvelle = await preparerPhoto(fichier);
        if (!dialogue.isConnected) { URL.revokeObjectURL(nouvelle.adresse); return; }
        libererPhoto();
        photoCourante = nouvelle;
        afficherPlacement();
      } catch {
        echec('Impossible de lire cette photo. Réessaie, ou choisis la couleur dans le catalogue.');
      }
    }
    photo.addEventListener('click', prendrePhoto);

    video.addEventListener('resize', placerReticule);
    window.addEventListener('resize', placerReticule);
    window.addEventListener('resize', placerPhoto);
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
  // Photo à plusieurs pointeurs : une couleur par pointeur, la première est la principale.
  const couleurs = [entree(mesure), ...(mesure.autres ?? []).map((autre) => entree(corrigerMesure(autre)))];
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
        for (const m of [suivante, ...(suivante.autres ?? [])].slice(0, 3 - couleurs.length)) couleurs.push(entree(corrigerMesure(m)));
        actif = couleurs.length - 1;
        remplirRangee();
      }, 3 - couleurs.length),
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
