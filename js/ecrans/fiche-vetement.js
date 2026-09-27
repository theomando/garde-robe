// Éléments communs de la fiche d'un vêtement (demande de Théo, 2026-09-26) : champ « Marque » avec les marques
// déjà saisies en suggestion, choix d'une photo (appareil photo ou photothèque), vignette ou pastille du vêtement.
// Utilisés par la Garde-robe, la feuille de mesure et Mes tenues.

import { el, pastille, choisirImage, annoncer, ouvrirDialogue } from '../ui.js';
import { MARQUE_MAX } from '../constantes.js';
import { marquesConnues, couleursDuVetement } from '../donnees.js';
import { vignetteDepuisFichier } from '../photos.js';

let compteur = 0;

// Renvoie [champ, liste de suggestions] : les deux vont dans le document ; champ.value donne la marque saisie.
export function champMarque(app, valeur = '', { id = `marque-${++compteur}`, classe = 'champ-ligne-texte', placeholder = 'Facultatif' } = {}) {
  const liste = el('datalist', { id: `${id}-suggestions` }, marquesConnues(app.etat).map((m) => el('option', { value: m })));
  const champ = el('input', {
    type: 'text', id, class: classe, list: liste.id, maxlength: MARQUE_MAX, placeholder, value: valeur,
    autocomplete: 'off', autocapitalize: 'words', 'data-action': 'marque',
  });
  return [champ, liste];
}

// Photo du vêtement : iOS propose « Prendre une photo » ou « Photothèque ». Renvoie une vignette (data URL) ou null.
export async function choisirPhoto() {
  const fichier = await choisirImage();
  if (!fichier) return null;
  try {
    return await vignetteDepuisFichier(fichier);
  } catch {
    annoncer('Impossible de lire cette photo. Essaie une autre image.', 'erreur');
    return null;
  }
}

// Nouveau vêtement sans photo (demande de Théo, 2026-09-27) : on propose d'en ajouter une, car c'est plus simple
// pour le retrouver ensuite. Renvoie la vignette choisie, ou null (« Sans photo », ou appareil photo refermé).
export async function proposerPhoto() {
  let photo = null;
  const choix = await ouvrirDialogue({
    titre: 'Ajouter une photo ?',
    forme: 'alerte',
    classe: 'alerte-photo',
    contenu: [el('p', {}, 'Une photo du vêtement t\'aidera à le retrouver ensuite dans ta garde-robe.')],
    boutons: [
      { libelle: 'Sans photo', valeur: 'sans' },
      // L'appareil photo s'ouvre pendant le toucher (iOS ne l'ouvre que sur un geste).
      { libelle: 'Ajouter', valeur: 'photo', style: 'principal', surClic: () => { photo = choisirPhoto(); } },
    ],
  });
  return choix === 'photo' ? photo : null;
}

// Pastille d'une ou plusieurs couleurs : rayures horizontales pour un vêtement multicolore (principale dominante).
export function pastilleCouleurs(hexes, options = {}) {
  const rond = pastille(hexes[0], options);
  if (hexes.length > 1) {
    const bandes = hexes.length === 2
      ? `${hexes[0]} 0 5px, ${hexes[1]} 5px 8px`
      : `${hexes[0]} 0 4px, ${hexes[1]} 4px 6px, ${hexes[2]} 6px 8px`;
    rond.style.backgroundImage = `repeating-linear-gradient(to bottom, ${bandes})`;
    rond.classList.add('rayee');
  }
  return rond;
}

export const hexDuVetement = (vetement) => couleursDuVetement(vetement).map((c) => c.hex);

// Visuel d'un vêtement : sa photo (avec la pastille de ses couleurs dans un coin) ou, à défaut, la pastille seule.
export function visuelVetement(app, vetement) {
  const photo = vetement.photo ? app.photos.get(vetement.id) : null;
  if (!photo) return pastilleCouleurs(hexDuVetement(vetement), { classe: 'moyenne' });
  return el('span', { class: 'visuel-vetement', 'aria-hidden': 'true' },
    el('img', { class: 'vignette-vetement', src: photo, alt: '' }), pastilleCouleurs(hexDuVetement(vetement), { classe: 'coin' }));
}
