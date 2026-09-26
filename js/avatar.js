// Avatar 2D (SVG) en style figurine à blocs (demande de Théo, 2026-09-26) : tête cylindrique à plot, torse
// en trapèze, bras le long du corps, mains en pince, hanches et jambes en blocs. Dessin original, sans marque.
// La peau prend la teinte MST choisie ; une zone par type de vêtement porté.
// Couches du haut, du corps vers l'extérieur : t-shirt, pull, chemise, veste, manteau. Chemise, veste et manteau
// sont « imprimés » ouverts sur le torse : la couche du dessous reste visible au centre. Ceinture, chapeau et bijoux
// sont toujours visibles. Pièce en manque : hachurée dans la couleur manquante (noir et blanc pour un joker).
// Couleurs d'interface (contours, reflets, traits du visage, fond des hachures) : choix graphiques.

import { labDepuisHex } from './couleur.js';

const NS = 'http://www.w3.org/2000/svg';
const CONTOUR = 'rgba(0, 0, 0, 0.4)';
const FOND_HACHURES = '#ffffff';
const NOIR_JOKER = '#000000';
const TRAIT_FONCE = '#1d1d1b';
const TRAIT_CLAIR = '#f2f2f0';

// Repère de 200 × 300 (viewBox décalée vers le haut pour la casquette). [élément, attributs]
const CORPS = [
  ['rect', { x: 86, y: 14, width: 28, height: 11, rx: 3 }], // plot de la tête
  ['rect', { x: 66, y: 22, width: 68, height: 58, rx: 16 }], // tête
  ['rect', { x: 88, y: 78, width: 24, height: 11 }], // cou
  ['polygon', { points: '70,88 130,88 135,92 142,170 58,170 65,92' }], // torse
  ['polygon', { points: '66,92 54,96 42,158 56,162 64,122' }], // bras gauche
  ['polygon', { points: '134,92 146,96 158,158 144,162 136,122' }], // bras droit
  ['circle', { cx: 48, cy: 172, r: 10 }], // main gauche
  ['circle', { cx: 152, cy: 172, r: 10 }], // main droite
  ['rect', { x: 58, y: 170, width: 84, height: 16, rx: 2 }], // hanches
  ['rect', { x: 58, y: 186, width: 41, height: 66, rx: 2 }], // jambe gauche
  ['rect', { x: 101, y: 186, width: 41, height: 66, rx: 2 }], // jambe droite
  ['rect', { x: 56, y: 250, width: 45, height: 18, rx: 4 }], // pied gauche
  ['rect', { x: 99, y: 250, width: 45, height: 18, rx: 4 }], // pied droit
];

const TORSE = ['polygon', { points: '70,88 130,88 135,92 142,170 58,170 65,92' }];
const MANCHES_LONGUES = [
  ['polygon', { points: '66,92 54,96 42,158 56,162 64,122' }],
  ['polygon', { points: '134,92 146,96 158,158 144,162 136,122' }],
];

export const FORMES = {
  pantalon: [['rect', { x: 58, y: 170, width: 84, height: 16, rx: 2 }],
    ['rect', { x: 58, y: 186, width: 41, height: 66, rx: 2 }], ['rect', { x: 101, y: 186, width: 41, height: 66, rx: 2 }]],
  short: [['rect', { x: 58, y: 170, width: 84, height: 16, rx: 2 }],
    ['rect', { x: 58, y: 186, width: 41, height: 26, rx: 2 }], ['rect', { x: 101, y: 186, width: 41, height: 26, rx: 2 }]],
  chaussures: [['rect', { x: 56, y: 250, width: 45, height: 18, rx: 4 }], ['rect', { x: 99, y: 250, width: 45, height: 18, rx: 4 }]],
  't-shirt': [TORSE,
    ['polygon', { points: '66,92 54,96 50,118 62,121' }], ['polygon', { points: '134,92 146,96 150,118 138,121' }]],
  pull: [TORSE, ...MANCHES_LONGUES],
  ceinture: [['rect', { x: 58, y: 166, width: 84, height: 8, rx: 1 }]],
  chemise: [['polygon', { points: '70,88 93,88 93,170 58,170 65,92' }], ['polygon', { points: '107,88 130,88 135,92 142,170 107,170' }],
    ...MANCHES_LONGUES,
    ['polygon', { points: '87,88 99,88 93,101' }], ['polygon', { points: '101,88 113,88 107,101' }]], // col
  veste: [['polygon', { points: '70,88 88,88 84,120 86,170 58,170 65,92' }], ['polygon', { points: '112,88 130,88 135,92 142,170 114,170 116,120' }],
    ...MANCHES_LONGUES],
  manteau: [['polygon', { points: '68,86 84,86 80,122 80,232 54,232 58,170 63,92' }],
    ['polygon', { points: '116,86 132,86 137,92 142,170 146,232 120,232 120,122' }],
    ['polygon', { points: '65,90 52,95 40,158 57,163 63,124' }], ['polygon', { points: '135,90 148,95 160,158 143,163 137,124' }]],
  bijoux: [['path', { d: 'M86,90 Q100,108 114,90', trait: 3.5 }]],
  chapeau: [['path', { d: 'M64,30 Q64,4 100,4 Q136,4 136,30 Z' }], ['rect', { x: 58, y: 28, width: 84, height: 8, rx: 3 }]],
};

