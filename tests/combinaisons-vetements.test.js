// Combinaisons pour s'habiller (demande de Théo, 2026-09-27) : relevé de Théo, couleurs de Wada, doublons de Wada retirés.
import { test, vrai, egal, egalProfond, leve } from './mini-test.js';
import { construireWada, fusionnerCatalogues } from '../js/catalogue.js';
import { construireCombinaisonsVetements } from '../js/combinaisons-vetements.js';
import { referenceCombinaison } from '../js/tenues.js';

const wada = construireWada(await (await fetch(new URL('../data/wada.json', import.meta.url))).json());
const donnees = await (await fetch(new URL('../data/combinaisons-vetements.json', import.meta.url))).json();
const copie = () => JSON.parse(JSON.stringify(donnees));

test('vêtements : 61 combinaisons (42 « mode », 19 personnelles), 2 ou 3 couleurs de Wada chacune', () => {
  const { couleurs, combinaisons } = construireCombinaisonsVetements(donnees, wada);
  egal(couleurs.length, 0, 'aucune couleur nouvelle : celles de Wada');
  egal(combinaisons.length, 61);
  egal(combinaisons.filter((c) => c.origine === 'mode').length, 42);
  egal(combinaisons.filter((c) => c.origine === 'perso').length, 19);
  const idsWada = new Set(wada.couleurs.map((c) => c.id));
  vrai(combinaisons.every((c) => c.source === 'vetements' && c.couleurs.length >= 2 && c.couleurs.length <= 3 && c.couleurs.every((id) => idsWada.has(id))));
  const premiere = combinaisons[0];
  egalProfond([premiere.id, premiere.ref, premiere.origine, premiere.sources], ['vetements-mode-01', 'Mode n° 1', 'mode', ['P2', 'P4', 'C1', 'C2', 'G3']]);
  egalProfond(premiere.couleurs.map((id) => wada.couleurs.find((c) => c.id === id).nom), ['Mars Brown Tobacco', 'Pale King\'s Blue'], 'marron chocolat + bleu clair');
  egal(referenceCombinaison(premiere), 'Mode n° 1 · Tory Burch, Staud (P4), Patou porté par K. Holmes (C1)');
  egal(referenceCombinaison(combinaisons.find((c) => c.ref === 'Perso U01')), 'Perso U01');
});

test('vêtements : nuancier du relevé fidèle à Wada (54 noms), exclusions motivées', () => {
  egal(Object.keys(donnees.nuancier).length, 54);
  const parHex = new Map(wada.couleurs.map((c) => [c.hex, c.nom]));
  egal(parHex.get(donnees.nuancier['bleu marine']), 'Deep Indigo');
  egal(parHex.get(donnees.nuancier.lavande), 'Grayish Lavender - A');
  egalProfond(Object.keys(donnees.exclues), ['Mode n° 35', 'Mode n° 36', 'Mode n° 37', 'Perso U16']);
  const refs = new Set(donnees.combinaisons.map((c) => c.ref));
  vrai(Object.keys(donnees.exclues).every((ref) => !refs.has(ref)), 'exclues absentes');
  egal(donnees.combinaisons.find((c) => c.ref === 'Mode n° 15').remarque, 'aussi dans tes combinaisons (U16)');
});

test('vêtements : les combinaisons de Wada aux mêmes couleurs sont remplacées (n° 19 et n° 69)', () => {
  const { remplacees } = construireCombinaisonsVetements(donnees, wada);
  egalProfond(remplacees, ['wada-n19', 'wada-n69'], 'marron + vert (Mode n° 40), noir + gris (Mode n° 5)');
  const n69 = wada.combinaisons.find((k) => k.id === 'wada-n69').couleurs.map((id) => wada.couleurs.find((c) => c.id === id).nom).sort();
  egalProfond(n69, ['Black', 'Warm Gray']);
  // Fusion comme dans l'app : Wada sans ses doublons, puis les combinaisons pour s'habiller.
  const vetements = construireCombinaisonsVetements(donnees, wada);
  const catalogue = fusionnerCatalogues({ ...wada, combinaisons: wada.combinaisons.filter((k) => !vetements.remplacees.includes(k.id)) }, vetements);
  egal(catalogue.combinaisons.length, 348 - 2 + 61);
  egal(catalogue.combinaisons[346].id, 'vetements-mode-01', 'après celles de Wada dans l\'ordre du catalogue');
});

test('vêtements : relevé altéré refusé (couleur hors Wada, nom inconnu, doublon, trop de couleurs, format)', () => {
  const hors = copie(); hors.nuancier.noir = '#000000';
  leve(() => construireCombinaisonsVetements(hors, wada), 'hex absent de Wada');
  const inconnu = copie(); inconnu.combinaisons[0].couleurs = ['fuchsia', 'noir'];
  leve(() => construireCombinaisonsVetements(inconnu, wada), 'nom hors nuancier');
  const doublon = copie(); doublon.combinaisons.push({ ...doublon.combinaisons[0], id: 'mode-99', ref: 'Mode n° 99', couleurs: ['bleu clair', 'marron chocolat'] });
  leve(() => construireCombinaisonsVetements(doublon, wada), 'mêmes couleurs dans un autre ordre');
  const confondues = copie(); confondues.combinaisons[0].couleurs = ['rose clair', 'rose poudré'];
  leve(() => construireCombinaisonsVetements(confondues, wada), 'deux noms, une seule couleur de Wada');
  const cinq = copie(); cinq.combinaisons[0].couleurs = ['noir', 'blanc', 'gris', 'beige', 'rouge'];
  leve(() => construireCombinaisonsVetements(cinq, wada), '5 couleurs');
  leve(() => construireCombinaisonsVetements({ ...copie(), version: 2 }, wada), 'version inconnue');
});
