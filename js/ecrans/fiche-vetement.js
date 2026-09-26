// Éléments communs de la fiche d'un vêtement (demande de Théo, 2026-09-26) : champ « Marque » avec les marques
// déjà saisies en suggestion, choix d'une photo (appareil photo ou photothèque), vignette ou pastille du vêtement.
// Utilisés par la Garde-robe, la feuille de mesure et Mes tenues.

import { el, pastille, choisirImage, annoncer } from '../ui.js';
import { MARQUE_MAX } from '../constantes.js';
import { marquesConnues } from '../donnees.js';
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
  const fichier = await choisirImage({ capture: null });
  if (!fichier) return null;
  try {
    return await vignetteDepuisFichier(fichier);
  } catch {
    annoncer('Impossible de lire cette photo. Essaie une autre image.', 'erreur');
    return null;
  }
}

// Visuel d'un vêtement : sa photo (avec la pastille de sa couleur dans un coin) ou, à défaut, la pastille seule.
export function visuelVetement(app, vetement) {
  const photo = vetement.photo ? app.photos.get(vetement.id) : null;
  if (!photo) return pastille(vetement.hex, { classe: 'moyenne' });
  return el('span', { class: 'visuel-vetement', 'aria-hidden': 'true' },
    el('img', { class: 'vignette-vetement', src: photo, alt: '' }), pastille(vetement.hex, { classe: 'coin' }));
}
