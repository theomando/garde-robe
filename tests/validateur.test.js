// Tests de la page outils/validateur.html, chargée dans un cadre invisible.
import { test, egal, vrai, attendre } from './mini-test.js';

async function ouvrirValidateur(fichier) {
  const cadre = document.createElement('iframe');
  cadre.hidden = true;
  cadre.src = new URL(`../outils/validateur.html?fichier=${encodeURIComponent(fichier)}`, import.meta.url);
  document.body.append(cadre);
  return attendre(() => cadre.contentDocument?.body?.dataset.etat === 'fini' && cadre.contentDocument, 'chargement du validateur');
}

test('validateur : fichier valide, bilan et une carte par harmonie', async () => {
  const doc = await ouvrirValidateur('../tests/donnees/papier-tigre-exemple.json');
  egal(doc.getElementById('bilan').textContent, 'Fichier valide : 3 harmonies, 11 couleurs (vol. 1 : 2 ; vol. 2 : 1).');
  egal(doc.querySelectorAll('.erreur').length, 0);
  const cartes = doc.querySelectorAll('.harmonie');
  egal(cartes.length, 3);
  egal(cartes[0].querySelector('h3').textContent, 'vol. 1, p. 12 — Exemple A (Pays test)');
  egal(cartes[0].querySelectorAll('.pastille.dominante').length, 3);
  egal(cartes[0].querySelectorAll('.pastille.soutien').length, 3);
  vrai(cartes[0].querySelector('.pastille').textContent.includes('255 0 0'), 'RVB affiché');
});

test('validateur : fichier invalide, liste des erreurs et aucune carte', async () => {
  const doc = await ouvrirValidateur('../tests/donnees/papier-tigre-invalide.json');
  egal(doc.getElementById('bilan').textContent, '2 erreurs : le fichier serait refusé par l\'app.');
  const erreurs = [...doc.querySelectorAll('.erreur')].map((li) => li.textContent);
  egal(erreurs.length, 2);
  vrai(erreurs[0].includes('« volume » doit être un entier de 1 à 3'), erreurs[0]);
  vrai(erreurs[1].includes('dominante 1 : [300,0,0]'), erreurs[1]);
  egal(doc.querySelectorAll('.harmonie').length, 0);
});

test('validateur : le catalogue Wada s\'affiche en 348 lignes', async () => {
  const doc = await ouvrirValidateur('../tests/donnees/papier-tigre-exemple.json');
  doc.getElementById('wada').open = true;
  await attendre(() => doc.body.dataset.wada === 'fini', 'affichage de Wada');
  const lignes = doc.querySelectorAll('#grille-wada .wada');
  egal(lignes.length, 348);
  egal(lignes[197].querySelector('.num').textContent, 'n° 198');
  egal(lignes[197].querySelectorAll('.pastille').length, 3);
  vrai(/^Burnt Sienna #[0-9a-f]{6}$/.test(lignes[197].querySelector('.pastille').title), 'nom et hex au survol');
});
