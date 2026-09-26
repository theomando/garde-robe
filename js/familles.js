// Carte des couleurs (demande de Théo, 2026-09-26) : chaque couleur du catalogue range dans une seule famille.
// Module pur, sans DOM. Neutres : même critère que le reste de l'app (C*ab ≤ NEUTRE_C_MAX en CIELAB). Autres
// familles : teinte, clarté et chroma en OKLCh (voir couleur.js), dont la teinte ne fait pas passer les bleus saturés
// pour des violets. Bornes et seuils calés à l'œil le 2026-09-26 sur les 159 couleurs nommées du catalogue de Wada
// (« Burnt Sienna » dans les oranges, « Olive Buff » dans les kakis…) : choix de rangement, à ajuster à l'usage.

import { NEUTRE_C_MAX } from './constantes.js';
import { chroma, oklchDepuisHex } from './couleur.js';

// Ordre d'affichage de la carte.
export const FAMILLES = [
  { id: 'neutres', nom: 'Noirs, gris et blancs' },
  { id: 'beiges', nom: 'Beiges et crèmes' },
  { id: 'bruns', nom: 'Bruns' },
  { id: 'rouges', nom: 'Rouges' },
  { id: 'roses', nom: 'Roses' },
  { id: 'oranges', nom: 'Oranges' },
  { id: 'jaunes', nom: 'Jaunes' },
  { id: 'kakis', nom: 'Kakis et olives' },
  { id: 'verts', nom: 'Verts' },
  { id: 'turquoises', nom: 'Turquoises' },
  { id: 'bleus', nom: 'Bleus' },
  { id: 'violets', nom: 'Violets' },
];

// Débuts des secteurs de teinte (degrés OKLCh). Le secteur rouge va de ROUGE (345°) à ORANGE (35°) en passant par 0°.
const TEINTE = { orange: 35, jaune: 72, jauneVert: 100, vert: 130, turquoise: 172, bleu: 214, violet: 280, rouge: 345 };

// L et C en pourcentage de l'échelle OKLab (L de 0 à 100, C de 0 à 40 environ) pour des seuils lisibles.
export function familleDe({ hex, lab }) {
  if (chroma(lab) <= NEUTRE_C_MAX) return 'neutres';
  const ok = oklchDepuisHex(hex);
  const L = ok.L * 100;
  const C = ok.C * 100;
  const { h } = ok;

  // Beiges et crèmes : clairs et peu colorés, teinte chaude (du rosé au jaune pâle).
  if ((h >= 15 && h < TEINTE.jauneVert && L >= 68 && C <= 6) || (h >= TEINTE.orange && h < TEINTE.jauneVert && L >= 72 && C <= 10)) return 'beiges';

  if (h >= TEINTE.rouge || h < TEINTE.orange) {
    if (L >= 65 && (C <= 15 || L >= 70)) return 'roses';
    if ((h >= TEINTE.rouge || h < 10) && L >= 55 && C >= 14) return 'roses'; // framboise, fuchsia
    if (h >= 10 && h < TEINTE.orange && L < 52 && C < 11) return 'bruns'; // rouges éteints et sombres
    return 'rouges';
  }
  if (h < TEINTE.jaune) {
    if (L < 52 || (L < 60 && C < 10)) return 'bruns';
    return 'oranges';
  }
  if (h < TEINTE.jauneVert) {
    if (h < 82 && L < 60) return 'bruns';
    if (L < 65 && C < 10) return 'kakis';
    return 'jaunes';
  }
  if (h < TEINTE.vert) {
    if (L >= 75 && C >= 14 && h < 115) return 'jaunes';
    if (L >= 75 && C >= 12 && h >= 115) return 'verts';
    return 'kakis';
  }
  if (h < TEINTE.turquoise) return 'verts';
  if (h < TEINTE.bleu) return 'turquoises';
  if (h < TEINTE.violet) return 'bleus';
  return 'violets';
}

// Familles non vides, dans l'ordre de FAMILLES ; dans chaque famille, du plus clair au plus foncé (L* CIELAB),
// puis dans l'ordre du catalogue.
export function grouperParFamille(couleurs) {
  const parFamille = new Map(FAMILLES.map((f) => [f.id, []]));
  couleurs.forEach((couleur, rang) => parFamille.get(familleDe(couleur)).push({ couleur, rang }));
  return FAMILLES
    .map((f) => ({
      ...f,
      couleurs: parFamille.get(f.id).sort((x, y) => y.couleur.lab.L - x.couleur.lab.L || x.rang - y.rang).map((e) => e.couleur),
    }))
    .filter((f) => f.couleurs.length > 0);
}
