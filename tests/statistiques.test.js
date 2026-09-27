// Tests des manques fréquents (demande de Théo, 2026-09-27) : manques des tenues aimées (poids 2) et de la première
// proposition de chaque tenue demandée (poids 1). Les couleurs des fixtures sont des données de test synthétiques
// (bornes du codage sRGB, teintes MST de constantes.js), pas des couleurs de catalogue réelles ; le dernier test
// utilise Wada.
import { test, vrai, egal, egalProfond } from './mini-test.js';
import { TYPES, MST, MANQUES_FREQUENTS_MAX, POIDS_MANQUE_AIMEE, POIDS_MANQUE_PREMIERE } from '../js/constantes.js';
import { labDepuisHex } from '../js/couleur.js';
import { construireWada, fusionnerCatalogues } from '../js/catalogue.js';
import { proposer } from '../js/moteur.js';
import { instantaneTenue } from '../js/tenues.js';
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
// Ligne : type:couleur:score:aimées/premières.
const lignes = (resultat) => resultat.manques.map((m) => `${m.type}:${m.couleurId ?? 'joker'}:${m.score}:${m.aimees}/${m.premieres}`);
// Tenue aimée : instantané de la proposition du moteur pour cette combinaison.
function aimee(types, vetements, catalogue, combinaisonId) {
  const proposition = proposer({ types, vetements, catalogue, reglages: reglages() }).retenues.find((p) => p.combinaison.id === combinaisonId);
  return instantaneTenue(proposition, catalogue, types);
}

// Catalogue : k1 rouge-bleu, k2 rouge-vert, k3 bleu-vert-jaune.
const CATALOGUE = catalogueDe([[ROUGE, BLEU], [ROUGE, VERT], [BLEU, VERT, JAUNE]]);

test('manques fréquents : poids 2 pour une tenue aimée, 1 pour la première proposition', () => {
  egal(POIDS_MANQUE_AIMEE, 2);
  egal(POIDS_MANQUE_PREMIERE, 1);
  // Garde-robe : pantalon bleu, t-shirt rouge. [pantalon, t-shirt] : première = k1, rien ne manque.
  // [chaussures, pantalon, t-shirt] : première = k1, les chaussures manquent (joker).
  const vetements = [vet('pantalon', BLEU), vet('t-shirt', ROUGE)];
  const tenuesTypes = [['pantalon', 't-shirt'], ['chaussures', 'pantalon', 't-shirt']];
  const seules = manquesFrequents({ tenuesTypes, vetements, catalogue: CATALOGUE, reglages: reglages() });
  egalProfond(lignes(seules), ['chaussures:joker:1:0/1'], 'seules les premières propositions, pas les autres (k2, k3)');
  egal(seules.nbPremieres, 2);
  egal(seules.nbAimees, 0);
  // Tenue aimée : k2 sur [pantalon, t-shirt] (pantalon vert manquant), poids 2, devant le joker.
  const tenue = aimee(['pantalon', 't-shirt'], vetements, CATALOGUE, 'k2');
  const avec = manquesFrequents({ tenuesTypes, tenuesGardees: [tenue], vetements, catalogue: CATALOGUE, reglages: reglages() });
  egalProfond(lignes(avec), [`pantalon:${id(VERT)}:2:1/0`, 'chaussures:joker:1:0/1']);
  egal(avec.nbAimees, 1);
});

test('manques fréquents : tenue aimée recalculée avec la garde-robe actuelle ; combinaison disparue, manques figés', () => {
  const vetements = [vet('pantalon', BLEU), vet('t-shirt', ROUGE)];
  const tenue = aimee(['pantalon', 't-shirt'], vetements, CATALOGUE, 'k2');
  egal(tenue.pieces.find((p) => p.type === 'pantalon').manque, true, 'figé : pantalon vert manquant');
  const achete = [...vetements, vet('pantalon', VERT)];
  egalProfond(lignes(manquesFrequents({ tenuesTypes: [], tenuesGardees: [tenue], vetements: achete, catalogue: CATALOGUE, reglages: reglages() })), [],
    'le pantalon vert est arrivé : plus rien ne manque');
  // Combinaison absente du catalogue (Papier Tigre retiré) : manques figés, sauf une couleur qui n'y est plus.
  const disparue = {
    ...tenue,
    combinaison: { ...tenue.combinaison, id: 'papier-tigre-v1-p30' },
    pieces: [...tenue.pieces, { type: 'chaussures', hex: '#123456', manque: true, joker: false, couleurId: 'papier-tigre-v1-p30-d1' }],
  };
  egalProfond(lignes(manquesFrequents({ tenuesTypes: [], tenuesGardees: [disparue], vetements: achete, catalogue: CATALOGUE, reglages: reglages() })),
    [`pantalon:${id(VERT)}:2:1/0`]);
});

