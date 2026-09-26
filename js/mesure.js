// Mesure d'une couleur sur une image : carré central, médiane par canal, reflets exclus. Module pur, sans DOM.
// Mesure stable (demande de Théo, 2026-09-26) : plusieurs images d'une même visée combinées par médiane, et
// indicateur « stable » quand les dernières mesures en direct ne bougent plus.

import { SCAN_FRACTION_CARRE, SCAN_SEUIL_SATURE, SCAN_PART_VALIDE_MIN, SCAN_STABLE_DELTA_E } from './constantes.js';
import { deltaE00 } from './couleur.js';

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

// Combine les mesures de plusieurs images ({ rgb } ou { erreur }) : médiane basse par canal des mesures réussies,
// ce qui écarte une image isolée faussée (bruit, exposition qui bouge, main qui tremble).
// Moins de la moitié d'images réussies : erreur (« reflet » si une image l'a signalé, sinon « vide »).
// Renvoie { rgb, images, total } ou { erreur, images, total } (images : nombre de mesures réussies).
export function combinerMesures(mesures, { partValideMin = SCAN_PART_VALIDE_MIN } = {}) {
  const total = mesures.length;
  const reussies = mesures.filter((m) => m.rgb);
  if (reussies.length === 0 || reussies.length < total * partValideMin) {
    return { erreur: mesures.some((m) => m.erreur === 'reflet') ? 'reflet' : 'vide', images: reussies.length, total };
  }
  const rang = Math.floor((reussies.length - 1) / 2);
  const rgb = [0, 1, 2].map((canal) => reussies.map((m) => m.rgb[canal]).sort((a, b) => a - b)[rang]);
  return { rgb, images: reussies.length, total };
}

// Visée stable : au moins deux mesures en direct (Lab), toutes à moins de seuil (ΔE00) de la plus récente.
export function viseeStable(labs, seuil = SCAN_STABLE_DELTA_E) {
  if (labs.length < 2) return false;
  const derniere = labs[labs.length - 1];
  return labs.every((lab) => deltaE00(lab, derniere) <= seuil);
}
