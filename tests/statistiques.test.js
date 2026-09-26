// Tests des manques fréquents. Les couleurs des fixtures sont des données de test synthétiques (bornes du codage
// sRGB, teintes MST de constantes.js), pas des couleurs de catalogue réelles ; le dernier test utilise Wada.
import { test, vrai, egal, egalProfond } from './mini-test.js';
import { TYPES, MST, MANQUES_FREQUENTS_MAX } from '../js/constantes.js';
import { labDepuisHex } from '../js/couleur.js';
import { construireWada, fusionnerCatalogues } from '../js/catalogue.js';
import { proposer } from '../js/moteur.js';
import { manquesFrequents } from '../js/statistiques.js';

const ROUGE = '#ff0000', ROUGE_PROCHE = '#f00000', BLEU = '#0000ff', VERT = '#00ff00', JAUNE = '#ffff00';
const MST5 = MST[4];

const id = (hex) => `c${hex.slice(1)}`;

function catalogueDe(combos) {
  const couleurs = [];
  const vues = new Set();
  const combinaisons = combos.map((hex, n) => {
    for (const h of hex) {
      if (!vues.has(h)) {
        vues.add(h);
        couleurs.push({ id: id(h), nom: h, hex: h, source: 'wada', lab: labDepuisHex(h) });
      }
    }
    return { id: `k${n + 1}`, source: 'wada', ref: `n° ${n + 1}`, couleurs: hex.map(id) };
  });
  return fusionnerCatalogues({ couleurs, combinaisons });
}

let compteur = 0;
function vet(type, hex) {
  compteur++;
  return { id: `v${compteur}`, type, hex, origine: 'manuel', dateAjout: new Date(Date.UTC(2026, 0, 1) + compteur * 1000).toISOString() };
}

const reglages = (x = {}) => ({ mst: 5, teintActif: false, tolerance: 10, favoris: [], ...x });
const lignes = (resultat) => resultat.manques.map((m) => `${m.type}:${m.couleurId ?? 'joker'}:${m.nombre}`);

test('manques fréquents : comptes sur plusieurs tenues types (calculés à la main), tri et joker en dernier', () => {
  // Catalogue : k1 rouge-bleu, k2 rouge-vert, k3 bleu-vert-jaune. Garde-robe : pantalon bleu, t-shirt rouge.
  // Tenue [pantalon, t-shirt] : k1 sans manque ; k2 → pantalon vert ; k3 écartée (3 couleurs, 2 pièces).
  // Tenue [chaussures, pantalon, t-shirt] : k1 → chaussures joker ; k2 → chaussures vert et pantalon joker
  // (le pantalon bleu n'est ni noir ni blanc) ; k3 → chaussures vert et t-shirt jaune.
  const r = manquesFrequents({
    tenuesTypes: [['pantalon', 't-shirt'], ['chaussures', 'pantalon', 't-shirt']],
    vetements: [vet('pantalon', BLEU), vet('t-shirt', ROUGE)],
    catalogue: catalogueDe([[ROUGE, BLEU], [ROUGE, VERT], [BLEU, VERT, JAUNE]]),
    reglages: reglages(),
  });
  egalProfond(lignes(r), [
    `chaussures:${id(VERT)}:2`,
    `pantalon:${id(VERT)}:1`, `t-shirt:${id(JAUNE)}:1`, // ex æquo : ordre du catalogue (vert avant jaune)
    'chaussures:joker:1', 'pantalon:joker:1', // joker en dernier, puis ordre des TYPES
  ]);
  egal(r.nbPropositions, 5, '2 + 3 propositions retenues');
  egal(r.nbTenues, 2);
  egal(r.nbDistincts, 5);
  egal(r.manques[3].couleurId, null, 'joker noté null');
});

test('manques fréquents : même couleur à égalité, ordre des TYPES et non ordre des tenues', () => {
  const r = manquesFrequents({
    tenuesTypes: [['pantalon', 't-shirt'], ['chaussures', 't-shirt']],
    vetements: [vet('t-shirt', ROUGE)],
    catalogue: catalogueDe([[ROUGE, VERT]]),
    reglages: reglages(),
  });
  egalProfond(lignes(r), [`chaussures:${id(VERT)}:1`, `pantalon:${id(VERT)}:1`]);
});

