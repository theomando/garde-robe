import { test, vrai, egal, egalProfond, leve } from './mini-test.js';
import { construireWada, fusionnerCatalogues, plusProches } from '../js/catalogue.js';
import { lirePapierTigre } from '../js/papier-tigre.js';
import { rgbVersHex, labDepuisRgb } from '../js/couleur.js';

const brut = await (await fetch(new URL('../data/wada.json', import.meta.url))).arrayBuffer();
const donneesWada = JSON.parse(new TextDecoder().decode(brut));
const texteExemple = await (await fetch(new URL('./donnees/papier-tigre-exemple.json', import.meta.url))).text();

test('wada.json : copie intacte (SHA-256 de colors.json, commit c142bd0)', async () => {
  const empreinte = [...new Uint8Array(await crypto.subtle.digest('SHA-256', brut))]
    .map((o) => o.toString(16).padStart(2, '0')).join('');
  egal(empreinte, '555f11c32eb8133078fd470dd7d5320533aaa8b636f12fa06a8dd3d0ee2703b4');
});

test('Wada : 159 couleurs, identifiants wada-1 à wada-159, noms uniques, hex conforme à rgb', () => {
  const { couleurs } = construireWada(donneesWada);
  egal(couleurs.length, 159);
  couleurs.forEach((c, i) => {
    egal(c.id, `wada-${i + 1}`);
    egal(c.source, 'wada');
    egal(c.nom, donneesWada[i].name);
    egal(c.hex, rgbVersHex(donneesWada[i].rgb));
    egal(c.hex, donneesWada[i].hex);
  });
  egal(new Set(couleurs.map((c) => c.nom)).size, 159, 'noms uniques');
  egal(new Set(couleurs.map((c) => c.hex)).size, 159, 'hex uniques');
});

test('Wada : Lab recalculé depuis rgb, jamais lu dans le champ lab du fichier', () => {
  const { couleurs } = construireWada(donneesWada);
  couleurs.forEach((c, i) => egalProfond(c.lab, labDepuisRgb(donneesWada[i].rgb), c.nom));
});

test('Wada : 348 combinaisons (1 à 120 : 2 couleurs, 121 à 240 : 3, 241 à 348 : 4)', () => {
  const { couleurs, combinaisons } = construireWada(donneesWada);
  const ids = new Set(couleurs.map((c) => c.id));
  egal(combinaisons.length, 348);
  combinaisons.forEach((combinaison, i) => {
    const n = i + 1;
    egal(combinaison.id, `wada-n${n}`);
    egal(combinaison.ref, `n° ${n}`);
    egal(combinaison.source, 'wada');
    egal(combinaison.roles, undefined, 'pas de rôles pour Wada');
    egal(combinaison.couleurs.length, n <= 120 ? 2 : n <= 240 ? 3 : 4, `taille de la combinaison ${n}`);
    egal(new Set(combinaison.couleurs).size, combinaison.couleurs.length, `couleurs distinctes (${n})`);
    vrai(combinaison.couleurs.every((id) => ids.has(id)), `couleurs connues (${n})`);
  });
});

test('Wada : la combinaison 198 regroupe Burnt Sienna, Apricot Yellow et Green (ordre du fichier)', () => {
  const catalogue = fusionnerCatalogues(construireWada(donneesWada));
  const noms = catalogue.combinaisonParId.get('wada-n198').couleurs.map((id) => catalogue.couleurParId.get(id).nom);
  egalProfond(noms, ['Burnt Sienna', 'Apricot Yellow', 'Green']);
});

test('Wada : construireWada rejette un fichier altéré', () => {
  const copie = () => structuredClone(donneesWada);
  const cas = [
    ['pas un tableau', () => ({})],
    ['nom manquant', () => { const d = copie(); delete d[0].name; return d; }],
    ['rgb hors bornes', () => { const d = copie(); d[0].rgb = [256, 0, 0]; return d; }],
    ['hex différent de rgb', () => { const d = copie(); d[0].hex = '#000000'; return d; }],
    ['numéro non entier', () => { const d = copie(); d[0].combinations = [1.5]; return d; }],
    ['combinaison à 1 couleur', () => { const d = copie(); d[0].combinations.push(999); return d; }],
    ['combinaison à 5 couleurs', () => { const d = copie(); for (let i = 0; i < 5; i++) d[i].combinations.push(999); return d; }],
    ['numéro répété', () => { const d = copie(); d[0].combinations.push(d[0].combinations[0]); return d; }],
  ];
  for (const [nom, fabriquer] of cas) leve(() => construireWada(fabriquer()), `devrait échouer : ${nom}`);
});

test('fusion : Wada puis Papier Tigre, dans cet ordre, avec index par identifiant', () => {
  const wada = construireWada(donneesWada);
  const { catalogue: pt } = lirePapierTigre(texteExemple);
  const catalogue = fusionnerCatalogues(wada, pt);
  egal(catalogue.couleurs.length, 159 + 6 + 2 + 3);
  egal(catalogue.combinaisons.length, 348 + 3);
  egal(catalogue.couleurs[159].id, 'papier-tigre-v1-p12-d1');
  egal(catalogue.combinaisons[348].id, 'papier-tigre-v1-p12');
  egal(catalogue.couleurParId.get('wada-1').nom, 'Hermosa Pink');
  egal(catalogue.combinaisonParId.get('papier-tigre-v2-p40').ref, 'vol. 2, p. 40');
  egal(fusionnerCatalogues(wada, null).couleurs.length, 159, 'Papier Tigre absent');
});

test('fusion : identifiant en double ou couleur inconnue refusés', () => {
  const partie = {
    couleurs: [{ id: 'x-1', nom: 'x', hex: '#000000', source: 'wada', lab: labDepuisRgb([0, 0, 0]) }],
    combinaisons: [{ id: 'x-n1', source: 'wada', ref: 'n° 1', couleurs: ['x-1', 'x-2'] }],
  };
  leve(() => fusionnerCatalogues({ couleurs: partie.couleurs, combinaisons: [] }, { couleurs: partie.couleurs, combinaisons: [] }));
  leve(() => fusionnerCatalogues(partie), 'couleur x-2 inconnue');
});

test('plusProches : la couleur elle-même d\'abord, 12 résultats par ΔE00 croissant', () => {
  const catalogue = fusionnerCatalogues(construireWada(donneesWada));
  const cible = catalogue.couleurParId.get('wada-42');
  const resultat = plusProches(cible.lab, catalogue);
  egal(resultat.length, 12);
  egal(resultat[0].couleur.id, 'wada-42');
  egal(resultat[0].ecart, 0);
  for (let i = 1; i < resultat.length; i++) vrai(resultat[i].ecart >= resultat[i - 1].ecart, 'ordre croissant');
  egal(plusProches(cible.lab, catalogue, Infinity).length, 159, 'catalogue complet');
});

test('plusProches : à écart égal, l\'ordre du catalogue départage', () => {
  const lab = labDepuisRgb([10, 20, 30]);
  const catalogue = fusionnerCatalogues({
    couleurs: ['b', 'a', 'c'].map((id) => ({ id, nom: id, hex: '#0a141e', source: 'wada', lab })),
    combinaisons: [],
  });
  egalProfond(plusProches(lab, catalogue, 3).map((r) => r.couleur.id), ['b', 'a', 'c']);
});
