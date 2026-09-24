// Parcours de l'interface (étape 4) : l'app tourne dans un cadre invisible, avec un espace de stockage
// réservé (?espace=tests-ui) vidé au départ. Les tests s'enchaînent sur la même instance.
import { test, vrai, egal, attendre } from './mini-test.js';

const ESPACE = 'garde-robe-tests-ui:';
let fenetre = null;
let doc = null;

function stocke() {
  const brut = localStorage.getItem(`${ESPACE}etat`);
  return brut === null ? null : JSON.parse(brut);
}

function cliquer(selecteur, racine = doc) {
  const element = racine.querySelector(selecteur);
  if (!element) throw new Error(`élément introuvable : ${selecteur}`);
  element.click();
  return element;
}

const dialogueOuvert = (selecteur = 'dialog[open]') => attendre(() => doc.querySelector(selecteur), `dialogue ${selecteur}`);
// L'événement close d'un <dialog> est différé : on attend le résultat attendu, pas seulement la fermeture.
const dialoguesFermes = () => attendre(() => doc.querySelector('dialog') === null, 'retrait des dialogues')
  .catch((erreur) => {
    const restants = [...doc.querySelectorAll('dialog')].map((d) => `« ${d.querySelector('h2')?.textContent} » (open=${d.open})`);
    throw new Error(`${erreur.message} ; restants : ${restants.join(', ')}`);
  });
const quand = (condition, message) => attendre(condition, message);

async function fournirFichier(texte, nom = 'fichier.json') {
  const champ = await attendre(() => doc.querySelector('input[data-choix-fichier]'), 'sélecteur de fichier');
  const transfert = new fenetre.DataTransfer();
  transfert.items.add(new fenetre.File([texte], nom, { type: 'application/json' }));
  champ.files = transfert.files;
  champ.dispatchEvent(new fenetre.Event('change'));
}

async function rechercher(selecteur, texte) {
  const champ = selecteur.querySelector('[data-action="rechercher"]');
  champ.value = texte;
  champ.dispatchEvent(new fenetre.Event('input'));
}

test('app : premier lancement, teint obligatoire, puis garde-robe vide', async () => {
  for (const cle of Object.keys(localStorage)) if (cle.startsWith(ESPACE)) localStorage.removeItem(cle);
  const cadre = document.createElement('iframe');
  cadre.style.cssText = 'position:absolute;left:-10000px;width:390px;height:844px';
  cadre.src = new URL('../index.html?espace=tests-ui', import.meta.url);
  document.body.append(cadre);
  await attendre(() => cadre.contentDocument?.body?.dataset.etat === 'pret', 'démarrage de l\'app');
  fenetre = cadre.contentWindow;
  doc = cadre.contentDocument;
  vrai(doc.getElementById('premier-lancement'), 'écran de premier lancement');
  vrai(doc.getElementById('onglets').hidden, 'onglets masqués');
  const commencer = doc.querySelector('[data-action="commencer"]');
  vrai(commencer.disabled, 'Commencer désactivé sans teint');
  egal(stocke(), null, 'rien d\'enregistré avant le choix');
  cliquer('[data-mst="5"]');
  vrai(!commencer.disabled);
  commencer.click();
  egal(stocke().reglages.mst, 5);
  egal(stocke().reglages.teintActif, false, 'interrupteur désactivé par défaut');
  vrai(!doc.getElementById('onglets').hidden);
  vrai(doc.querySelector('.vide').textContent.includes('garde-robe est vide'));
});

test('app : ajout d\'un pull choisi dans le catalogue (recherche « burnt sienna »)', async () => {
  cliquer('[data-action="ajouter-vetement"]');
  cliquer('[data-choix="pull"]', await dialogueOuvert());
  const selecteur = await dialogueOuvert('dialog.selecteur[open]');
  await rechercher(selecteur, 'burnt sienna');
  const carte = await attendre(() => [...selecteur.querySelectorAll('[data-action="choisir-couleur"]')]
    .find((b) => b.querySelector('.nom').textContent === 'Burnt Sienna'), 'carte Burnt Sienna');
  carte.click();
  await dialoguesFermes();
  await quand(() => doc.querySelector('[data-type="pull"] .nom'), 'pull affiché');
  egal(doc.querySelector('[data-type="pull"] .nom').textContent, 'Burnt Sienna');
  const [vetement] = stocke().vetements;
  egal(vetement.type, 'pull');
  egal(vetement.origine, 'manuel');
  egal(vetement.idCouleurCatalogue, carte.dataset.couleur);
});

test('app : modification du type (pull → veste) en touchant la ligne', async () => {
  cliquer('[data-type="pull"] [data-action="modifier"]');
  const dialogue = await dialogueOuvert();
  dialogue.querySelector('[data-action="type-vetement"]').value = 'veste';
  cliquer('[data-valeur="ok"]', dialogue);
  await dialoguesFermes();
  await quand(() => doc.querySelector('[data-type="veste"] .vetement'), 'rangé sous Veste');
  egal(stocke().vetements[0].type, 'veste');
});