test('manques fréquents : à score égal, les tenues aimées d\'abord, puis l\'ordre du catalogue (joker en dernier), puis des TYPES', () => {
  // Deux premières propositions (1 + 1) contre une tenue aimée (2) : même score, l'aimée devant.
  const vetements = [vet('t-shirt', ROUGE)];
  const catalogue = catalogueDe([[ROUGE, VERT], [ROUGE, BLEU]]);
  const tenue = aimee(['pantalon', 't-shirt'], vetements, catalogue, 'k2'); // pantalon bleu manquant
  const r = manquesFrequents({ tenuesTypes: [['pantalon', 't-shirt'], ['chaussures', 'pantalon', 't-shirt']], tenuesGardees: [tenue], vetements, catalogue, reglages: reglages() });
  const [premiere] = r.manques;
  egalProfond([premiere.type, premiere.couleurId, premiere.aimees], ['pantalon', id(BLEU), 1], lignes(r).join(' ; '));
  for (let i = 1; i < r.manques.length; i++) {
    const [a, b] = [r.manques[i - 1], r.manques[i]];
    vrai(a.score > b.score || (a.score === b.score && a.aimees >= b.aimees), `ordre ${i}`);
  }
});

test('manques fréquents : aucune tenue, ou aucune proposition retenue', () => {
  const vide = manquesFrequents({ tenuesTypes: [], vetements: [], catalogue: CATALOGUE, reglages: reglages() });
  egalProfond(vide.manques, []);
  egalProfond([vide.nbPremieres, vide.nbAimees, vide.nbTenues], [0, 0, 0]);
  const ecartees = manquesFrequents({ tenuesTypes: [['chaussures', 'pantalon', 't-shirt']], vetements: [], catalogue: CATALOGUE, reglages: reglages() });
  egalProfond(ecartees.manques, [], 'garde-robe vide, 3 pièces : 3 manques, tout est écarté');
  egalProfond([ecartees.nbPremieres, ecartees.nbTenues], [0, 1]);
});

test('manques fréquents : réglages courants (tolérance, teint) ; la peau ne compte jamais comme manque', () => {
  const catalogue = catalogueDe([[ROUGE, BLEU]]);
  const tenue = { tenuesTypes: [['pantalon', 't-shirt']], vetements: [vet('pantalon', BLEU), vet('t-shirt', ROUGE_PROCHE)], catalogue };
  egalProfond(lignes(manquesFrequents({ ...tenue, reglages: reglages({ tolerance: 10 }) })), [], 'rouge proche couvert à 10');
  egalProfond(lignes(manquesFrequents({ ...tenue, reglages: reglages({ tolerance: 1 }) })), [`t-shirt:${id(ROUGE)}:1:0/1`], 'plus couvert à 1');

  const avecTeint = { tenuesTypes: [['t-shirt']], vetements: [], catalogue: catalogueDe([[ROUGE, MST5]]) };
  egal(manquesFrequents({ ...avecTeint, reglages: reglages({ teintActif: false }) }).nbPremieres, 0, 'une pièce, deux couleurs : écartée sans la peau');
  const actif = manquesFrequents({ ...avecTeint, reglages: reglages({ teintActif: true, mst: 5 }) });
  egalProfond(lignes(actif), [`t-shirt:${id(ROUGE)}:1:0/1`], 'la peau porte MST 5, seul le t-shirt manque');
});

