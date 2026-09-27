import { test, vrai, egal, egalProfond, leve } from './mini-test.js';
import { construireWada, construireXkcd, fusionnerCatalogues, plusProches } from '../js/catalogue.js';
import { lirePapierTigre } from '../js/papier-tigre.js';
import { rgbVersHex, labDepuisRgb, labDepuisHex } from '../js/couleur.js';

const brut = await (await fetch(new URL('../data/wada.json', import.meta.url))).arrayBuffer();
const donneesWada = JSON.parse(new TextDecoder().decode(brut));
const brutXkcd = await (await fetch(new URL('../data/xkcd-rgb.txt', import.meta.url))).arrayBuffer();
const texteXkcd = new TextDecoder().decode(brutXkcd);
const nomsXkcd = await (await fetch(new URL('../data/xkcd-noms-fr.json', import.meta.url))).json();
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

// Couleurs nommées XKCD (demande de Théo, 2026-09-27 : « met plus de variances de couleur », blanc cassé).
const sansAccents = (texte) => texte.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[\s'-]+/g, ' ');

test('xkcd-rgb.txt : copie intacte (SHA-256 du fichier de xkcd.com, 2026-09-27)', async () => {
  const empreinte = [...new Uint8Array(await crypto.subtle.digest('SHA-256', brutXkcd))]
    .map((o) => o.toString(16).padStart(2, '0')).join('');
  egal(empreinte, '450cca88fa6fa9a1e79c969969e05e6900b41a94f0a3a5f134e3d0b79077f890');
});

test('XKCD : 835 couleurs nommées en français, de la plus citée à la moins citée, identifiant xkcd-<rang>, sans combinaison', () => {
  const { couleurs, combinaisons } = construireXkcd(texteXkcd, nomsXkcd);
  egal(couleurs.length, 835);
  egal(combinaisons.length, 0);
  egalProfond([couleurs[0].id, couleurs[0].nomOriginal, couleurs[0].nom, couleurs[0].hex], ['xkcd-949', 'purple', 'Violet franc', '#7e1e9c'], 'la plus citée d\'abord');
  const lignes = texteXkcd.split('\n');
  for (const c of couleurs) {
    egal(c.source, 'xkcd');
    vrai([`${c.nomOriginal}\t${c.hex}\t`, `${c.nomOriginal}\t${c.hex}`].includes(lignes[Number(c.id.slice(5))]), `${c.id} : ligne du fichier`);
    egalProfond(c.lab, labDepuisHex(c.hex), `${c.id} : Lab calculé`);
  }
  const blanc = couleurs.find((c) => c.nomOriginal === 'off white');
  egalProfond([blanc.nom, blanc.hex], ['Blanc cassé', '#ffffe4']);
});

test('XKCD : noms français uniques (accents, tirets et casse ignorés) et différents de ceux de Wada ; noms grossiers écartés', () => {
  const { couleurs } = construireXkcd(texteXkcd, nomsXkcd);
  const wada = construireWada(donneesWada).couleurs.map((c) => sansAccents(c.nom));
  const vus = new Set(wada);
  for (const c of couleurs) {
    vrai(!vus.has(sansAccents(c.nom)), `« ${c.nom} » (${c.nomOriginal}) : nom déjà pris`);
    vus.add(sansAccents(c.nom));
  }
  for (const nom of ['booger', 'puke', 'poop', 'shit', 'vomit', 'ugly pink', 'dried blood']) {
    vrai(!couleurs.some((c) => c.nomOriginal === nom) && nomsXkcd.exclus[nom], `« ${nom} » écarté`);
  }
  for (const [nom, raison] of Object.entries(nomsXkcd.exclus)) {
    const variante = /^variante de « (.+) »$/.exec(raison);
    vrai(variante ? nomsXkcd.noms[variante[1]] !== undefined : ['nom grossier', 'nom péjoratif'].includes(raison) || raison.startsWith('faute de frappe'),
      `« ${nom} » : raison « ${raison} »`);
  }
});

test('XKCD : construireXkcd refuse un fichier altéré ou une traduction incomplète', () => {
  leve(() => construireXkcd(texteXkcd.replace('# License', '# Licence'), nomsXkcd), 'en-tête');
  leve(() => construireXkcd(texteXkcd.replace('#acc2d9', '#ACC2D9'), nomsXkcd), 'hex en majuscules');
  leve(() => construireXkcd(texteXkcd.slice(0, -1), nomsXkcd), 'fin de ligne finale');
  const { 'cloudy blue': retire, ...sansUn } = nomsXkcd.noms;
  leve(() => construireXkcd(texteXkcd, { ...nomsXkcd, noms: sansUn }), 'nom ni traduit ni exclu');
  leve(() => construireXkcd(texteXkcd, { ...nomsXkcd, noms: { ...nomsXkcd.noms, booger: 'Crotte' } }), 'traduit et exclu');
  leve(() => construireXkcd(texteXkcd, { ...nomsXkcd, noms: { ...nomsXkcd.noms, licorne: 'Licorne' } }), 'nom absent du fichier');
  leve(() => construireXkcd(texteXkcd, { ...nomsXkcd, noms: { ...nomsXkcd.noms, 'cloudy blue': ' Bleu' } }), 'nom mal formé');
});

test('fusion : XKCD après Wada ; idsCombinaisons ne compte que les couleurs citées par une combinaison', () => {
  const wada = construireWada(donneesWada);
  const xkcd = construireXkcd(texteXkcd, nomsXkcd);
  const catalogue = fusionnerCatalogues(wada, null, xkcd);
  egal(catalogue.couleurs.length, 159 + 835);
  egal(catalogue.couleurs[159].id, 'xkcd-949');
  egal(catalogue.idsCombinaisons.size, 159, 'les 159 couleurs de Wada sont dans des combinaisons');
  vrai(xkcd.couleurs.every((c) => !catalogue.idsCombinaisons.has(c.id)));
});

test('plusProches : un blanc mesuré un peu sombre trouve un gris clair, un blanc cassé trouve « Blanc cassé » (et plus un vert)', () => {
  const wada = fusionnerCatalogues(construireWada(donneesWada));
  const complet = fusionnerCatalogues(construireWada(donneesWada), null, construireXkcd(texteXkcd, nomsXkcd));
  const premier = (hex, catalogue) => plusProches(labDepuisHex(hex), catalogue, 1)[0].couleur.nom;
  egal(premier('#d7ded4', wada), 'Glaucous Green', 'avant : un vert (signalé par Théo)');
  egal(premier('#d7ded4', complet), 'Gris clair');
  egal(premier('#f5eede', complet), 'Blanc cassé');
  egal(premier('#d2d2d2', complet), 'Argent');
});
