// Avatar 2D (SVG) : silhouette neutre à la teinte MST choisie, une zone par type de vêtement porté.
// Couches du haut, du corps vers l'extérieur : t-shirt, pull, chemise, veste, manteau. Chemise, veste et manteau
// sont portés ouverts : leurs pans laissent voir la couche du dessous au centre. Ceinture, chapeau et bijoux
// sont toujours visibles. Pièce en manque : hachurée dans la couleur manquante (noir et blanc pour un joker).
// Couleurs d'interface (contours, fond des hachures) : choix graphiques.

const NS = 'http://www.w3.org/2000/svg';
const CONTOUR = 'rgba(0, 0, 0, 0.35)';
const FOND_HACHURES = '#ffffff';
const NOIR_JOKER = '#000000';

// Formes dans un repère de 200 × 320 (viewBox décalée pour le chapeau). [élément, attributs]
const CORPS = [
  ['ellipse', { cx: 100, cy: 38, rx: 19, ry: 22 }],
  ['rect', { x: 92, y: 56, width: 16, height: 14 }],
  ['polygon', { points: '62,72 138,72 132,168 68,168' }],
  ['polygon', { points: '68,160 132,160 134,192 66,192' }],
  ['polygon', { points: '62,72 50,78 38,184 50,188 66,100' }],
  ['polygon', { points: '138,72 150,78 162,184 150,188 134,100' }],
  ['ellipse', { cx: 44, cy: 194, rx: 7, ry: 9 }],
  ['ellipse', { cx: 156, cy: 194, rx: 7, ry: 9 }],
  ['polygon', { points: '67,188 99,188 96,294 76,294' }],
  ['polygon', { points: '101,188 133,188 124,294 104,294' }],
  ['ellipse', { cx: 84, cy: 300, rx: 12, ry: 6 }],
  ['ellipse', { cx: 116, cy: 300, rx: 12, ry: 6 }],
];

const manches = (gauche, droite) => [['polygon', { points: gauche }], ['polygon', { points: droite }]];

export const FORMES = {
  pantalon: [['polygon', { points: '65,158 135,158 128,294 103,294 100,196 97,294 72,294' }]],
  short: [['polygon', { points: '65,158 135,158 134,226 103,226 100,196 97,226 66,226' }]],
  chaussures: [['ellipse', { cx: 83, cy: 300, rx: 15, ry: 8 }], ['ellipse', { cx: 117, cy: 300, rx: 15, ry: 8 }]],
  't-shirt': [['polygon', { points: '60,70 140,70 134,172 66,172' }],
    ...manches('60,70 44,104 57,110 67,90', '140,70 156,104 143,110 133,90')],
  pull: [['polygon', { points: '59,69 141,69 135,174 65,174' }],
    ...manches('59,69 37,182 51,186 68,93', '141,69 163,182 149,186 132,93')],
  ceinture: [['rect', { x: 65, y: 158, width: 70, height: 9 }]],
  chemise: [['polygon', { points: '57,68 93,66 93,178 63,178' }], ['polygon', { points: '107,66 143,68 137,178 107,178' }],
    ...manches('57,68 36,182 50,187 67,94', '143,68 164,182 150,187 133,94')],
  veste: [['polygon', { points: '54,66 86,62 84,184 60,184' }], ['polygon', { points: '114,62 146,66 140,184 116,184' }],
    ...manches('54,66 34,182 49,188 66,96', '146,66 166,182 151,188 134,96')],
  manteau: [['polygon', { points: '51,64 80,60 80,246 54,246' }], ['polygon', { points: '120,60 149,64 146,246 120,246' }],
    ...manches('51,64 31,184 48,190 65,98', '149,64 169,184 152,190 135,98')],
  bijoux: [['path', { d: 'M89,66 Q100,88 111,66', trait: 3.5 }]],
  chapeau: [['ellipse', { cx: 100, cy: 20, rx: 34, ry: 6 }], ['path', { d: 'M80,20 Q80,-4 100,-4 Q120,-4 120,20 Z' }]],
};

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
  const svg = noeud('svg', { viewBox: '0 -12 200 332', role: 'img', 'aria-label': description, class: 'avatar' });
  const definitions = noeud('defs');
  svg.append(definitions);

  function motifHachures(type, couleur) {
    const id = `${prefixe}-${type}`;
    const motif = noeud('pattern', { id, patternUnits: 'userSpaceOnUse', width: 8, height: 8, patternTransform: 'rotate(45)' });
    const [fond, rayure] = couleur === 'joker' ? [FOND_HACHURES, NOIR_JOKER] : [FOND_HACHURES, couleur];
    motif.append(noeud('rect', { width: 8, height: 8, fill: fond }), noeud('rect', { width: 4, height: 8, fill: rayure }));
    definitions.append(motif);
    return `url(#${id})`;
  }

  const corps = noeud('g', { 'data-zone': 'peau' });
  for (const [forme, attributs] of CORPS) corps.append(noeud(forme, { ...attributs, fill: peau, stroke: CONTOUR, 'stroke-width': 0.8, 'data-zone': 'peau' }));
  svg.append(corps);

  const parType = new Map(pieces.map((piece) => [piece.type, piece]));
  for (const type of ORDRE_DESSIN) {
    const piece = parType.get(type);
    if (!piece) continue;
    const remplissage = piece.hachures !== undefined ? motifHachures(type, piece.hachures) : piece.hex;
    const groupe = noeud('g', { 'data-type': type, 'data-etat': piece.hachures !== undefined ? 'manque' : 'porte' });
    for (const [forme, { trait, ...attributs }] of FORMES[type]) {
      groupe.append(trait
        ? noeud(forme, { ...attributs, fill: 'none', stroke: remplissage, 'stroke-width': trait, 'stroke-linecap': 'round' })
        : noeud(forme, { ...attributs, fill: remplissage, stroke: CONTOUR, 'stroke-width': 0.8 }));
    }
    svg.append(groupe);
  }
  return svg;
}
