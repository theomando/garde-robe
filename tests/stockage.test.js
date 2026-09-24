import { test, vrai, egal, egalProfond } from './mini-test.js';
import { creerStockage } from '../js/stockage.js';
import { etatInitial, modifierReglages, ajouterVetement, lireExport } from '../js/donnees.js';

// Support factice de type localStorage ; « plein » simule un quota dépassé.
function supportFactice() {
  const valeurs = new Map();
  return {
    valeurs,
    plein: false,
    getItem: (cle) => (valeurs.has(cle) ? valeurs.get(cle) : null),
    setItem(cle, valeur) {
      if (this.plein) throw new DOMException('quota dépassé', 'QuotaExceededError');
      valeurs.set(cle, String(valeur));
    },
    removeItem: (cle) => valeurs.delete(cle),
  };
}

const etatValide = () => ajouterVetement(modifierReglages(etatInitial(), { mst: 4 }),
  { type: 'pull', hex: '#a07e56', origine: 'manuel' }, { id: 'v1', date: new Date('2026-09-24T10:00:00Z') });

test('stockage : vide au départ, puis aller-retour de l\'état', () => {
  const support = supportFactice();
  const stockage = creerStockage(support);
  egalProfond(stockage.chargerEtat(), { etat: etatInitial(), avertissement: null });
  stockage.enregistrerEtat(etatValide());
  vrai(support.valeurs.has('garde-robe:etat'), 'clé préfixée');
  egalProfond(stockage.chargerEtat(), { etat: etatValide(), avertissement: null });
});

test('stockage : une écriture refusée laisse l\'ancienne valeur intacte, octet pour octet', () => {
  const support = supportFactice();
  const stockage = creerStockage(support);
  stockage.enregistrerEtat(etatValide());
  const avant = support.valeurs.get('garde-robe:etat');
  support.plein = true;
  const { etat: importe } = lireExport(JSON.stringify({ ...JSON.parse(avant), vetements: [] }));
  let erreur = null;
  try { stockage.enregistrerEtat(importe); } catch (e) { erreur = e; }
  vrai(erreur !== null, 'l\'écriture doit lever une erreur');
  egal(support.valeurs.get('garde-robe:etat'), avant);
});

test('stockage : données illisibles, copie de secours et état initial', () => {
  const support = supportFactice();
  support.valeurs.set('garde-robe:etat', '{ abîmé');
  const { etat, avertissement } = creerStockage(support).chargerEtat();
  egalProfond(etat, etatInitial());
  vrai(avertissement.startsWith('Données locales illisibles'), avertissement);
  egal(support.valeurs.get('garde-robe:etat-illisible'), '{ abîmé');
});

test('stockage : espace de noms séparé et catalogue Papier Tigre', () => {
  const support = supportFactice();
  const tests = creerStockage(support, 'tests');
  tests.enregistrerEtat(etatValide());
  vrai(support.valeurs.has('garde-robe-tests:etat') && !support.valeurs.has('garde-robe:etat'));
  egal(tests.chargerPapierTigre(), null);
  tests.enregistrerPapierTigre('{"format":"papier-tigre"}');
  egal(tests.chargerPapierTigre(), '{"format":"papier-tigre"}');
  tests.supprimerPapierTigre();
  egal(tests.chargerPapierTigre(), null);
});

test('stockage : localStorage inaccessible signalé sans planter', () => {
  const support = { getItem() { throw new Error('refusé'); }, setItem() { throw new Error('refusé'); }, removeItem() {} };
  const { etat, avertissement } = creerStockage(support).chargerEtat();
  egalProfond(etat, etatInitial());
  vrai(avertissement.includes('inaccessible'));
  egal(creerStockage(support).chargerPapierTigre(), null);
});