test('manques fréquents : coupe à MANQUES_FREQUENTS_MAX (10) ; accord avec le moteur sur le catalogue Wada', async () => {
  const wada = construireWada(await (await fetch(new URL('../data/wada.json', import.meta.url))).json());
  const catalogue = fusionnerCatalogues(wada);
  const hex = (nom) => catalogue.couleurs.find((c) => c.nom === nom).hex;
  const vetements = [vet('chaussures', '#000000'), vet('pantalon', hex('Peacock Blue'))];
  const tenuesTypes = [['chaussures', 'pantalon', 't-shirt'], ['chaussures', 'pantalon', 'pull', 'veste'], ['short', 'chemise'], ['jupe', 't-shirt'], ['robe', 'chaussures']];
  // Tenues aimées : les 8 premières propositions de la première tenue type.
  const { retenues } = proposer({ types: tenuesTypes[0], vetements, catalogue, reglages: reglages() });
  const tenuesGardees = retenues.slice(0, 8).map((p) => instantaneTenue(p, catalogue, tenuesTypes[0]));
  const r = manquesFrequents({ tenuesTypes, tenuesGardees, vetements, catalogue, reglages: reglages() });
  egal(MANQUES_FREQUENTS_MAX, 10);
  egal(r.manques.length, 10, 'top 10');
  vrai(r.nbDistincts > 10, `plus de 10 couples distincts (${r.nbDistincts})`);

  // Recomptage direct depuis le moteur.
  const attendu = new Map();
  const ajouter = (m, poids) => {
    const cle = `${m.type}:${m.couleurId ?? 'joker'}`;
    attendu.set(cle, (attendu.get(cle) ?? 0) + poids);
  };
  for (const p of retenues.slice(0, 8)) for (const m of p.manques) ajouter(m, POIDS_MANQUE_AIMEE);
  for (const types of tenuesTypes) {
    const [premiere] = proposer({ types, vetements, catalogue, reglages: reglages() }).retenues;
    if (premiere) for (const m of premiere.manques) ajouter(m, POIDS_MANQUE_PREMIERE);
  }
  egal(r.nbDistincts, attendu.size);
  for (const m of r.manques) egal(m.score, attendu.get(`${m.type}:${m.couleurId ?? 'joker'}`), `${m.type} ${m.couleurId}`);
  vrai([...attendu.values()].filter((n) => n > r.manques.at(-1).score).length <= 9, 'aucun couple mieux noté n\'est coupé');
  const rang = (couleurId) => (couleurId === null ? catalogue.couleurs.length : catalogue.couleurs.findIndex((c) => c.id === couleurId));
  for (let i = 1; i < r.manques.length; i++) {
    const [a, b] = [r.manques[i - 1], r.manques[i]];
    const ordre = b.score - a.score || b.aimees - a.aimees || rang(a.couleurId) - rang(b.couleurId) || TYPES.indexOf(a.type) - TYPES.indexOf(b.type);
    vrai(ordre < 0, `ordre des lignes ${i - 1} et ${i}`);
  }
});

test('manques fréquents : une combinaison favorite compte (poids 2) dans la tenue demandée où elle va le mieux', () => {
  // Garde-robe : t-shirt rouge. k2 (rouge, vert) favorite : sur [pantalon, t-shirt], le pantalon vert manque (1 manque) ;
  // sur [chaussures, pantalon, t-shirt], 2 manques : c'est la première tenue qui compte.
  const vetements = [vet('t-shirt', ROUGE)];
  const tenuesTypes = [['chaussures', 'pantalon', 't-shirt'], ['pantalon', 't-shirt']];
  const r = manquesFrequents({ tenuesTypes, vetements, catalogue: CATALOGUE, reglages: reglages({ favorisCombinaisons: ['k2', 'inconnue'] }) });
  egal(r.nbFavorites, 1, 'une favorite évaluée (l\'inconnue est ignorée)');
  const pantalonVert = r.manques.find((m) => m.type === 'pantalon' && m.couleurId === id(VERT));
  egalProfond([pantalonVert.favorites, pantalonVert.score >= 2], [1, true]);
  egal(r.manques.some((m) => m.type === 'chaussures' && m.favorites > 0), false, 'pas la tenue à 2 manques');
});