// Reflets clairs posés par-dessus (aspect plastique) : zones de lumière sur la tête, le torse et les jambes.
const REFLETS = [
  ['rect', { x: 72, y: 28, width: 11, height: 46, rx: 5, opacity: 0.22 }],
  ['polygon', { points: '73,93 83,93 76,164 66,164', opacity: 0.16 }],
  ['rect', { x: 62, y: 190, width: 7, height: 56, rx: 3, opacity: 0.14 }],
  ['rect', { x: 105, y: 190, width: 7, height: 56, rx: 3, opacity: 0.14 }],
];

// Ordre de dessin, du dessous vers le dessus (couches du haut dans l'ordre de CLAUDE.md).
export const ORDRE_DESSIN = ['pantalon', 'short', 'chaussures', 't-shirt', 'pull', 'ceinture', 'chemise', 'veste', 'manteau', 'bijoux', 'chapeau'];

// Pièces d'une proposition du moteur → { type, hex } (vêtement porté) ou { type, hachures: hex | 'joker' } (manque).
export function planAvatar(proposition, catalogue) {
  return proposition.pieces.map((piece) => {
    if (piece.manque) {
      return { type: piece.type, hachures: piece.couleurId ? catalogue.couleurParId.get(piece.couleurId).hex : 'joker' };
    }
    return { type: piece.type, hex: piece.vetement.hex };
  });
}

function noeud(nom, attributs = {}) {
  const element = document.createElementNS(NS, nom);
  for (const [cle, valeur] of Object.entries(attributs)) element.setAttribute(cle, String(valeur));
  return element;
}

let compteur = 0;

// Dessine l'avatar : peau (hex MST) et pièces [{ type, hex } | { type, hachures }]. Renvoie un élément <svg>.
export function dessinerAvatar({ peau, pieces = [], description = 'Avatar' }) {
  const prefixe = `avatar-${++compteur}`;
  const svg = noeud('svg', { viewBox: '0 -2 200 274', role: 'img', 'aria-label': description, class: 'avatar' });
  const definitions = noeud('defs');
  svg.append(definitions);

  function motifHachures(type, couleur) {
    const id = `${prefixe}-${type}`;
    const motif = noeud('pattern', { id, patternUnits: 'userSpaceOnUse', width: 8, height: 8, patternTransform: 'rotate(45)' });
    motif.append(noeud('rect', { width: 8, height: 8, fill: FOND_HACHURES }), noeud('rect', { width: 4, height: 8, fill: couleur === 'joker' ? NOIR_JOKER : couleur }));
    definitions.append(motif);
    return `url(#${id})`;
  }

  const corps = noeud('g', { 'data-zone': 'peau' });
  for (const [forme, attributs] of CORPS) corps.append(noeud(forme, { ...attributs, fill: peau, stroke: CONTOUR, 'stroke-width': 1, 'data-zone': 'peau' }));
  svg.append(corps);

  // Visage et creux des mains : traits foncés sur peau claire, clairs sur peau foncée.
  const trait = labDepuisHex(peau).L < 45 ? TRAIT_CLAIR : TRAIT_FONCE;
  const visage = noeud('g', { 'data-zone': 'visage' });
  visage.append(
    noeud('ellipse', { cx: 88, cy: 48, rx: 3.4, ry: 4, fill: trait }),
    noeud('ellipse', { cx: 112, cy: 48, rx: 3.4, ry: 4, fill: trait }),
    noeud('path', { d: 'M86,60 Q100,72 114,60', fill: 'none', stroke: trait, 'stroke-width': 3, 'stroke-linecap': 'round' }),
    noeud('ellipse', { cx: 49, cy: 175, rx: 4.5, ry: 5, fill: 'rgba(0, 0, 0, 0.28)' }),
    noeud('ellipse', { cx: 151, cy: 175, rx: 4.5, ry: 5, fill: 'rgba(0, 0, 0, 0.28)' }));
  svg.append(visage);

  const parType = new Map(pieces.map((piece) => [piece.type, piece]));
  for (const type of ORDRE_DESSIN) {
    const piece = parType.get(type);
    if (!piece) continue;
    const remplissage = piece.hachures !== undefined ? motifHachures(type, piece.hachures) : piece.hex;
    const groupe = noeud('g', { 'data-type': type, 'data-etat': piece.hachures !== undefined ? 'manque' : 'porte' });
    for (const [forme, { trait: epaisseur, ...attributs }] of FORMES[type]) {
      groupe.append(epaisseur
        ? noeud(forme, { ...attributs, fill: 'none', stroke: remplissage, 'stroke-width': epaisseur, 'stroke-linecap': 'round' })
        : noeud(forme, { ...attributs, fill: remplissage, stroke: CONTOUR, 'stroke-width': 1, 'stroke-linejoin': 'round' }));
    }
    svg.append(groupe);
  }

  const reflets = noeud('g', { 'data-zone': 'reflet', 'pointer-events': 'none' });
  for (const [forme, attributs] of REFLETS) reflets.append(noeud(forme, { ...attributs, fill: '#ffffff' }));
  svg.append(reflets);
  return svg;
}
