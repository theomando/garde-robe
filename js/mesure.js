// Mesure d'une couleur sur une image : carré central, médiane par canal, reflets exclus. Module pur, sans DOM.

import { SCAN_FRACTION_CARRE, SCAN_SEUIL_SATURE, SCAN_PART_VALIDE_MIN } from './constantes.js';

// Carré centré dont le côté vaut une fraction du plus petit côté de l'image (en pixels de l'image).
export function carreCentral(largeur, hauteur, fraction = SCAN_FRACTION_CARRE) {
  const cote = Math.max(1, Math.round(Math.min(largeur, hauteur) * fraction));
  return { x: Math.floor((largeur - cote) / 2), y: Math.floor((hauteur - cote) / 2), cote };
}

// Médiane basse par canal (valeur réellement observée) des pixels RGBA, en excluant les pixels saturés
// (un canal ≥ seuil : reflet). Calcul par histogramme, exact et linéaire.
// Renvoie { rgb, valides, total } ou { erreur: 'reflet' | 'vide', valides, total }.
export function medianeSansReflets(pixels, { seuilSature = SCAN_SEUIL_SATURE, partValideMin = SCAN_PART_VALIDE_MIN } = {}) {
  const total = Math.floor(pixels.length / 4);
  if (total === 0) return { erreur: 'vide', valides: 0, total };
  const histogrammes = [new Uint32Array(256), new Uint32Array(256), new Uint32Array(256)];
  let valides = 0;
  for (let i = 0; i < total * 4; i += 4) {
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    if (r >= seuilSature || g >= seuilSature || b >= seuilSature) continue;
    histogrammes[0][r]++;
    histogrammes[1][g]++;
    histogrammes[2][b]++;
    valides++;
  }
  if (valides === 0 || valides < total * partValideMin) return { erreur: 'reflet', valides, total };
  const rang = Math.floor((valides - 1) / 2);
  const rgb = histogrammes.map((histogramme) => {
    let cumul = 0;
    for (let v = 0; v < 256; v++) {
      cumul += histogramme[v];
      if (cumul > rang) return v;
    }
    return 255;
  });
  return { rgb, valides, total };
}
