import { test, vrai, egal, egalProfond, proche, leve, EchecAssertion } from './mini-test.js';

test('harnais : egal accepte deux valeurs identiques', () => {
  egal(1, 1);
  egal('a', 'a');
});

test('harnais : egal rejette deux valeurs différentes', () => {
  let erreur = null;
  try { egal(1, 2); } catch (e) { erreur = e; }
  vrai(erreur instanceof EchecAssertion, 'egal(1, 2) doit lever une EchecAssertion');
});

test('harnais : egalProfond compare le contenu', () => {
  egalProfond([1, { a: 2 }], [1, { a: 2 }]);
  let erreur = null;
  try { egalProfond([1], [2]); } catch (e) { erreur = e; }
  vrai(erreur instanceof EchecAssertion);
});

test('harnais : proche respecte la tolérance et rejette NaN', () => {
  proche(1.00005, 1, 1e-4);
  for (const valeur of [1.0002, NaN]) {
    let erreur = null;
    try { proche(valeur, 1, 1e-4); } catch (e) { erreur = e; }
    vrai(erreur instanceof EchecAssertion, `proche(${valeur}, 1, 1e-4) doit échouer`);
  }
});

test('harnais : leve renvoie l\'erreur attendue et échoue sinon', () => {
  const erreur = leve(() => { throw new TypeError('x'); });
  vrai(erreur instanceof TypeError);
  let echec = null;
  try { leve(() => {}); } catch (e) { echec = e; }
  vrai(echec instanceof EchecAssertion);
});
