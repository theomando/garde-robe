// Icônes de l'interface : dessins originaux au trait (grille 24 × 24), dans l'esprit des symboles d'iOS.
// Les symboles d'Apple (SF Symbols) ne sont autorisés que dans les apps des plateformes Apple : aucun n'est repris.
// Chaque icône : liste de [élément, attributs]. Trait « currentColor » ; 'plein' : forme remplie.

const NS = 'http://www.w3.org/2000/svg';

// Engrenage : 8 dents, calculé (rayons intérieur et extérieur alternés).
function engrenage() {
  const points = [];
  for (let i = 0; i < 32; i++) {
    const angle = (i / 32) * 2 * Math.PI;
    const r = [8.6, 8.6, 6.6, 6.6][i % 4];
    points.push(`${(12 + r * Math.cos(angle)).toFixed(2)},${(12 + r * Math.sin(angle)).toFixed(2)}`);
  }
  return [['polygon', { points: points.join(' '), 'stroke-linejoin': 'round' }], ['circle', { cx: 12, cy: 12, r: 2.8 }]];
}

const DESSINS = {
  // Onglets.
  cintre: [['path', { d: 'M10 5.6a2 2 0 1 1 3.1 1.7c-.7.4-1.1 1-1.1 1.7v.9' }],
    ['path', { d: 'M12 9.9 3.6 16c-.9.7-.5 2 .6 2h15.6c1.1 0 1.5-1.3.6-2L12 9.9Z' }]],
  sac: [['path', { d: 'M5.2 8h13.6l-1 12.5H6.2L5.2 8Z' }], ['path', { d: 'M9 10.5V7a3 3 0 0 1 6 0v3.5' }]],
  engrenage: engrenage(),
  // Actions.
  plus: [['path', { d: 'M12 5v14M5 12h14' }]],
  fermer: [['path', { d: 'M6.5 6.5l11 11M17.5 6.5l-11 11' }]],
  coche: [['path', { d: 'M5 12.5l4.5 4.5L19 7.5' }]],
  'chevron-gauche': [['path', { d: 'M15 4.5 7.5 12l7.5 7.5' }]],
  'chevron-droite': [['path', { d: 'M9 4.5 16.5 12 9 19.5' }]],
  camera: [['path', { d: 'M3.5 8.5c0-.8.7-1.5 1.5-1.5h2.6l1.6-2.2h5.6l1.6 2.2H19c.8 0 1.5.7 1.5 1.5v9c0 .8-.7 1.5-1.5 1.5H5c-.8 0-1.5-.7-1.5-1.5v-9Z' }],
    ['circle', { cx: 12, cy: 12.8, r: 3.6 }]],
  mosaique: [['rect', { x: 3.5, y: 3.5, width: 7.5, height: 7.5, rx: 2 }], ['rect', { x: 13, y: 3.5, width: 7.5, height: 7.5, rx: 2 }],
    ['rect', { x: 3.5, y: 13, width: 7.5, height: 7.5, rx: 2 }], ['rect', { x: 13, y: 13, width: 7.5, height: 7.5, rx: 2 }]],
  eclair: [['path', { d: 'M13.2 2.5 5 13.2h6.2l-1 8.3 8.3-10.8h-6.3l1-8.2Z', 'stroke-linejoin': 'round' }]],
  'eclair-plein': [['path', { d: 'M13.2 2.5 5 13.2h6.2l-1 8.3 8.3-10.8h-6.3l1-8.2Z', 'stroke-linejoin': 'round', plein: true }]],
  photo: [['rect', { x: 3.5, y: 5, width: 17, height: 14, rx: 2.5 }], ['path', { d: 'M3.8 16.5 8.5 12l3.8 3.6 2.3-2.1 5.2 4.6' }],
    ['circle', { cx: 15.5, cy: 9.3, r: 1.5 }]],
  aide: [['circle', { cx: 12, cy: 12, r: 9 }], ['path', { d: 'M9.6 9.6a2.5 2.5 0 1 1 3.6 2.2c-.7.4-1.2.9-1.2 1.7v.6' }],
    ['circle', { cx: 12, cy: 17, r: 0.4, plein: true }]],
  poubelle: [['path', { d: 'M4.5 6.5h15M9.5 6.5V4.8c0-.5.4-.8.8-.8h3.4c.4 0 .8.3.8.8v1.7M6.5 6.5l.9 13c.1.8.7 1.5 1.5 1.5h6.2c.8 0 1.4-.7 1.5-1.5l.9-13' }]],
  etoile: [['path', { d: 'M12 3.3l2.6 5.5 6 .8-4.4 4.1 1.1 5.9L12 16.7l-5.3 2.9 1.1-5.9-4.4-4.1 6-.8L12 3.3Z', 'stroke-linejoin': 'round' }]],
  'etoile-pleine': [['path', { d: 'M12 3.3l2.6 5.5 6 .8-4.4 4.1 1.1 5.9L12 16.7l-5.3 2.9 1.1-5.9-4.4-4.1 6-.8L12 3.3Z', 'stroke-linejoin': 'round', plein: true }]],
  recherche: [['circle', { cx: 10.5, cy: 10.5, r: 6 }], ['path', { d: 'M15 15l5 5' }]],
  // Types de vêtements.
  chaussures: [['path', { d: 'M3 16.5v-5.2c0-.5.4-.9.9-.8l3 .6 1.8 1.9 3-.6 1.7-3 1.5.2.8 3.2 4.4 1.3c1.1.3 1.9 1.3 1.9 2.4v.9Z' }],
    ['path', { d: 'M3 16.5V19h18v-2.5' }]],
  pantalon: [['path', { d: 'M7 3.5h10l1.6 17h-4.3L12 9.8 9.7 20.5H5.4L7 3.5Z' }], ['path', { d: 'M7.2 6.5h9.6' }]],
  short: [['path', { d: 'M6.5 5h11l1.8 11.5h-5.5L12 11l-1.8 5.5H4.7L6.5 5Z' }], ['path', { d: 'M6.2 8h11.6' }]],
  ceinture: [['path', { d: 'M2.5 10h19v4h-19z' }], ['rect', { x: 8.5, y: 8.5, width: 5.5, height: 7, rx: 1 }], ['path', { d: 'M11.2 12h3' }]],
  't-shirt': [['path', { d: 'M8.2 3.5 3.5 6l1.6 4.2 2.1-.9V20.5h9.6V9.3l2.1.9L20.5 6l-4.7-2.5c-.5 1.5-2 2.5-3.8 2.5s-3.3-1-3.8-2.5Z' }]],
  chemise: [['path', { d: 'M8 3.5 4 5.5 2.5 14l2.7.6L6.8 9v11.5h10.4V9l1.6 5.6 2.7-.6L20 5.5l-4-2-4 4.2-4-4.2Z' }],
    ['path', { d: 'M12 7.7v12.8M8 3.5l1.8 4.8L12 7.7l2.2.6L16 3.5' }]],
  pull: [['path', { d: 'M8.5 3.5 4.2 5.4 2.6 17.5h3.1l1.3-8v11h10v-11l1.3 8h3.1L19.8 5.4l-4.3-1.9c-.6 1.3-1.9 2.2-3.5 2.2s-2.9-.9-3.5-2.2Z' }],
    ['path', { d: 'M7 18.3h10' }]],
  veste: [['path', { d: 'M8 3.5 4.2 5.4 2.6 17.5h3.1l1.3-8v11h4.6V9L12 7.6l.4 1.4v11.5H17v-11l1.3 8h3.1L19.8 5.4 16 3.5l-4 4.1-4-4.1Z' }],
    ['path', { d: 'M8 3.5l2.3 6.3L12 7.6M16 3.5l-2.3 6.3L12 7.6' }]],
  manteau: [['path', { d: 'M8 3 4.2 4.9 2.6 15.5h3.1l1.3-6.3v12.3h4.6V9.2L12 7.2l.4 2v12.3H17V9.2l1.3 6.3h3.1L19.8 4.9 16 3l-4 4.2-4-4.2Z' }],
    ['path', { d: 'M7 13.5h10' }]],
  chapeau: [['path', { d: 'M7.3 15V9.6c0-1.5 1.1-2.7 2.5-2.7.8 0 1.4.5 2.2.5s1.4-.5 2.2-.5c1.4 0 2.5 1.2 2.5 2.7V15' }],
    ['path', { d: 'M2.5 15.3c2.4 1.4 5.8 2.2 9.5 2.2s7.1-.8 9.5-2.2' }], ['path', { d: 'M7.3 12.6h9.4' }]],
  bijoux: [['path', { d: 'M5 3.5c0 5.3 3.1 9.6 7 9.6s7-4.3 7-9.6' }], ['path', { d: 'M12 13.1l-2.3 3.4 2.3 3.6 2.3-3.6-2.3-3.4Z', 'stroke-linejoin': 'round' }]],
};

export const NOMS_ICONES = Object.keys(DESSINS);

// Élément <svg> de l'icône. Décorative (aria-hidden) sauf si un titre est donné.
export function icone(nom, { taille = 24, titre = null, classe = '' } = {}) {
  const dessin = DESSINS[nom];
  if (!dessin) throw new Error(`icône inconnue : ${nom}`);
  const svg = document.createElementNS(NS, 'svg');
  const attributs = {
    viewBox: '0 0 24 24', width: taille, height: taille, fill: 'none', stroke: 'currentColor',
    'stroke-width': 1.7, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', class: `icone ${classe}`.trim(),
    ...(titre ? { role: 'img', 'aria-label': titre } : { 'aria-hidden': 'true', focusable: 'false' }),
  };
  for (const [cle, valeur] of Object.entries(attributs)) svg.setAttribute(cle, String(valeur));
  for (const [forme, { plein, ...reste }] of dessin) {
    const noeud = document.createElementNS(NS, forme);
    for (const [cle, valeur] of Object.entries(reste)) noeud.setAttribute(cle, String(valeur));
    if (plein) noeud.setAttribute('fill', 'currentColor');
    svg.append(noeud);
  }
  return svg;
}
