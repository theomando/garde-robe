// Avatar 2D (SVG) en style figurine à blocs (demande de Théo, 2026-09-26) : tête cylindrique à plot, torse
// en trapèze, bras le long du corps, mains en pince, hanches et jambes en blocs. Dessin original, sans marque.
// Profondeur simulée (demande du 2026-09-26) : lumière venant du haut à gauche, calques d'ombrage translucides
// posés sur chaque pièce (blocs, cylindres, sphères), ombres des pans ouverts sur la couche du dessous,
// ombre portée de la figurine et ombre au sol. Les calques marchent avec toute couleur, hachures comprises.
// La peau prend la teinte MST choisie ; une zone par type de vêtement porté.
// Couches du haut, du corps vers l'extérieur : t-shirt, pull, chemise, veste, manteau. Chemise, veste et manteau
// sont « imprimés » ouverts sur le torse : la couche du dessous reste visible au centre. Ceinture, chapeau et bijoux
// sont toujours visibles. Pièce en manque : hachurée dans la couleur manquante (noir et blanc pour un joker).
// Couleurs d'interface (contours, ombrages, reflets, traits du visage, fond des hachures) : choix graphiques.

import { labDepuisHex } from './couleur.js';

const NS = 'http://www.w3.org/2000/svg';
const CONTOUR = 'rgba(0, 0, 0, 0.4)';
const FOND_HACHURES = '#ffffff';
const NOIR_JOKER = '#000000';
const TRAIT_FONCE = '#1d1d1b';
const TRAIT_CLAIR = '#f2f2f0';

// Repère de 200 × 300. [élément, attributs, ombrage] ; ombrage : 'bloc' (par défaut), 'cylindre' ou 'sphere'.
const CORPS = [
  ['rect', { x: 86, y: 14, width: 28, height: 11, rx: 3 }, 'cylindre'], // plot de la tête
  ['rect', { x: 66, y: 22, width: 68, height: 58, rx: 16 }, 'cylindre'], // tête
  ['rect', { x: 88, y: 78, width: 24, height: 11 }, 'cou'], // cou, dans l'ombre de la tête
  ['polygon', { points: '70,88 130,88 135,92 142,170 58,170 65,92' }], // torse
  ['polygon', { points: '66,92 54,96 42,158 56,162 64,122' }], // bras gauche
  ['polygon', { points: '134,92 146,96 158,158 144,162 136,122' }], // bras droit
  ['circle', { cx: 48, cy: 172, r: 10 }, 'sphere'], // main gauche
  ['circle', { cx: 152, cy: 172, r: 10 }, 'sphere'], // main droite
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
  chapeau: [['path', { d: 'M64,30 Q64,4 100,4 Q136,4 136,30 Z' }, 'cylindre'], ['rect', { x: 58, y: 28, width: 84, height: 8, rx: 3 }]],
};

// Ombres que les pans ouverts projettent sur la couche du dessous (dessinées juste avant les pans).
const OMBRES_PANS = {
  chemise: [['polygon', { points: '93,88 98,88 98,170 93,170' }, 'ombreGauche'], ['polygon', { points: '102,88 107,88 107,170 102,170' }, 'ombreDroite']],
  veste: [['polygon', { points: '88,88 95,88 91,120 93,170 86,170 84,120' }, 'ombreGauche'],
    ['polygon', { points: '105,88 112,88 116,120 114,170 107,170 109,120' }, 'ombreDroite']],
  manteau: [['polygon', { points: '84,86 91,86 87,122 87,232 80,232 80,122' }, 'ombreGauche'],
    ['polygon', { points: '109,86 116,86 120,122 120,232 113,232 113,122' }, 'ombreDroite']],
};