test('app : favori depuis les réglages', async () => {
  cliquer('#onglets [data-ecran="reglages"]');
  cliquer('[data-action="gerer-favoris"]');
  const selecteur = await dialogueOuvert('dialog.selecteur[open]');
  await rechercher(selecteur, 'burnt sienna');
  const etoile = await attendre(() => selecteur.querySelector('[data-action="etoile"]'), 'étoile');
  etoile.click();
  egal(etoile.getAttribute('aria-pressed'), 'true');
  egal(stocke().reglages.favoris.length, 1);
  cliquer('[data-action="fermer-selecteur"]', selecteur);
  await dialoguesFermes();
  await quand(() => doc.getElementById('contenu').textContent.includes('1 couleur favorite'), 'favori affiché');
});

test('app : tolérance réglée au curseur', async () => {
  const curseur = doc.getElementById('reglage-tolerance');
  curseur.value = '12.5';
  curseur.dispatchEvent(new fenetre.Event('change'));
  egal(stocke().reglages.tolerance, 12.5);
  egal(doc.querySelector('output[for="reglage-tolerance"]').textContent, '12,5');
});

test('app : import de données invalides refusé, données intactes', async () => {
  const avant = localStorage.getItem(`${ESPACE}etat`);
  cliquer('[data-action="importer"]');
  await fournirFichier('{"format":"garde-robe-chromatique","version":1}');
  const dialogue = await dialogueOuvert();
  egal(dialogue.querySelector('h2').textContent, 'Import refusé');
  cliquer('.dialogue-boutons button', dialogue);
  await dialoguesFermes();
  egal(localStorage.getItem(`${ESPACE}etat`), avant);
});

test('app : import du catalogue Papier Tigre, puis choix d\'une de ses couleurs', async () => {
  const texte = await (await fetch(new URL('./donnees/papier-tigre-exemple.json', import.meta.url))).text();
  cliquer('[data-action="importer-papier-tigre"]');
  await fournirFichier(texte, 'papier-tigre.json');
  await attendre(() => doc.querySelector('[data-info="papier-tigre"]')?.textContent.startsWith('Importé'), 'statut Papier Tigre');
  egal(doc.querySelector('[data-info="papier-tigre"]').textContent, 'Importé : 3 harmonies, 11 couleurs.');
  vrai(localStorage.getItem(`${ESPACE}papier-tigre`), 'catalogue enregistré');
  cliquer('#onglets [data-ecran="garde-robe"]');
  cliquer('[data-action="ajouter-vetement"]');
  cliquer('[data-choix="chaussures"]', await dialogueOuvert());
  const selecteur = await dialogueOuvert('dialog.selecteur[open]');
  vrai(selecteur.querySelector('[data-source="papier-tigre"]'), 'filtre Papier Tigre proposé');
  await rechercher(selecteur, 'exemple a, dominante 1');
  cliquer('[data-action="choisir-couleur"]', selecteur);
  await dialoguesFermes();
  await quand(() => doc.querySelector('[data-type="chaussures"] .nom'), 'chaussures affichées');
  egal(doc.querySelector('[data-type="chaussures"] .nom').textContent, 'Exemple A, dominante 1');
  egal(stocke().vetements.length, 2);
});

test('app : suppression depuis la fenêtre de modification, après confirmation', async () => {
  cliquer('[data-type="chaussures"] [data-action="modifier"]');
  cliquer('[data-action="supprimer"]', await dialogueOuvert());
  const dialogue = await attendre(() => [...doc.querySelectorAll('dialog[open]')]
    .find((d) => d.querySelector('h2').textContent === 'Supprimer ce vêtement ?'), 'confirmation');
  cliquer('[data-valeur="oui"]', dialogue);
  await dialoguesFermes();
  await quand(() => doc.querySelector('[data-type="chaussures"]') === null, 'chaussures retirées');
  egal(stocke().vetements.length, 1);
});

test('app : données affichées en texte, puis réimportées après confirmation', async () => {
  cliquer('#onglets [data-ecran="reglages"]');
  cliquer('[data-action="copier-texte"]');
  const dialogue = await dialogueOuvert();
  const exporte = JSON.parse(dialogue.querySelector('textarea').value);
  egal(exporte.format, 'garde-robe-chromatique');
  egal(exporte.vetements.length, 1);
  cliquer('.dialogue-boutons button', dialogue);
  await dialoguesFermes();
  const modifie = { ...exporte, vetements: [] };
  cliquer('[data-action="importer"]');
  await fournirFichier(JSON.stringify(modifie));
  const confirmation = await dialogueOuvert();
  egal(confirmation.querySelector('h2').textContent, 'Remplacer tes données ?');
  cliquer('[data-valeur="oui"]', confirmation);
  await dialoguesFermes();
  await quand(() => stocke().vetements.length === 0, 'données remplacées');
});
