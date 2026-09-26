// Tests de l'instantané d'une proposition (« Mes tenues ») : couleurs figées, signature, pièces de l'avatar.
import { test, vrai, egal, egalProfond } from './mini-test.js';
import { labDepuisHex } from '../js/couleur.js';
import { fusionnerCatalogues } from '../js/catalogue.js';
import { proposer } from '../js/moteur.js';
import { instantaneTenue, signatureTenue, piecesAvatar } from '../js/tenues.js';
import { garderTenue, etatInitial } from '../js/donnees.js';

const ROUGE = '#ff0000', BLEU = '#0000ff', NOIR = '#000000';
const couleurs = [ROUGE, BLEU].map((hex, i) => ({ id: `c${i}`, nom: `Couleur ${i}`, hex, source: 'wada', lab: labDepuisHex(hex) }));
const catalogue = fusionnerCatalogues({ couleurs, combinaisons: [{ id: 'k1', source: 'wada', ref: 'n° 1', couleurs: ['c0', 'c1'] }] });
const vet = (id, type, hex) => ({ id, type, hex, origine: 'manuel', dateAjout: '2026-09-24T10:00:00.000Z' });
const reglages = { mst: 5, teintActif: false, tolerance: 10, favoris: [] };

test('mes tenues : instantané d\'une proposition (vêtement porté, joker, manque), valide pour garderTenue', () => {
  const vetements = [vet('p', 'pantalon', BLEU), vet('c', 'chaussures', NOIR)];
  const types = ['chaussures', 'pantalon', 't-shirt'];
  const [proposition] = proposer({ types, vetements, catalogue, reglages }).retenues;
  const tenue = instantaneTenue(proposition, catalogue, types);
  egalProfond(tenue.types, types);
  egalProfond(tenue.combinaison, {
    id: 'k1', source: 'wada', ref: 'n° 1',
    couleurs: [{ id: 'c0', nom: 'Couleur 0', hex: ROUGE }, { id: 'c1', nom: 'Couleur 1', hex: BLEU }],
  });
  egalProfond(tenue.pieces, [
    { type: 'chaussures', hex: NOIR, manque: false, joker: true, vetementId: 'c' },
    { type: 'pantalon', hex: BLEU, manque: false, joker: false, couleurId: 'c1', vetementId: 'p' },
    { type: 't-shirt', hex: ROUGE, manque: true, joker: false, couleurId: 'c0' },
  ]);
  egalProfond(piecesAvatar(tenue), [
    { type: 'chaussures', hex: NOIR, manque: false }, { type: 'pantalon', hex: BLEU, manque: false }, { type: 't-shirt', hex: ROUGE, manque: true },
  ]);
  const etat = garderTenue(etatInitial(), tenue, { id: 't1', date: new Date('2026-09-26T10:00:00Z') }, signatureTenue);
  egal(etat.tenuesGardees.length, 1, 'instantané accepté par la validation');
  egal(signatureTenue(etat.tenuesGardees[0]), signatureTenue(tenue), 'même signature une fois gardée');
  vrai(signatureTenue({ ...tenue, types: ['pantalon', 't-shirt'] }) !== signatureTenue(tenue), 'autres types : autre signature');
});
