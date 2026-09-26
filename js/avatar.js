// Avatar 2D (SVG) en style figurine à blocs (demande de Théo, 2026-09-26) : tête cylindrique à plot, torse
// en trapèze, bras le long du corps, mains en pince, hanches et jambes en blocs. Dessin original, sans marque.
// Relief simulé (demandes du 2026-09-26) : lumière venant du haut à gauche ; épaisseur de chaque pièce (tranche
// sombre décalée vers la droite et le bas) ; calques d'ombrage translucides (blocs, cylindres, sphères) ; ombres de
// contact entre les pièces ; ombres des pans ouverts sur la couche du dessous ; ombre portée et ombre au sol.
// La peau prend la teinte MST choisie ; une zone par type de vêtement porté.
// Couches du haut, du corps vers l'extérieur : t-shirt, pull, chemise, veste, manteau. Chemise, veste et manteau
// sont « imprimés » ouverts sur le torse : la couche du dessous reste visible au centre. Ceinture, chapeau et bijoux
// sont toujours visibles. Pièce en manque : dessinée dans la couleur manquante (noir pour un joker), avec un petit
// panneau d'avertissement posé dessus (demande de Théo, 2026-09-26, à la place des hachures).
// Couleurs d'interface (contours, ombrages, reflets, traits du visage, panneau) : choix graphiques.

import { labDepuisHex } from './couleur.js';

const NS = 'http://www.w3.org/2000/svg';
const CONTOUR = 'rgba(0, 0, 0, 0.45)';
const NOIR_JOKER = '#000000';
const TRAIT_FONCE = '#1d1d1b';
const TRAIT_CLAIR = '#f2f2f0';
const JAUNE_AVERTISSEMENT = '#f2c200';
const EPAISSEUR = { dx: 4, dy: 2.5, ombre: 0.42 }; // tranche visible à droite et en bas

// Repère de 200 × 300. [élément, attributs, ombrage] ; ombrage : 'bloc' (par défaut), 'cylindre', 'sphere' ou 'cou'.
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

// Où poser le panneau d'avertissement d'une pièce manquante.
const ANCRES_AVERTISSEMENT = {
  chaussures: [122, 259], pantalon: [121, 222], short: [121, 199], 't-shirt': [100, 128], pull: [100, 128],
  ceinture: [100, 170], chemise: [78, 128], veste: [72, 150], manteau: [67, 205], bijoux: [100, 100], chapeau: [100, 16],
};

// Ombres que les pans ouverts projettent sur la couche du dessous (dessinées juste avant les pans).
const OMBRES_PANS = {
  chemise: [['polygon', { points: '93,88 99,88 99,170 93,170' }, 'ombreGauche'], ['polygon', { points: '101,88 107,88 107,170 101,170' }, 'ombreDroite']],
  veste: [['polygon', { points: '88,88 96,88 92,120 94,170 86,170 84,120' }, 'ombreGauche'],
    ['polygon', { points: '104,88 112,88 116,120 114,170 106,170 108,120' }, 'ombreDroite']],
  manteau: [['polygon', { points: '84,86 92,86 88,122 88,232 80,232 80,122' }, 'ombreGauche'],
    ['polygon', { points: '108,86 116,86 120,122 120,232 112,232 112,122' }, 'ombreDroite']],
};

// Ombres de contact : là où une pièce touche la suivante (sous la tête, sous le torse, en haut des jambes).
const OMBRES_CONTACT = [
  ['ellipse', { cx: 101, cy: 90, rx: 27, ry: 6 }, 'contact'],
  ['rect', { x: 58, y: 170, width: 84, height: 6 }, 'contactHaut'],
  ['rect', { x: 58, y: 186, width: 84, height: 7 }, 'contactHaut'],
];

// Reflets brillants (aspect plastique) : tête, dessus du plot, torse, jambes.
const REFLETS = [
  ['rect', { x: 72, y: 28, width: 10, height: 44, rx: 5, opacity: 0.32 }],
  ['ellipse', { cx: 97, cy: 16.5, rx: 8, ry: 2, opacity: 0.45 }],
  ['polygon', { points: '73,93 81,93 75,164 67,164', opacity: 0.2 }],
  ['rect', { x: 62, y: 190, width: 6, height: 56, rx: 3, opacity: 0.18 }],
  ['rect', { x: 105, y: 190, width: 6, height: 56, rx: 3, opacity: 0.18 }],
];