// Reflets brillants (aspect plastique) sur la tête, le torse et les jambes.
const REFLETS = [
  ['rect', { x: 72, y: 28, width: 10, height: 44, rx: 5, opacity: 0.28 }],
  ['polygon', { points: '73,93 81,93 75,164 67,164', opacity: 0.16 }],
  ['rect', { x: 62, y: 190, width: 6, height: 56, rx: 3, opacity: 0.14 }],
  ['rect', { x: 105, y: 190, width: 6, height: 56, rx: 3, opacity: 0.14 }],
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

// Dégradés d'ombrage (unités de la boîte de chaque forme) : blanc à gauche, noir à droite, en translucide.
const DEGRADES = {
  bloc: { x2: 1, arrets: [[0, '#ffffff', 0.24], [0.35, '#ffffff', 0.05], [0.62, '#000000', 0], [1, '#000000', 0.3]] },
  cylindre: { x2: 1, arrets: [[0, '#000000', 0.22], [0.2, '#ffffff', 0.3], [0.45, '#ffffff', 0.06], [0.75, '#000000', 0.08], [1, '#000000', 0.38]] },
  cou: { y2: 1, arrets: [[0, '#000000', 0.32], [1, '#000000', 0.08]] },
  ombreGauche: { x2: 1, arrets: [[0, '#000000', 0.38], [1, '#000000', 0]] },
  ombreDroite: { x1: 1, x2: 0, arrets: [[0, '#000000', 0.38], [1, '#000000', 0]] },
};

let compteur = 0;

// Dessine l'avatar : peau (hex MST) et pièces [{ type, hex } | { type, hachures }]. Renvoie un élément <svg>.
export function dessinerAvatar({ peau, pieces = [], description = 'Avatar' }) {
  const prefixe = `avatar-${++compteur}`;
  const svg = noeud('svg', { viewBox: '0 -2 200 282', role: 'img', 'aria-label': description, class: 'avatar' });
  const definitions = noeud('defs');
  svg.append(definitions);
  const id = (nom) => `${prefixe}-${nom}`;

  for (const [nom, { x1 = 0, y1 = 0, x2 = 0, y2 = 0, arrets }] of Object.entries(DEGRADES)) {
    const degrade = noeud('linearGradient', { id: id(nom), x1, y1, x2, y2 });
    for (const [position, couleur, opacite] of arrets) {
      degrade.append(noeud('stop', { offset: position, 'stop-color': couleur, 'stop-opacity': opacite }));
    }
    definitions.append(degrade);
  }
  const sphere = noeud('radialGradient', { id: id('sphere'), cx: 0.35, cy: 0.35, r: 0.75 });
  sphere.append(noeud('stop', { offset: 0, 'stop-color': '#ffffff', 'stop-opacity': 0.35 }),
    noeud('stop', { offset: 0.55, 'stop-color': '#ffffff', 'stop-opacity': 0 }),
    noeud('stop', { offset: 1, 'stop-color': '#000000', 'stop-opacity': 0.35 }));
  // Ombre portée : flou décalé de la silhouette, sous la figurine.
  const ombrePortee = noeud('filter', { id: id('ombre-portee'), x: '-20%', y: '-10%', width: '140%', height: '130%' });
  const transparence = noeud('feComponentTransfer');
  transparence.append(noeud('feFuncA', { type: 'linear', slope: 0.28 }));
  const fusion = noeud('feMerge');
  fusion.append(noeud('feMergeNode'), noeud('feMergeNode', { in: 'SourceGraphic' }));
  ombrePortee.append(noeud('feGaussianBlur', { in: 'SourceAlpha', stdDeviation: 2.4 }), noeud('feOffset', { dx: 3, dy: 3 }), transparence, fusion);
  const flou = noeud('filter', { id: id('flou'), x: '-20%', y: '-200%', width: '140%', height: '500%' });
  flou.append(noeud('feGaussianBlur', { stdDeviation: 2.5 }));
  definitions.append(sphere, ombrePortee, flou);

  function motifHachures(type, couleur) {
    const motif = noeud('pattern', { id: id(type), patternUnits: 'userSpaceOnUse', width: 8, height: 8, patternTransform: 'rotate(45)' });
    motif.append(noeud('rect', { width: 8, height: 8, fill: FOND_HACHURES }), noeud('rect', { width: 4, height: 8, fill: couleur === 'joker' ? NOIR_JOKER : couleur }));
    definitions.append(motif);
    return `url(#${id(type)})`;
  }

  // Calques d'ombrage : copies translucides des formes, sans contour, posées par-dessus.
  function calqueOmbrage(formes, attributsGroupe) {
    const calque = noeud('g', { ...attributsGroupe, 'pointer-events': 'none' });
    for (const [forme, { trait, ...attributs }, ombrage = 'bloc'] of formes) {
      if (trait) continue;
      calque.append(noeud(forme, { ...attributs, fill: `url(#${id(ombrage)})` }));
    }
    return calque;
  }

  svg.append(noeud('ellipse', { cx: 100, cy: 271, rx: 50, ry: 5, fill: '#000000', opacity: 0.22, filter: `url(#${id('flou')})`, 'data-zone': 'sol' }));
  const figure = noeud('g', { filter: `url(#${id('ombre-portee')})`, 'data-zone': 'figure' });
  svg.append(figure);

  // Fente sombre entre les jambes (visible entre les deux blocs).
  figure.append(noeud('rect', { x: 97, y: 186, width: 6, height: 66, fill: 'rgba(0, 0, 0, 0.55)', 'data-zone': 'fente' }));
  const corps = noeud('g', { 'data-zone': 'peau' });
  for (const [forme, attributs] of CORPS) corps.append(noeud(forme, { ...attributs, fill: peau, stroke: CONTOUR, 'stroke-width': 1, 'data-zone': 'peau' }));
  figure.append(corps, calqueOmbrage(CORPS, { 'data-ombrage': 'peau' }));

  // Visage et creux des mains : traits foncés sur peau claire, clairs sur peau foncée.
  const trait = labDepuisHex(peau).L < 45 ? TRAIT_CLAIR : TRAIT_FONCE;
  const visage = noeud('g', { 'data-zone': 'visage' });
  visage.append(
    noeud('ellipse', { cx: 88, cy: 48, rx: 3.4, ry: 4, fill: trait }),
    noeud('ellipse', { cx: 112, cy: 48, rx: 3.4, ry: 4, fill: trait }),
    noeud('path', { d: 'M86,60 Q100,72 114,60', fill: 'none', stroke: trait, 'stroke-width': 3, 'stroke-linecap': 'round' }),
    noeud('ellipse', { cx: 49, cy: 175, rx: 4.5, ry: 5, fill: 'rgba(0, 0, 0, 0.35)' }),
    noeud('ellipse', { cx: 151, cy: 175, rx: 4.5, ry: 5, fill: 'rgba(0, 0, 0, 0.35)' }));
  figure.append(visage);

  const parType = new Map(pieces.map((piece) => [piece.type, piece]));
  for (const type of ORDRE_DESSIN) {
    const piece = parType.get(type);
    if (!piece) continue;
    if (OMBRES_PANS[type]) figure.append(calqueOmbrage(OMBRES_PANS[type], { 'data-ombre-pans': type }));
    const remplissage = piece.hachures !== undefined ? motifHachures(type, piece.hachures) : piece.hex;
    const groupe = noeud('g', { 'data-type': type, 'data-etat': piece.hachures !== undefined ? 'manque' : 'porte' });
    for (const [forme, { trait: epaisseur, ...attributs }] of FORMES[type]) {
      groupe.append(epaisseur
        ? noeud(forme, { ...attributs, fill: 'none', stroke: remplissage, 'stroke-width': epaisseur, 'stroke-linecap': 'round' })
        : noeud(forme, { ...attributs, fill: remplissage, stroke: CONTOUR, 'stroke-width': 1, 'stroke-linejoin': 'round' }));
    }
    figure.append(groupe, calqueOmbrage(FORMES[type], { 'data-ombrage': type }));
  }

  const reflets = noeud('g', { 'data-zone': 'reflet', 'pointer-events': 'none' });
  for (const [forme, attributs] of REFLETS) reflets.append(noeud(forme, { ...attributs, fill: '#ffffff' }));
  figure.append(reflets);
  return svg;
}
