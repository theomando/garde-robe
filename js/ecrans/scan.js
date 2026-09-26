// Écran de scan (caméra en direct, torche, réticule, couleur en direct) et choix après la mesure
// (type de vêtement, « Ajuster » : 12 couleurs les plus proches du catalogue, extensible au catalogue complet).

import { el, pastille, terminaison, armerDialogue, rearmerDialogue, choisirImage } from '../ui.js';
import { TYPES, LIBELLES_TYPES, SCAN_DELAI_SANS_IMAGE_MS, SCAN_APERCU_MS, NEUTRE_C_MAX } from '../constantes.js';
import { rgbVersHex, labDepuisHex, deltaE00, chroma } from '../couleur.js';
import { carreCentral } from '../mesure.js';
import { plusProches } from '../catalogue.js';
import { creerCamera, ErreurCamera, mesurerSource, mesurerPhoto } from '../scan.js';
import { ouvrirSelecteur } from './selecteur-catalogue.js';

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

const CONSIGNE_SCAN = `Place le vêtement bien à plat dans le carré, à 10 à 20 cm, puis touche « Mesurer ». `
  + 'Un vêtement très sombre ou très clair : pose-le sur un fond neutre (drap, feuille blanche) sans remplir tout l\'écran.';

// Ouvre la caméra ; renvoie { rgb (mesure brute), source: 'camera' | 'photo', mode: 'torche' | 'sans-torche' | 'photo',
// apercu? } ou null si annulé. corriger(rgb, mode) sert à l'affichage en direct (étalonnage) ; titre, consigne et
// astuce personnalisent l'écran (scans d'étalonnage).
export function ouvrirScan({ mediaDevices, titre = 'Scanner une couleur', consigne = CONSIGNE_SCAN, astuce = null, corriger = null } = {}) {
  return new Promise((resoudre) => {
    let camera = null;
    let intervalle = null;
    const canvas = document.createElement('canvas');

    const video = el('video', { class: 'scan-video', playsinline: true, muted: true, autoplay: true, 'aria-label': 'Image de la caméra' });
    video.muted = true; // propriété et attribut : lecture automatique inline sur iOS
    const reticule = el('div', { class: 'reticule', 'aria-hidden': 'true' });
    const direct = el('span', { class: 'pastille moyenne', 'aria-hidden': 'true' });
    const texteDirect = el('span', { class: 'texte-direct' }, '—');
    const etat = el('p', { class: 'etat-scan', role: 'status' }, 'Ouverture de la caméra…');
    const boutonTorche = el('button', { type: 'button', class: 'bouton secondaire', hidden: true, 'data-action': 'torche', 'aria-pressed': 'false' }, 'Torche');
    const mesurer = el('button', { type: 'button', class: 'bouton principal large', disabled: true, 'data-action': 'mesurer' }, 'Mesurer');
    const relancer = el('button', { type: 'button', class: 'bouton secondaire', hidden: true, 'data-action': 'relancer' }, 'Relancer la caméra');
    const photo = el('button', { type: 'button', class: 'bouton lien', 'data-action': 'photo' }, 'Prendre une photo à la place (avec flash)');

    const dialogue = el('dialog', { class: 'dialogue plein-ecran scan', 'aria-labelledby': 'titre-scan' },
      el('div', { class: 'selecteur-entete' },
        el('h2', { id: 'titre-scan', tabindex: '-1', autofocus: true }, titre),
        el('button', { type: 'button', class: 'bouton secondaire', 'data-action': 'annuler-scan', onclick: () => terminer(null) }, 'Annuler')),
      el('p', { class: 'discret consigne' }, consigne),
      astuce ? el('p', { class: 'encart astuce' }, astuce) : null,
      el('div', { class: 'cadre-video' }, video, reticule),
      el('div', { class: 'barre-scan' }, direct, texteDirect, boutonTorche),
      etat, mesurer, relancer, photo);

    const terminer = terminaison(dialogue, (valeur) => { nettoyer(); resoudre(valeur); });

    function nettoyer() {
      clearInterval(intervalle);
      intervalle = null;
      camera?.arreter();
      video.srcObject = null;
      window.removeEventListener('resize', placerReticule);
    }

    // Le réticule couvre exactement la zone mesurée (vidéo affichée en object-fit: contain, centrée).
    function placerReticule() {
      const { videoWidth: vw, videoHeight: vh } = video;
      if (!vw || !vh) return;
      const echelle = Math.min(video.clientWidth / vw, video.clientHeight / vh);
      const cote = carreCentral(vw, vh).cote * echelle;
      reticule.style.width = `${cote}px`;
      reticule.style.height = `${cote}px`;
      reticule.hidden = false;
    }

    function afficherTorche() {
      const { torche } = camera.etat();
      boutonTorche.textContent = torche ? 'Torche : allumée' : 'Torche : éteinte';
      boutonTorche.setAttribute('aria-pressed', String(torche));
    }

    // Façon de mesurer, dont dépend l'étalonnage : l'exposition diffère avec ou sans torche.
    const modeCourant = () => (camera?.etat().torche ? 'torche' : 'sans-torche');

    function apercu() {
      const resultat = mesurerSource(video, video.videoWidth, video.videoHeight, canvas);
      const rgb = resultat.rgb && corriger ? corriger(resultat.rgb, modeCourant()) : resultat.rgb;
      direct.style.backgroundColor = rgb ? rgbVersHex(rgb) : '';
      texteDirect.textContent = rgb ? rgbVersHex(rgb) : (resultat.erreur === 'reflet' ? 'reflet' : '—');
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
      mesurer.disabled = true;
      relancer.hidden = true;
      boutonTorche.hidden = true;
      reticule.hidden = true;
      etat.textContent = 'Ouverture de la caméra…';
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
          etat.textContent = 'La caméra ne renvoie pas d\'image. Relance-la ou prends une photo à la place.';
          relancer.hidden = false;
          return;
        }
        placerReticule();
        mesurer.disabled = false;
        intervalle = setInterval(apercu, SCAN_APERCU_MS);
        if (info.torcheDisponible) {
          boutonTorche.hidden = false;
          const allumee = await courante.reglerTorche(true);
          afficherTorche();
          etat.textContent = allumee
            ? 'Torche allumée. Touche « Mesurer » quand la couleur affichée ne bouge plus.'
            : 'La torche n\'a pas pu s\'allumer : mesure à la lumière ambiante, ou prends une photo avec flash.';
        } else {
          etat.textContent = 'Pas de torche sur cette caméra : mesure à la lumière ambiante, ou prends une photo avec flash.';
        }
      } catch (erreur) {
        if (camera !== courante || !dialogue.isConnected) return;
        const message = erreur instanceof ErreurCamera ? erreur.message : 'Caméra indisponible.';
        etat.textContent = `${message} Tu peux prendre une photo à la place.`;
        relancer.hidden = erreur instanceof ErreurCamera && erreur.code === 'indisponible';
      }
    }

    boutonTorche.addEventListener('click', async () => {
      boutonTorche.disabled = true;
      const voulu = !camera.etat().torche;
      const obtenu = await camera.reglerTorche(voulu);
      boutonTorche.disabled = false;
      afficherTorche();
      if (obtenu !== voulu) etat.textContent = voulu ? 'La torche n\'a pas pu s\'allumer (surchauffe ?).' : 'La torche n\'a pas pu s\'éteindre.';
    });

    mesurer.addEventListener('click', () => {
      const resultat = mesurerSource(video, video.videoWidth, video.videoHeight, canvas);
      if (resultat.erreur) { etat.textContent = MESSAGES_MESURE[resultat.erreur]; return; }
      terminer({ rgb: resultat.rgb, source: 'camera', mode: modeCourant() });
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
        const { mesure, apercu: vignette } = await mesurerPhoto(fichier);
        if (mesure.erreur) {
          etat.textContent = MESSAGES_MESURE[mesure.erreur];
          relancer.hidden = false;
          return;
        }
        terminer({ rgb: mesure.rgb, source: 'photo', mode: 'photo', apercu: vignette });
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

// Après la mesure, en trois étapes dans la même fenêtre :
//   1. « couleur » : couleur mesurée, puis « Veux-tu ajuster la couleur ? » (Oui / Non) ;
//   2. « ajuster » (si oui) : les 12 couleurs du catalogue les plus proches en premier, puis tout le catalogue ;
//   3. « type » : type de vêtement (bijoux exclus : choix manuel seulement), puis Enregistrer.
// La couleur mesurée est gardée par défaut. Renvoie { type, hex, couleur }, 'recommencer' ou null.
export function choisirApresMesure(app, actions, { rgb, brut = null, apercu }, { typeImpose = null } = {}) {
  return new Promise((resoudre) => {
    const hexMesure = rgbVersHex(rgb);
    const labMesure = labDepuisHex(hexMesure);
    const proches = plusProches(labMesure, app.catalogue, 12);
    let type = typeImpose;
    let couleur = null; // couleur du catalogue retenue par « Ajuster » ; null = couleur mesurée
    let enCours = null; // sélection en cours pendant l'étape « ajuster »

    const titre = el('h2', { id: 'titre-resultat', tabindex: '-1', autofocus: true });
    const corps = el('div', { class: 'etape' });
    const pied = el('div', { class: 'dialogue-boutons' });
    const dialogue = el('dialog', { class: 'dialogue resultat-scan', 'aria-labelledby': 'titre-resultat' }, titre, corps, pied);
    const terminer = terminaison(dialogue, resoudre);

    const bouton = (libelle, action, onclick, classe = 'secondaire') =>
      el('button', { type: 'button', class: `bouton ${classe}`, 'data-action': action, onclick }, libelle);
    const resume = (hex, nom, detail) => el('div', { class: 'apercu-couleur' },
      pastille(hex, { classe: 'moyenne' }),
      el('div', { class: 'infos' }, el('strong', {}, nom), el('span', { class: 'discret' }, detail)));

    function afficher(etape) {
      dialogue.dataset.etape = etape;
      rearmerDialogue(dialogue); // nouveaux boutons sous le doigt : anti double tape
      if (etape === 'couleur') etapeCouleur();
      else if (etape === 'ajuster') etapeAjuster();
      else etapeType();
      dialogue.scrollTop = 0;
      if (dialogue.open) titre.focus({ preventScroll: true });
    }

    function etapeCouleur() {
      titre.textContent = 'Couleur mesurée';
      // replaceChildren écrirait « null » en texte : l'absence de vignette passe par un tableau filtré.
      corps.replaceChildren(...[
        apercu ? el('div', { class: 'vignette' }, apercu) : null,
        el('div', { class: 'bande-couleur', style: { backgroundColor: hexMesure }, 'aria-hidden': 'true' }),
        el('p', {}, el('strong', {}, hexMesure), ` : la plus proche du catalogue est ${proches[0].couleur.nom} (${ecartTexte(proches[0].ecart)}).`),
        brut ? el('p', { class: 'discret', 'data-info': 'etalonnage' }, `Couleur corrigée par l'étalonnage (mesure brute ${rgbVersHex(brut)}).`)
          : el('p', { class: 'discret' }, 'L\'iPhone règle seul l\'exposition : les noirs, gris et blancs sont souvent faussés (un noir peut sortir gris ou bleuté). L\'étalonnage (Réglages) corrige cet écart.'),
        el('p', { class: 'question' }, 'Veux-tu ajuster la couleur ?'),
        bouton('Oui, ajuster la couleur', 'ajuster', () => { enCours = couleur; afficher('ajuster'); }, 'secondaire accent large'),
        bouton('Non, continuer', 'continuer-sans-ajuster', () => { couleur = null; afficher('type'); }, 'principal large'),
      ].filter(Boolean));
      pied.replaceChildren(
        bouton('Recommencer la mesure', 'recommencer', () => terminer('recommencer')),
        bouton('Annuler', 'annuler-resultat', () => terminer(null)));
    }

    function etapeAjuster() {
      titre.textContent = 'Ajuster la couleur';
      const choix = el('div');
      const continuer = bouton('Continuer', 'continuer', () => { couleur = enCours; afficher('type'); }, 'principal');
      const carte = (c, ecart, classe = 'carte-proche') => el('button', {
        type: 'button', class: classe, 'data-couleur': c.id, 'aria-pressed': 'false',
        onclick: () => { enCours = c; majChoix(); },
      }, pastille(c.hex, { classe: 'grande' }), el('span', { class: 'nom' }, c.nom), el('span', { class: 'detail' }, ecartTexte(ecart)));
      const grille = el('div', { class: 'grille-couleurs' }, proches.map(({ couleur: c, ecart }) => carte(c, ecart)));
      // L'exposition automatique de l'iPhone fausse surtout les noirs, gris et blancs (un noir remonte vers le gris,
      // la torche le bleuit) : les neutres du catalogue restent toujours à portée, du plus foncé au plus clair.
      const neutres = el('div', { class: 'grille-neutres' }, app.catalogue.couleurs
        .filter((c) => chroma(c.lab) <= NEUTRE_C_MAX)
        .sort((x, y) => x.lab.L - y.lab.L)
        .map((c) => carte(c, deltaE00(labMesure, c.lab), 'carte-proche neutre')));
      function majChoix() {
        choix.replaceChildren(enCours
          ? resume(enCours.hex, enCours.nom, `${enCours.hex}, au lieu de la mesure ${hexMesure}`)
          : resume(hexMesure, 'Couleur mesurée', `${hexMesure} : touche la couleur la plus juste ci-dessous`));
        for (const c of corps.querySelectorAll('[data-couleur]')) c.setAttribute('aria-pressed', String(c.dataset.couleur === enCours?.id));
        continuer.disabled = enCours === null;
      }
      const tout = bouton('Voir tout le catalogue (avec recherche)', 'tout-catalogue', async () => {
        const choisie = await ouvrirSelecteur({
          catalogue: app.catalogue, titre: 'Couleur la plus juste', reference: labMesure, ...actions.favorisPourSelecteur(),
        });
        if (choisie) { enCours = choisie; majChoix(); }
      }, 'secondaire large');
      corps.replaceChildren(choix,
        el('p', { class: 'sous-titre' }, 'Noir, gris et blanc'),
        el('p', { class: 'discret' }, 'La caméra fausse souvent les couleurs neutres : un noir peut paraître gris ou bleuté.'),
        neutres,
        el('p', { class: 'sous-titre' }, 'Les 12 plus proches de la mesure'),
        el('p', { class: 'discret' }, 'De la plus proche à la plus éloignée :'),
        grille, tout);
      pied.replaceChildren(bouton('Retour', 'retour', () => afficher('couleur')), continuer);
      majChoix();
    }

    function etapeType() {
      titre.textContent = 'Type de vêtement';
      const enregistrer = bouton('Enregistrer', 'enregistrer-scan', () => terminer({ type, hex: couleur?.hex ?? hexMesure, couleur }), 'principal');
      enregistrer.disabled = type === null;
      const grille = el('div', { class: 'grille-types', role: 'group', 'aria-label': 'Type de vêtement' },
        TYPES.filter((t) => t !== 'bijoux').map((t) => el('button', {
          type: 'button', class: 'bouton secondaire choix-type', 'data-type': t, 'aria-pressed': String(t === type),
          onclick: (evenement) => {
            type = t;
            for (const b of grille.children) b.setAttribute('aria-pressed', String(b === evenement.currentTarget));
            enregistrer.disabled = false;
          },
        }, LIBELLES_TYPES[t])));
      corps.replaceChildren(
        couleur ? resume(couleur.hex, couleur.nom, `${couleur.hex}, choisie dans le catalogue`) : resume(hexMesure, 'Couleur mesurée', hexMesure),
        el('p', { class: 'question' }, 'Quel type de vêtement ?'),
        grille);
      pied.replaceChildren(
        bouton('Retour', 'retour', () => { enCours = couleur; afficher(couleur ? 'ajuster' : 'couleur'); }),
        enregistrer);
    }

    document.body.append(dialogue);
    armerDialogue(dialogue);
    afficher('couleur');
    dialogue.showModal();
  });
}