// Ordre de dessin, du dessous vers le dessus (couches du haut dans l'ordre de CLAUDE.md).
export const ORDRE_DESSIN = ['pantalon', 'short', 'chaussures', 't-shirt', 'pull', 'ceinture', 'chemise', 'veste', 'manteau', 'bijoux', 'chapeau'];

// Pièces d'une proposition du moteur → { type, hex, manque }. Une pièce manquante prend la couleur qui manque
// (noir pour un joker : « noir avant blanc »).
export function planAvatar(proposition, catalogue) {
  return proposition.pieces.map((piece) => {
    if (piece.manque) {
      return { type: piece.type, hex: piece.couleurId ? catalogue.couleurParId.get(piece.couleurId).hex : NOIR_JOKER, manque: true };
    }
    return { type: piece.type, hex: piece.vetement.hex, manque: false };
  });
}

function noeud(nom, attributs = {}) {
  const element = document.createElementNS(NS, nom);
  for (const [cle, valeur] of Object.entries(attributs)) element.setAttribute(cle, String(valeur));
  return element;
}

// Dégradés d'ombrage (unités de la boîte de chaque forme).
const DEGRADES = {
  bloc: { x2: 1, arrets: [[0, '#ffffff', 0.3], [0.3, '#ffffff', 0.08], [0.6, '#000000', 0], [1, '#000000', 0.42]] },
  cylindre: { x2: 1, arrets: [[0, '#000000', 0.28], [0.18, '#ffffff', 0.36], [0.42, '#ffffff', 0.08], [0.72, '#000000', 0.12], [1, '#000000', 0.5]] },
  cou: { y2: 1, arrets: [[0, '#000000', 0.38], [1, '#000000', 0.12]] },
  ombreGauche: { x2: 1, arrets: [[0, '#000000', 0.5], [1, '#000000', 0]] },
  ombreDroite: { x1: 1, x2: 0, arrets: [[0, '#000000', 0.5], [1, '#000000', 0]] },
  contactHaut: { y2: 1, arrets: [[0, '#000000', 0.4], [1, '#000000', 0]] },
};

let compteur = 0;