test('manques fréquents : aucune tenue type, ou aucune proposition retenue', () => {
  const catalogue = catalogueDe([[ROUGE, BLEU]]);
  const vide = manquesFrequents({ tenuesTypes: [], vetements: [], catalogue, reglages: reglages() });
  egalProfond(vide.manques, []);
  egal(vide.nbPropositions, 0);
  egal(vide.nbTenues, 0);
  const ecartees = manquesFrequents({ tenuesTypes: [['chaussures', 'pantalon', 't-shirt']], vetements: [], catalogue, reglages: reglages() });
  egalProfond(ecartees.manques, [], 'garde-robe vide, 3 pièces : 3 manques, tout est écarté');
  egal(ecartees.nbPropositions, 0);
  egal(ecartees.nbTenues, 1);
});

test('manques fréquents : réglages courants (tolérance, teint) ; la peau ne compte jamais comme manque', () => {
  const catalogue = catalogueDe([[ROUGE, BLEU]]);
  const tenue = { tenuesTypes: [['pantalon', 't-shirt']], vetements: [vet('pantalon', BLEU), vet('t-shirt', ROUGE_PROCHE)], catalogue };
  egalProfond(lignes(manquesFrequents({ ...tenue, reglages: reglages({ tolerance: 10 }) })), [], 'rouge proche couvert à 10');
  egalProfond(lignes(manquesFrequents({ ...tenue, reglages: reglages({ tolerance: 1 }) })), [`t-shirt:${id(ROUGE)}:1`], 'plus couvert à 1');

  const avecTeint = { tenuesTypes: [['t-shirt']], vetements: [], catalogue: catalogueDe([[ROUGE, MST5]]) };
  const inactif = manquesFrequents({ ...avecTeint, reglages: reglages({ teintActif: false }) });
  egal(inactif.nbPropositions, 0, 'une pièce, deux couleurs : écartée sans la peau');
  const actif = manquesFrequents({ ...avecTeint, reglages: reglages({ teintActif: true, mst: 5 }) });
  egal(actif.nbPropositions, 1, 'la peau porte MST 5');
  egalProfond(lignes(actif), [`t-shirt:${id(ROUGE)}:1`], 'seul le t-shirt manque');
});

test('manques fréquents : coupe à MANQUES_FREQUENTS_MAX (10) ; accord avec le moteur sur le catalogue Wada', async () => {
  const wada = construireWada(await (await fetch(new URL('../data/wada.json', import.meta.url))).json());
  const catalogue = fusionnerCatalogues(wada);
  const hex = (nom) => catalogue.couleurs.find((c) => c.nom === nom).hex;
  const vetements = [
    vet('chaussures', '#000000'), vet('pantalon', hex('Peacock Blue')), vet('t-shirt', '#ffffff'),
    vet('pull', hex('Burnt Sienna')), vet('veste', hex('Dusky Green')),
  ];
  const tenuesTypes = [['chaussures', 'pantalon', 't-shirt'], ['chaussures', 'pantalon', 'pull', 'veste'], ['short', 'chemise']];
  const r = manquesFrequents({ tenuesTypes, vetements, catalogue, reglages: reglages({ teintActif: true }) });
  egal(MANQUES_FREQUENTS_MAX, 10);
  egal(r.manques.length, 10, 'top 10');
  vrai(r.nbDistincts > 10, `plus de 10 couples distincts (${r.nbDistincts})`);

  // Recomptage direct depuis le moteur.
  const attendu = new Map();
  let nbPropositions = 0;
  for (const types of tenuesTypes) {
    const { retenues } = proposer({ types, vetements, catalogue, reglages: reglages({ teintActif: true }) });
    nbPropositions += retenues.length;
    for (const p of retenues) for (const m of p.manques) {
      const cle = `${m.type}:${m.couleurId ?? 'joker'}`;
      attendu.set(cle, (attendu.get(cle) ?? 0) + 1);
    }
  }
  egal(r.nbPropositions, nbPropositions);
  egal(r.nbDistincts, attendu.size);
  for (const m of r.manques) egal(m.nombre, attendu.get(`${m.type}:${m.couleurId ?? 'joker'}`), `${m.type} ${m.couleurId}`);
  const plusPetitRetenu = r.manques.at(-1).nombre;
  vrai([...attendu.values()].filter((n) => n > plusPetitRetenu).length <= 9, 'aucun couple plus fréquent n\'est coupé');

  // Joker : rang après toutes les couleurs du catalogue.
  const rang = (couleurId) => (couleurId === null ? catalogue.couleurs.length : catalogue.couleurs.findIndex((c) => c.id === couleurId));
  for (let i = 1; i < r.manques.length; i++) {
    const a = r.manques[i - 1], b = r.manques[i];
    const ordre = b.nombre - a.nombre || rang(a.couleurId) - rang(b.couleurId) || TYPES.indexOf(a.type) - TYPES.indexOf(b.type);
    vrai(ordre < 0, `ordre des lignes ${i - 1} et ${i}`);
  }
});
