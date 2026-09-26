// Écran de scan (caméra en direct, torche, réticule, couleur en direct) et choix après la mesure
// (type de vêtement, « Ajuster » : 12 couleurs les plus proches du catalogue, extensible au catalogue complet).

import { el, pastille, terminaison, armerDialogue, choisirImage } from '../ui.js';
import { TYPES, LIBELLES_TYPES, SCAN_DELAI_SANS_IMAGE_MS, SCAN_APERCU_MS } from '../constantes.js';
import { rgbVersHex, labDepuisHex } from '../couleur.js';
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

// Ouvre la caméra ; renvoie { rgb, source: 'camera' | 'photo', apercu? } ou null si annulé.
export function ouvrirScan({ mediaDevices } = {}) {
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
        el('h2', { id: 'titre-scan', tabindex: '-1', autofocus: true }, 'Scanner une couleur'),
        el('button', { type: 'button', class: 'bouton secondaire', 'data-action': 'annuler-scan', onclick: () => terminer(null) }, 'Annuler')),
      el('p', { class: 'discret consigne' }, 'Place le vêtement bien à plat dans le carré, à 10 à 20 cm, puis touche « Mesurer ».'),
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

    function apercu() {
      const resultat = mesurerSource(video, video.videoWidth, video.videoHeight, canvas);
      direct.style.backgroundColor = resultat.rgb ? rgbVersHex(resultat.rgb) : '';
      texteDirect.textContent = resultat.rgb ? rgbVersHex(resultat.rgb) : (resultat.erreur === 'reflet' ? 'reflet' : '—');
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
            ? 'Torche allumée. Touche « Mesurer » quand la couleur affichée ne bouge plus.'
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
      terminer({ rgb: resultat.rgb, source: 'camera' });
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
        terminer({ rgb: mesure.rgb, source: 'photo', apercu: vignette });
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

// Après la mesure : type (bijoux exclus : choix manuel seulement), couleur mesurée conservée par défaut,
// « Ajuster » pour la remplacer par une couleur du catalogue. Renvoie { type, hex, couleur }, 'recommencer' ou null.
export function choisirApresMesure(app, actions, { rgb, apercu }, { typeImpose = null } = {}) {
  return new Promise((resoudre) => {
    const hexMesure = rgbVersHex(rgb);
    const labMesure = labDepuisHex(hexMesure);
    const proches = plusProches(labMesure, app.catalogue, 12);
    let type = typeImpose;
    let couleur = null;

    const grande = pastille(hexMesure, { classe: 'grande-mesure' });
    const titre = el('strong', { class: 'nom' });
    const detail = el('span', { class: 'discret' });
    const garder = el('button', { type: 'button', class: 'bouton lien', hidden: true, 'data-action': 'garder-mesure', onclick: () => { couleur = null; afficherChoix(); } },
      'Garder la couleur mesurée');
    const grilleProches = el('div', { class: 'grille-couleurs' }, proches.map(({ couleur: c, ecart }) => el('button', {
      type: 'button', class: 'carte-proche', 'data-couleur': c.id, 'aria-pressed': 'false',
      onclick: () => { couleur = c; afficherChoix(); },
    }, pastille(c.hex, { classe: 'grande' }), el('span', { class: 'nom' }, c.nom), el('span', { class: 'detail' }, ecartTexte(ecart)))));

    function afficherChoix() {
      const hex = couleur?.hex ?? hexMesure;
      grande.style.backgroundColor = hex;
      titre.textContent = couleur ? couleur.nom : 'Couleur mesurée';
      detail.textContent = couleur
        ? `${hex}, choisie dans le catalogue`
        : `${hex}. La plus proche du catalogue : ${proches[0].couleur.nom} (${ecartTexte(proches[0].ecart)}).`;
      for (const bouton of grilleProches.querySelectorAll('[data-couleur]')) {
        bouton.setAttribute('aria-pressed', String(bouton.dataset.couleur === couleur?.id));
      }
      garder.hidden = couleur === null;
    }

    const enregistrer = el('button', {
      type: 'button', class: 'bouton principal', disabled: type === null, 'data-action': 'enregistrer-scan',
      onclick: () => terminer({ type, hex: couleur?.hex ?? hexMesure, couleur }),
    }, 'Enregistrer');
    const typesScan = TYPES.filter((t) => t !== 'bijoux');
    const grilleTypes = el('div', { class: 'grille-types', role: 'group', 'aria-label': 'Type de vêtement' },
      typesScan.map((t) => el('button', {
        type: 'button', class: 'bouton secondaire choix-type', 'data-type': t, 'aria-pressed': String(t === type),
        onclick: (evenement) => {
          type = t;
          for (const bouton of grilleTypes.children) bouton.setAttribute('aria-pressed', String(bouton === evenement.currentTarget));
          enregistrer.disabled = false;
        },
      }, LIBELLES_TYPES[t])));

    const tout = el('button', {
      type: 'button', class: 'bouton secondaire', 'data-action': 'tout-catalogue',
      onclick: async () => {
        const choisie = await ouvrirSelecteur({
          catalogue: app.catalogue, titre: 'Couleur la plus juste', reference: labMesure, ...actions.favorisPourSelecteur(),
        });
        if (choisie) { couleur = choisie; afficherChoix(); }
      },
    }, 'Tout le catalogue, du plus proche au plus éloigné');

    const dialogue = el('dialog', { class: 'dialogue resultat-scan', 'aria-labelledby': 'titre-resultat' },
      el('h2', { id: 'titre-resultat', tabindex: '-1', autofocus: true }, 'Couleur mesurée'),
      apercu ? el('div', { class: 'vignette' }, apercu) : null,
      el('div', { class: 'apercu-couleur' }, grande, el('div', { class: 'infos' }, titre, detail)),
      el('h3', {}, 'Type de vêtement'),
      grilleTypes,
      el('details', { class: 'ajuster' },
        el('summary', { 'data-action': 'ajuster' }, 'Ajuster : choisir une couleur proche du catalogue'),
        el('p', { class: 'discret' }, 'Les 12 couleurs du catalogue les plus proches de la mesure.'),
        grilleProches, garder, tout),
      el('div', { class: 'dialogue-boutons' },
        el('button', { type: 'button', class: 'bouton secondaire', 'data-action': 'recommencer', onclick: () => terminer('recommencer') }, 'Recommencer'),
        el('button', { type: 'button', class: 'bouton secondaire', onclick: () => terminer(null) }, 'Annuler'),
        enregistrer));
    const terminer = terminaison(dialogue, resoudre);
    afficherChoix();
    document.body.append(dialogue);
    armerDialogue(dialogue);
    dialogue.showModal();
  });
}
