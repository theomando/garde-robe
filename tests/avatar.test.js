import { test, vrai, egal, egalProfond } from './mini-test.js';
import { dessinerAvatar, planAvatar, FORMES, ORDRE_DESSIN } from '../js/avatar.js';

// Point dans un polygone (tracé de rayon) : sert à vérifier ce que couvrent les pans des vêtements ouverts.
function dansPolygone([x, y], points) {
  const p = points.trim().split(/\s+/).map((c) => c.split(',').map(Number));
  let dedans = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const [xi, yi] = p[i];
    const [xj, yj] = p[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) dedans = !dedans;
  }
  return dedans;
}
const couvre = (type, point) => FORMES[type].some(([forme, a]) => forme === 'polygon' && dansPolygone(point, a.points));

test('avatar : peau à la teinte MST, une zone par pièce portée, rien d\'autre', () => {
  const svg = dessinerAvatar({ peau: '#d7bd96', pieces: [{ type: 'pantalon', hex: '#111314' }, { type: 'pull', hex: '#ae5224' }] });
  const peau = [...svg.querySelectorAll('[data-zone="peau"]:not(g)')];
  vrai(peau.length > 0 && peau.every((forme) => forme.getAttribute('fill') === '#d7bd96'), 'toute la peau en MST');
  vrai([...svg.querySelectorAll('g[data-type="pantalon"] > *')].every((f) => f.getAttribute('fill') === '#111314'), 'pantalon');
  vrai([...svg.querySelectorAll('g[data-type="pull"] > *')].every((f) => f.getAttribute('fill') === '#ae5224'), 'pull');
  egalProfond([...svg.querySelectorAll('g[data-type]')].map((g) => g.dataset.type), ['pantalon', 'pull'], 'seulement les pièces portées');
  egal(svg.getAttribute('role'), 'img');
});

test('avatar : couches dessinées du corps vers l\'extérieur (t-shirt, pull, chemise, veste, manteau)', () => {
  const couches = ['manteau', 'chemise', 't-shirt', 'veste', 'pull'];
  const svg = dessinerAvatar({ peau: '#d7bd96', pieces: couches.map((type) => ({ type, hex: '#808080' })) });
  egalProfond([...svg.querySelectorAll('g[data-type]')].map((g) => g.dataset.type), ['t-shirt', 'pull', 'chemise', 'veste', 'manteau']);
  vrai(ORDRE_DESSIN.indexOf('ceinture') > ORDRE_DESSIN.indexOf('pull'), 'ceinture visible par-dessus le pull');
});

test('avatar : chemise, veste et manteau ouverts, la couche du dessous reste visible au centre', () => {
  for (const hauteur of [110, 150]) {
    vrai(couvre('pull', [100, hauteur]) && couvre('t-shirt', [100, hauteur]), `t-shirt et pull couvrent le centre (y ${hauteur})`);
    for (const ouvert of ['chemise', 'veste', 'manteau']) vrai(!couvre(ouvert, [100, hauteur]), `${ouvert} ouvert au centre (y ${hauteur})`);
    vrai(couvre('chemise', [80, hauteur]) && couvre('veste', [76, hauteur]) && couvre('manteau', [72, hauteur]), `pans sur les côtés (y ${hauteur})`);
  }
  vrai(couvre('manteau', [70, 220]) && !couvre('veste', [70, 220]), 'le manteau descend sur les jambes, pas la veste');
  vrai(!couvre('manteau', [83, 120]) && couvre('veste', [83, 120]), 'le manteau, plus ouvert, laisse voir les revers de la veste');
});

test('avatar : pièce manquante hachurée dans la couleur manquante, joker manquant en noir et blanc', () => {
  const svg = dessinerAvatar({ peau: '#d7bd96', pieces: [{ type: 'chaussures', hachures: '#ae5224' }, { type: 'pull', hachures: 'joker' }, { type: 'bijoux', hachures: '#f9c1ce' }] });
  const motif = (type) => {
    const groupe = svg.querySelector(`g[data-type="${type}"]`);
    egal(groupe.dataset.etat, 'manque');
    const forme = groupe.firstElementChild;
    const reference = (forme.getAttribute('fill') === 'none' ? forme.getAttribute('stroke') : forme.getAttribute('fill')).match(/^url\(#(.+)\)$/)[1];
    return [...svg.getElementById(reference).querySelectorAll('rect')].map((r) => r.getAttribute('fill'));
  };
  egalProfond(motif('chaussures'), ['#ffffff', '#ae5224']);
  egalProfond(motif('pull'), ['#ffffff', '#000000']);
  egalProfond(motif('bijoux'), ['#ffffff', '#f9c1ce'], 'collier : trait hachuré');
  const ids = [...svg.querySelectorAll('pattern')].map((p) => p.id);
  egal(new Set(ids).size, ids.length, 'motifs à identifiant unique');
  const autre = dessinerAvatar({ peau: '#d7bd96', pieces: [{ type: 'chaussures', hachures: '#ae5224' }] });
  vrai(autre.querySelector('pattern').id !== svg.querySelector('pattern').id, 'deux avatars ne partagent pas leurs motifs');
});

test('avatar : plan tiré d\'une proposition du moteur (vêtement porté, manque coloré, manque joker)', () => {
  const catalogue = { couleurParId: new Map([['c1', { hex: '#ae5224' }]]) };
  const proposition = {
    pieces: [
      { type: 'pantalon', couleurId: null, joker: true, manque: false, vetement: { hex: '#111314' } },
      { type: 'pull', couleurId: 'c1', joker: false, manque: false, vetement: { hex: '#b05a2a' } },
      { type: 'chaussures', couleurId: 'c1', joker: false, manque: true, vetement: null },
      { type: 'ceinture', couleurId: null, joker: true, manque: true, vetement: null },
    ],
  };
  egalProfond(planAvatar(proposition, catalogue), [
    { type: 'pantalon', hex: '#111314' },
    { type: 'pull', hex: '#b05a2a' },
    { type: 'chaussures', hachures: '#ae5224' },
    { type: 'ceinture', hachures: 'joker' },
  ]);
});
