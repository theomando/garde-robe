// Tests de la carte des couleurs : rangement de chaque couleur du catalogue dans une seule famille.
// Témoins : couleurs nommées de Wada (data/wada.json), dont le nom dit la famille attendue.
import { test, vrai, egal, egalProfond } from './mini-test.js';
import { construireWada, fusionnerCatalogues } from '../js/catalogue.js';
import { labDepuisHex } from '../js/couleur.js';
import { FAMILLES, familleDe, grouperParFamille } from '../js/familles.js';

const wada = fusionnerCatalogues(construireWada(await (await fetch(new URL('../data/wada.json', import.meta.url))).json()));
const parNom = (nom) => wada.couleurs.find((c) => c.nom === nom);
const couleur = (hex) => ({ hex, lab: labDepuisHex(hex) });

test('familles : couleurs témoins du catalogue dans la famille attendue', () => {
  const temoins = {
    neutres: ['Black', 'White', 'Warm Gray', 'Neutral Gray', 'Mineral Gray'],
    beiges: ['Ecru', 'Fawn', 'Ivory Buff', 'Naples Yellow', 'Seashell Pink', 'Isabella Color'],
    bruns: ['Brown', 'Sepia', 'Vandyke Brown', 'Mars Brown Tobacco', 'Sudan Brown', 'Madder Brown'],
    rouges: ['Red', 'Carmine', 'Scarlet', 'Spectrum Red', 'Pompeian Red'],
    roses: ['Hermosa Pink', 'Corinthian Pink', 'Old Rose', 'Eosine Pink', 'Laelia Pink'],
    oranges: ['Orange', 'Apricot Orange', 'Burnt Sienna', 'Yellow Orange', 'Raw Sienna'],
    jaunes: ['Yellow', 'Lemon Yellow', 'Cream Yellow', 'Yellow Ocher', 'Apricot Yellow'],
    kakis: ['Olive', 'Olive Green', 'Olive Yellow', 'Lincoln Green', 'Olive Buff'],
    verts: ['Green', 'Cossack Green', 'Night Green', 'Diamine Green', 'Cobalt Green'],
    turquoises: ['Sea Green', 'Peacock Blue', 'Benzol Green', 'Venice Green', 'Nile Blue'],
    bleus: ['Blue', 'Deep Lyons Blue', 'Deep Indigo', 'Helvetia Blue', 'Light Glaucous Blue'],
    violets: ['Violet', 'Lilac', 'Blue Violet', 'Light Mauve', 'Red Violet'],
  };
  egalProfond(Object.keys(temoins), FAMILLES.map((f) => f.id), 'toutes les familles ont des témoins');
  for (const [famille, noms] of Object.entries(temoins)) {
    for (const nom of noms) egal(familleDe(parNom(nom)), famille, nom);
  }
});

test('familles : bleus saturés d\'imprimé dans les bleus, pas dans les violets ; bornes du sRGB', () => {
  egal(familleDe(couleur('#2e3192')), 'bleus', 'bleu roi (C100 M100)');
  egal(familleDe(couleur('#1f4fa0')), 'bleus');
  egal(familleDe(couleur('#0000ff')), 'bleus');
  egal(familleDe(couleur('#6a0dad')), 'violets');
  egal(familleDe(couleur('#ff0000')), 'rouges');
  egal(familleDe(couleur('#00ff00')), 'verts');
  egal(familleDe(couleur('#ffff00')), 'jaunes');
  egal(familleDe(couleur('#808080')), 'neutres');
});

test('familles : chaque couleur dans une seule famille, toutes présentes, du plus clair au plus foncé', () => {
  const groupes = grouperParFamille(wada.couleurs);
  egalProfond(groupes.map((g) => g.id), FAMILLES.map((f) => f.id), '12 familles non vides, dans l\'ordre de la carte');
  const ids = groupes.flatMap((g) => g.couleurs.map((c) => c.id));
  egal(ids.length, wada.couleurs.length, 'aucune couleur perdue');
  egal(new Set(ids).size, ids.length, 'aucune couleur en double');
  for (const g of groupes) {
    vrai(g.couleurs.every((c, i) => i === 0 || c.lab.L <= g.couleurs[i - 1].lab.L), `${g.nom} : du plus clair au plus foncé`);
    vrai(g.couleurs.length >= 5, `${g.nom} : au moins 5 couleurs (${g.couleurs.length})`);
  }
});