// Dessine l'avatar : peau (hex MST) et pièces [{ type, hex, manque? }]. Renvoie un élément <svg>.
export function dessinerAvatar({ peau, pieces = [], description = 'Avatar' }) {
  const prefixe = `avatar-${++compteur}`;
  const svg = noeud('svg', { viewBox: '0 -2 200 284', role: 'img', 'aria-label': description, class: 'avatar' });
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
  const radial = (nom, arrets, attributs) => {
    const degrade = noeud('radialGradient', { id: id(nom), ...attributs });
    for (const [position, couleur, opacite] of arrets) degrade.append(noeud('stop', { offset: position, 'stop-color': couleur, 'stop-opacity': opacite }));
    definitions.append(degrade);
  };
  radial('sphere', [[0, '#ffffff', 0.45], [0.5, '#ffffff', 0], [1, '#000000', 0.45]], { cx: 0.35, cy: 0.35, r: 0.75 });
  radial('contact', [[0, '#000000', 0.45], [1, '#000000', 0]], { cx: 0.5, cy: 0.35, r: 0.6 });

  // Ombre portée : flou décalé de la silhouette, sous la figurine.
  const ombrePortee = noeud('filter', { id: id('ombre-portee'), x: '-20%', y: '-10%', width: '150%', height: '130%' });
  const transparence = noeud('feComponentTransfer');
  transparence.append(noeud('feFuncA', { type: 'linear', slope: 0.38 }));
  const fusion = noeud('feMerge');
  fusion.append(noeud('feMergeNode'), noeud('feMergeNode', { in: 'SourceGraphic' }));
  ombrePortee.append(noeud('feGaussianBlur', { in: 'SourceAlpha', stdDeviation: 3.2 }), noeud('feOffset', { dx: 5, dy: 5 }), transparence, fusion);
  const flou = noeud('filter', { id: id('flou'), x: '-20%', y: '-200%', width: '140%', height: '500%' });
  flou.append(noeud('feGaussianBlur', { stdDeviation: 2.5 }));
  definitions.append(ombrePortee, flou);

  const formesPleines = (formes) => formes.filter(([, attributs]) => !attributs.trait);

  // Épaisseur : chaque forme recopiée, décalée vers la droite et le bas, dans sa couleur puis assombrie.
  function epaisseur(formes, couleur, attributsGroupe) {
    const groupe = noeud('g', { ...attributsGroupe, transform: `translate(${EPAISSEUR.dx} ${EPAISSEUR.dy})`, 'pointer-events': 'none' });
    for (const [forme, attributs] of formesPleines(formes)) {
      groupe.append(noeud(forme, { ...attributs, fill: couleur, stroke: CONTOUR, 'stroke-width': 1 }));
    }
    for (const [forme, attributs] of formesPleines(formes)) {
      groupe.append(noeud(forme, { ...attributs, fill: '#000000', opacity: EPAISSEUR.ombre }));
    }
    return groupe;
  }

  // Calques d'ombrage : copies translucides des formes, sans contour, posées par-dessus.
  function calqueOmbrage(formes, attributsGroupe) {
    const calque = noeud('g', { ...attributsGroupe, 'pointer-events': 'none' });
    for (const [forme, attributs, ombrage = 'bloc'] of formesPleines(formes)) {
      calque.append(noeud(forme, { ...attributs, fill: `url(#${id(ombrage)})` }));
    }
    return calque;
  }

  function panneau(type) {
    const [x, y] = ANCRES_AVERTISSEMENT[type];
    const groupe = noeud('g', { 'data-avertissement': type, transform: `translate(${x - 11} ${y - 10})` });
    groupe.append(
      noeud('polygon', { points: '11,0 22,19 0,19', fill: JAUNE_AVERTISSEMENT, stroke: TRAIT_FONCE, 'stroke-width': 1.5, 'stroke-linejoin': 'round' }),
      noeud('rect', { x: 10, y: 5.5, width: 2, height: 7, rx: 1, fill: TRAIT_FONCE }),
      noeud('circle', { cx: 11, cy: 15.3, r: 1.3, fill: TRAIT_FONCE }));
    return groupe;
  }

  svg.append(noeud('ellipse', { cx: 104, cy: 272, rx: 52, ry: 5.5, fill: '#000000', opacity: 0.28, filter: `url(#${id('flou')})`, 'data-zone': 'sol' }));
  const figure = noeud('g', { filter: `url(#${id('ombre-portee')})`, 'data-zone': 'figure' });
  svg.append(figure);

  // Corps : épaisseur, fente sombre entre les jambes, formes à la teinte MST, ombrage.
  figure.append(epaisseur(CORPS, peau, { 'data-zone': 'epaisseur' }));
  figure.append(noeud('rect', { x: 97, y: 186, width: 6, height: 66, fill: 'rgba(0, 0, 0, 0.6)', 'data-zone': 'fente' }));
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
    noeud('ellipse', { cx: 49, cy: 175, rx: 4.5, ry: 5, fill: 'rgba(0, 0, 0, 0.4)' }),
    noeud('ellipse', { cx: 151, cy: 175, rx: 4.5, ry: 5, fill: 'rgba(0, 0, 0, 0.4)' }));
  figure.append(visage);

  const parType = new Map(pieces.map((piece) => [piece.type, piece]));
  const manquantes = [];
  for (const type of ORDRE_DESSIN) {
    if (type === 'bijoux') figure.append(calqueOmbrage(OMBRES_CONTACT, { 'data-zone': 'contact' }));
    const piece = parType.get(type);
    if (!piece) continue;
    if (piece.manque) manquantes.push(type);
    if (OMBRES_PANS[type]) figure.append(calqueOmbrage(OMBRES_PANS[type], { 'data-ombre-pans': type }));
    if (type !== 'bijoux') figure.append(epaisseur(FORMES[type], piece.hex, { 'data-epaisseur': type }));
    const groupe = noeud('g', { 'data-type': type, 'data-etat': piece.manque ? 'manque' : 'porte' });
    for (const [forme, { trait: largeur, ...attributs }] of FORMES[type]) {
      groupe.append(largeur
        ? noeud(forme, { ...attributs, fill: 'none', stroke: piece.hex, 'stroke-width': largeur, 'stroke-linecap': 'round' })
        : noeud(forme, { ...attributs, fill: piece.hex, stroke: CONTOUR, 'stroke-width': 1, 'stroke-linejoin': 'round' }));
    }
    figure.append(groupe, calqueOmbrage(FORMES[type], { 'data-ombrage': type }));
  }

  const reflets = noeud('g', { 'data-zone': 'reflet', 'pointer-events': 'none' });
  for (const [forme, attributs] of REFLETS) reflets.append(noeud(forme, { ...attributs, fill: '#ffffff' }));
  figure.append(reflets);
  // Panneaux d'avertissement par-dessus tout, hors de l'ombre portée.
  for (const type of manquantes) svg.append(panneau(type));
  return svg;
}
