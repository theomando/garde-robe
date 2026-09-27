// Parcours de l'interface : l'app tourne dans un cadre invisible, avec un espace de stockage
// réservé (?espace=tests-ui) vidé au départ. Les tests s'enchaînent sur la même instance.
// Le lanceur démarre Edge avec une caméra simulée (--use-fake-device-for-media-stream), sans torche.
import { test, vrai, egal, egalProfond, attendre } from './mini-test.js';
import { photoSynthetique, photoUnie, attendreReel, avecTempsReel } from './aides.js';
import { ouvrirPhotos } from '../js/photos.js';
import { labDepuisHex } from '../js/couleur.js';
import { lireExport } from '../js/donnees.js';

const ESPACE = 'garde-robe-tests-ui:';
// Base de photos de l'espace de test (IndexedDB), lue en temps réel (le temps virtuel ne l'attend pas).
const photosDeTest = () => avecTempsReel(ouvrirPhotos('tests-ui').toutes(), 'photos de test');
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

// Un dialogue ignore les clics pendant 400 ms (anti double tape) : on attend qu'il soit « prêt ».
const dialogueOuvert = (selecteur = 'dialog[open]') => attendre(
  () => [...doc.querySelectorAll(selecteur)].find((d) => 'pret' in d.dataset), `dialogue ${selecteur} prêt`);
// L'événement close d'un <dialog> est différé : on attend le résultat attendu, pas seulement la fermeture.
const dialoguesFermes = () => attendre(() => doc.querySelector('dialog') === null, 'retrait des dialogues')
  .catch((erreur) => {
    const restants = [...doc.querySelectorAll('dialog')].map((d) => `« ${d.querySelector('h2')?.textContent} » (open=${d.open})`);
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

// Ajout d'un vêtement : grande carte quand la garde-robe est vide, sinon bouton « + » puis menu.
async function menuAjout(action) {
  const carte = doc.querySelector(`#contenu .carte-action[data-action="${action}"]`);
  if (carte) { carte.click(); return; }
  cliquer('#contenu [data-action="ajouter"]');
  const option = await attendre(() => doc.querySelector(`.menu [data-action="${action}"]`), 'menu « + »');
  option.click();
}

// Nouveau vêtement sans photo : l'app propose d'en ajouter une (demande de Théo, 2026-09-27) ; ici, « Sans photo ».
async function sansPhoto() {
  const alerte = await attendre(() => [...doc.querySelectorAll('dialog.alerte-photo[open]')].find((d) => 'pret' in d.dataset), 'proposition de photo');
  egal(alerte.querySelector('h2').textContent, 'Ajouter une photo ?');
  cliquer('[data-valeur="sans"]', alerte);
}

// Partage d'iOS simulé dans l'app : les données partagées sont gardées pour vérification.
function simulerPartage() {
  const partages = [];
  Object.defineProperty(fenetre.navigator, 'canShare', { value: () => true, configurable: true });
  Object.defineProperty(fenetre.navigator, 'share', { value: async (donnees) => { partages.push(donnees); }, configurable: true });
  return partages;
}

// Photo fournie à l'appareil photo (repli du scan, et étalonnage).
async function fournirPhoto(blob) {
  const champ = await attendre(() => doc.querySelector('input[data-choix-fichier="image"]'), 'appareil photo');
  const transfert = new fenetre.DataTransfer();
  transfert.items.add(new fenetre.File([blob], 'photo.png', { type: 'image/png' }));
  champ.files = transfert.files;
  champ.dispatchEvent(new fenetre.Event('change'));
  return champ;
}

test('app : premier lancement, teint obligatoire, puis garde-robe vide', async () => {
  for (const cle of Object.keys(localStorage)) if (cle.startsWith(ESPACE)) localStorage.removeItem(cle);
  await avecTempsReel(ouvrirPhotos('tests-ui').remplacerTout(new Map()), 'photos de test vidées');
  const cadre = document.createElement('iframe');
  cadre.style.cssText = 'position:absolute;left:-10000px;width:390px;height:844px';
  cadre.src = new URL('../index.html?espace=tests-ui', import.meta.url);
  document.body.append(cadre);
  await attendre(() => cadre.contentDocument?.body?.dataset.etat === 'pret', 'démarrage de l\'app');
  fenetre = cadre.contentWindow;
  doc = cadre.contentDocument;
  vrai(doc.getElementById('premier-lancement'), 'écran de premier lancement');
  vrai(doc.getElementById('onglets').hidden, 'onglets masqués');
  egal(doc.getElementById('premier-lancement').dataset.etape, 'bienvenue', 'accueil d\'abord');
  egal(doc.querySelectorAll('.atouts li').length, 3, 'trois atouts illustrés');
  vrai(doc.querySelector('[data-action="restaurer"]'), 'restaurer une sauvegarde dès l\'accueil');
  cliquer('[data-action="continuer"]');
  egal(doc.getElementById('premier-lancement').dataset.etape, 'teint', 'puis le teint');
  vrai(doc.getElementById('teint-actif').hasAttribute('switch'), 'interrupteur natif d\'iOS (switch)');
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
  // Composants iOS : icône dans chaque onglet, barre de navigation avec bouton « + », grand titre.
  vrai([...doc.querySelectorAll('#onglets [data-ecran]')].every((b) => b.querySelector('svg.icone')), 'icônes des onglets');
  vrai(doc.querySelector('.barre-nav [data-action="ajouter"]'), 'bouton « + » dans la barre du haut');
  egal(doc.querySelector('.entete-ecran h1').textContent, 'Garde-robe');
  egal(fenetre.getComputedStyle(doc.querySelector('.entete-ecran h1')).userSelect, 'none', 'texte non sélectionnable');
  vrai(doc.querySelector('.cartes-actions [data-action="scanner"]') && doc.querySelector('.cartes-actions [data-action="ajouter-vetement"]'),
    'garde-robe vide : deux grandes cartes d\'ajout');
});

test('app : feuille fermée en la balayant vers le bas depuis son en-tête', async () => {
  cliquer('[data-action="ajouter-vetement"]');
  const feuille = await dialogueOuvert('dialog.feuille[open]');
  vrai(feuille.querySelector('.poignee'), 'poignée');
  const entete = feuille.querySelector('.feuille-entete');
  const pointeur = (type, y) => entete.dispatchEvent(new fenetre.PointerEvent(type, { bubbles: true, pointerId: 7, clientY: y }));
  pointeur('pointerdown', 100);
  pointeur('pointermove', 180);
  pointeur('pointermove', 260);
  pointeur('pointerup', 260);
  await dialoguesFermes();
  egal(stocke().vetements.length, 0);
});

test('app : double tape, le second toucher ne choisit rien dans le dialogue qui vient de s\'ouvrir', async () => {
  cliquer('[data-action="ajouter-vetement"]');
  const dialogue = doc.querySelector('dialog[open]');
  cliquer('[data-choix="bijoux"]', dialogue);
  vrai(dialogue.open && dialogue.isConnected, 'le clic immédiat est ignoré');
  egal(doc.querySelector('dialog.selecteur'), null, 'aucun sélecteur ouvert');
  cliquer('[data-action="fermer-feuille"]', await dialogueOuvert());
  await dialoguesFermes();
  egal(stocke().vetements.length, 0);
});

test('app : manques fréquents sans tenue demandée, invitation et bouton vers la tenue', async () => {
  cliquer('#onglets [data-ecran="mes-tenues"]');
  vrai(doc.querySelector('[data-info="sans-tenue"]'), 'invitation à demander une tenue');
  egal(doc.querySelector('[data-info="calcul"]'), null, 'aucun calcul sans tenue type');
  cliquer('[data-action="aller-tenue"]');
  egal(doc.querySelector('#onglets [aria-current="page"]').dataset.ecran, 'tenue');
});

test('app : tenue du jour avec une garde-robe vide, message d\'invitation et aucune proposition', async () => {
  cliquer('#onglets [data-ecran="tenue"]');
  vrai(doc.querySelector('[data-action="proposer"]').disabled, 'Proposer désactivé sans pièce');
  for (const type of ['chaussures', 'pantalon', 't-shirt']) cliquer(`[data-type-tenue="${type}"]`);
  cliquer('[data-action="proposer"]');
  await quand(() => doc.querySelector('[data-info="garde-robe-vide"]'), 'message garde-robe vide');
  egal(doc.querySelectorAll('.proposition').length, 0, '3 pièces sans vêtement : 3 manques, tout est écarté');
  vrai(doc.querySelector('[data-info="compte"]').textContent.startsWith('Aucune combinaison ne convient'));
  egalProfond(stocke().tenuesTypes, [['chaussures', 'pantalon', 't-shirt']], 'tenue type enregistrée');
  cliquer('#onglets [data-ecran="mes-tenues"]');
  await quand(() => doc.querySelector('[data-info="sans-proposition"]'), 'manques : aucune proposition retenue');
  vrai(doc.querySelector('[data-info="bilan"]').textContent.includes('sur 0 proposition pour ta tenue type'));
  cliquer('#onglets [data-ecran="garde-robe"]');
});

test('app : ajout d\'un pull choisi dans le catalogue (recherche « burnt sienna »)', async () => {
  cliquer('[data-action="ajouter-vetement"]');
  cliquer('[data-choix="pull"]', await dialogueOuvert());
  const selecteur = await dialogueOuvert('dialog.selecteur[open]');
  egal(fenetre.getComputedStyle(selecteur.querySelector('[data-action="rechercher"]')).userSelect, 'text', 'champ de recherche : saisie possible');
  await rechercher(selecteur, 'burnt sienna');
  const carte = await attendre(() => [...selecteur.querySelectorAll('[data-action="choisir-couleur"]')]
    .find((b) => b.querySelector('.nom').textContent === 'Burnt Sienna'), 'carte Burnt Sienna');
  carte.click();
  await sansPhoto();
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
  vrai(!dialogue.querySelector('.ligne-photo').textContent.includes('null'), 'aucun « null » affiché');
  const marque = dialogue.querySelector('#marque-vetement');
  marque.value = '  Uniqlo ';
  // Photo depuis la fiche : iOS propose appareil photo ou photothèque (pas d'attribut capture).
  cliquer('[data-action="photo-vetement"]', dialogue);
  const champ = await fournirPhoto(await photoUnie('#aa5533', 300, 200));
  egal(champ.getAttribute('capture'), null, 'appareil photo ou photothèque au choix');
  await attendreReel(() => dialogue.querySelector('img.vignette-fiche'), 'vignette de la photo');
  cliquer('[data-valeur="ok"]', dialogue);
  await dialoguesFermes();
  await quand(() => doc.querySelector('[data-type="veste"] .vetement'), 'rangé sous Veste');
  const [vetement] = stocke().vetements;
  egal(vetement.type, 'veste');
  egal(vetement.marque, 'Uniqlo', 'marque enregistrée (espaces retirés)');
  egal(vetement.photo, true);
  vrai(doc.querySelector('[data-type="veste"] .visuel-vetement img'), 'photo dans la liste');
  vrai(doc.querySelector('[data-type="veste"] .marque').textContent.startsWith('Uniqlo'), 'marque dans la liste');
  let enBase = null; // l'écriture dans IndexedDB suit l'enregistrement : on relit jusqu'à la trouver
  for (let essai = 0; essai < 30 && !enBase?.get(vetement.id); essai++) enBase = await photosDeTest();
  vrai(enBase.get(vetement.id)?.startsWith('data:image/jpeg'), 'photo gardée dans IndexedDB');

  // Retirer la photo depuis la fiche.
  cliquer('[data-type="veste"] [data-action="modifier"]');
  const fiche = await dialogueOuvert();
  cliquer('[data-action="retirer-photo"]', fiche);
  cliquer('[data-valeur="ok"]', fiche);
  await dialoguesFermes();
  await quand(() => stocke().vetements[0].photo === undefined, 'photo retirée');
  egal(doc.querySelector('[data-type="veste"] .visuel-vetement'), null);
  for (let essai = 0; essai < 30 && enBase.has(vetement.id); essai++) enBase = await photosDeTest();
  egal(enBase.has(vetement.id), false, 'photo effacée de IndexedDB');
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
  // Les couleurs XKCD (pour nommer, sans combinaison) ne peuvent pas être favorites.
  await rechercher(selecteur, 'blanc cassé');
  await attendre(() => selecteur.querySelector('.compte')?.textContent === 'Aucune couleur ne correspond.', 'aucun blanc cassé');
  cliquer('[data-action="fermer-selecteur"]', selecteur);
  await dialoguesFermes();
  await quand(() => doc.getElementById('contenu').textContent.includes('1 couleur favorite'), 'favori affiché');
});

test('app : couleurs nommées XKCD, cherchées en français ou en anglais, sans étoile', async () => {
  cliquer('#onglets [data-ecran="garde-robe"]');
  await menuAjout('ajouter-vetement');
  cliquer('[data-choix="pull"]', await dialogueOuvert());
  const selecteur = await dialogueOuvert('dialog.selecteur[open]');
  for (const recherche of ['blanc casse', 'off white']) {
    await rechercher(selecteur, recherche);
    const cartes = await attendre(() => {
      const trouvees = [...selecteur.querySelectorAll('.carte-couleur')];
      return trouvees.length > 0 && trouvees.every((c) => c.querySelector('.nom').textContent !== '') ? trouvees : null;
    }, `résultats pour « ${recherche} »`);
    const blanc = cartes.find((c) => c.querySelector('.nom').textContent === 'Blanc cassé');
    vrai(blanc, `« ${recherche} » trouve « Blanc cassé »`);
    egal(blanc.querySelector('[data-action="etoile"]'), null, 'pas d\'étoile : aucune combinaison ne la cite');
  }
  await rechercher(selecteur, '');
  const beiges = await attendre(() => selecteur.querySelector('[data-famille="beiges"]'), 'tuile des beiges');
  beiges.click();
  await attendre(() => [...selecteur.querySelectorAll('.carte-couleur .nom')].some((n) => n.textContent === 'Ivoire'), 'ivoire dans les beiges et crèmes');
  cliquer('[data-action="fermer-selecteur"]', selecteur);
  await dialoguesFermes();
  cliquer('#onglets [data-ecran="reglages"]'); // les tests suivants partent des réglages
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
  await menuAjout('ajouter-vetement');
  cliquer('[data-choix="chaussures"]', await dialogueOuvert());
  const selecteur = await dialogueOuvert('dialog.selecteur[open]');
  // Carte des couleurs : mosaïque des familles (★ Favoris d'abord) ; une famille ouvre toutes ses variations.
  const tuiles = [...selecteur.querySelectorAll('.mosaique [data-famille]')].map((t) => t.dataset.famille);
  egal(tuiles[0], 'favoris', 'favoris en premier (Burnt Sienna, ajoutée plus haut)');
  vrai(tuiles.length === 13 && tuiles.includes('neutres') && tuiles.includes('bleus'), `12 familles et les favoris : ${tuiles}`);
  vrai(selecteur.querySelector('[data-action="retour-carte"]').hidden, 'pas de retour sur la carte');
  cliquer('[data-famille="bleus"]', selecteur);
  egal(selecteur.querySelector('h2').textContent, 'Bleus');
  vrai(!selecteur.querySelector('[data-action="retour-carte"]').hidden, '« ‹ Carte » dans la section');
  const variations = [...selecteur.querySelectorAll('[data-action="choisir-couleur"]')];
  vrai(variations.some((b) => b.querySelector('.nom').textContent === 'Blue'), 'Blue parmi les bleus');
  const clartes = variations.map((b) => labDepuisHex(b.querySelector('.detail').textContent).L);
  vrai(clartes.every((L, i) => i === 0 || L <= clartes[i - 1]), 'du plus clair au plus foncé');
  cliquer('[data-action="retour-carte"]', selecteur);
  vrai(selecteur.querySelector('.mosaique'), 'retour à la carte');
  await rechercher(selecteur, 'exemple a, dominante 1');
  cliquer('[data-action="choisir-couleur"]', selecteur);
  // Proposition de photo : « Ajouter » ouvre l'appareil photo ou la photothèque, et la photo est gardée.
  const alerte = await attendre(() => [...doc.querySelectorAll('dialog.alerte-photo[open]')].find((d) => 'pret' in d.dataset), 'proposition de photo');
  cliquer('[data-valeur="photo"]', alerte);
  await fournirPhoto(await photoUnie('#224466', 200, 200));
  await dialoguesFermes();
  await attendreReel(() => stocke().vetements.length === 2, 'chaussures enregistrées avec leur photo');
  egal(stocke().vetements[1].photo, true, 'photo gardée');
  await quand(() => doc.querySelector('[data-type="chaussures"] .nom'), 'chaussures affichées');
  egal(doc.querySelector('[data-type="chaussures"] .nom').textContent, 'Exemple A, dominante 1');
  egal(stocke().vetements.length, 2);
});

test('app : suppression depuis la fenêtre de modification, après confirmation', async () => {
  cliquer('[data-type="chaussures"] [data-action="modifier"]');
  cliquer('[data-action="supprimer"]', await dialogueOuvert());
  const dialogue = await attendre(() => [...doc.querySelectorAll('dialog[open]')]
    .find((d) => d.querySelector('h2').textContent === 'Supprimer ce vêtement ?' && 'pret' in d.dataset), 'confirmation');
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
  cliquer('[data-action="fermer-feuille"]', dialogue);
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

// Mesure tout-en-un : la feuille du résultat monte dans l'écran caméra, prête (anti double tape écoulé).
const resultatPret = () => [...doc.querySelectorAll('dialog.scan[open]')]
  .find((d) => d.dataset.etape === 'resultat' && 'pret' in d.dataset);
const cartesChoix = (feuille) => [...feuille.querySelectorAll('.rangee-choix [data-couleur]:not([data-couleur="mesure"])')];

// La caméra simulée d'Edge montre une forme vert vif qui tourne : quand elle couvre le réticule pendant la mesure,
// l'app répond (à raison) « reflet trop fort ». On recommence alors, comme le ferait l'utilisateur (5 essais au plus).
async function mesurerCamera(scan) {
  for (let essai = 1; essai <= 5; essai++) {
    const mesurer = await attendreReel(() => {
      const bouton = scan.querySelector('[data-action="mesurer"]');
      return bouton && !bouton.disabled ? bouton : null;
    }, 'déclencheur disponible');
    mesurer.click();
    const fin = await attendreReel(() => resultatPret()
      ?? (!mesurer.disabled && scan.querySelector('.etat-scan').textContent.startsWith('Reflet') ? 'reflet' : null), 'fin de la mesure');
    if (fin !== 'reflet') return fin;
  }
  throw new Error('reflet à chaque essai');
}

test('app : mesure par photo, feuille tout-en-un (couleur, ajustement, type) sans défilement, puis enregistrement', async () => {
  cliquer('#onglets [data-ecran="garde-robe"]');
  await menuAjout('scanner');
  const scan = await dialogueOuvert('dialog.scan[open]');
  vrai(scan.querySelector('.declencheur[data-action="mesurer"]') && scan.querySelector('[data-action="photo"]'), 'déclencheur et photo');
  cliquer('[data-action="aide"]', scan);
  vrai(!scan.querySelector('.aide-scan').hidden, 'aide affichée d\'un toucher');
  cliquer('[data-action="photo"]', scan);
  const champ = await fournirPhoto(await photoSynthetique());
  // Sans attribut capture : iOS propose la photothèque ou l'appareil photo (demande de Théo, 2026-09-27).
  egal(champ.getAttribute('capture'), null, 'photothèque ou appareil photo au choix');
  egal(champ.accept, 'image/*');
  await attendreReel(() => scan.dataset.etape === 'resultat', 'décodage de la photo');
  const feuille = scan.querySelector('.feuille-resultat');
  cliquer('[data-type="pull"]', feuille);
  egal(feuille.querySelector('[data-type="pull"]').getAttribute('aria-pressed'), 'false', 'toucher trop rapide ignoré');
  await attendre(() => resultatPret(), 'feuille prête');
  vrai(!feuille.hidden && scan.querySelector('img.image-figee').hidden === false, 'photo figée en fond, feuille visible');
  egal(scan.querySelector('.aide-scan').hidden, true, 'aide refermée');
  vrai(feuille.scrollHeight <= feuille.clientHeight + 1, `tout tient sans défiler (${feuille.scrollHeight} ≤ ${feuille.clientHeight})`);
  vrai(feuille.querySelector('.resultat-entete').textContent.includes('#a07e56'), 'couleur mesurée affichée');
  egal(feuille.querySelector('.resultat-pastille').style.backgroundColor, 'rgb(160, 126, 86)');
  egal(feuille.querySelector('[data-couleur="mesure"]').getAttribute('aria-selected'), 'true', 'la mesure est retenue par défaut');
  vrai(!feuille.textContent.includes('null'), 'aucun « null » affiché');
  egal(feuille.querySelector('[data-type="bijoux"]'), null, 'bijoux : choix manuel seulement');
  vrai(feuille.querySelector('[data-action="enregistrer-scan"]').disabled, 'type à choisir d\'abord');
  cliquer('[data-type="chaussures"]', feuille);
  vrai(!feuille.querySelector('[data-action="enregistrer-scan"]').disabled);
  // Marque et photo, facultatives, directement dans la feuille de mesure.
  feuille.querySelector('[data-action="marque"]').value = 'Lacoste';
  cliquer('[data-action="photo-resultat"]', feuille);
  await fournirPhoto(await photoUnie('#205080', 240, 320));
  await attendreReel(() => feuille.querySelector('.bouton-photo img'), 'vignette dans la feuille');
  vrai(feuille.scrollHeight <= feuille.clientHeight + 1, 'toujours sans défilement avec marque et photo');
  cliquer('[data-action="enregistrer-scan"]', feuille);
  await dialoguesFermes();
  await quand(() => stocke().vetements.length === 1, 'vêtement mesuré enregistré');
  const { id, dateAjout, ...vetement } = stocke().vetements[0];
  egalProfond(vetement, { type: 'chaussures', hex: '#a07e56', origine: 'scan', marque: 'Lacoste', photo: true });
  vrai(doc.querySelector('[data-type="chaussures"] .visuel-vetement img'), 'photo dans la liste');
  vrai(doc.querySelector('[data-type="chaussures"] .nom').textContent.includes('#a07e56'));
});

test('app : mesure à la caméra (simulée, sans torche), plein écran, Recommencer, ajustement d\'un toucher, enregistrement', async () => {
  await menuAjout('scanner');
  const scan = await dialogueOuvert('dialog.scan[open]');
  const pret = () => attendreReel(() => {
    const bouton = scan.querySelector('[data-action="mesurer"]');
    return bouton && !bouton.disabled ? bouton : null;
  }, 'image de la caméra simulée');
  const mesurer = await pret();
  vrai(scan.querySelector('[data-action="torche"]').hidden, 'pas de bouton torche sans torche');
  vrai(!scan.querySelector('.reticule').hidden && parseFloat(scan.querySelector('.reticule').style.width) > 0, 'réticule placé');
  const zone = mesurer.getBoundingClientRect();
  vrai(zone.top >= 0 && zone.bottom <= fenetre.innerHeight, 'déclencheur visible sans défiler');
  mesurer.click();
  vrai(mesurer.classList.contains('en-cours') && mesurer.disabled, 'mesure en cours : déclencheur occupé');
  egal(scan.querySelector('.etat-scan').textContent, 'Mesure en cours : ne bouge pas…');
  const fin = await attendreReel(() => resultatPret()
    ?? (!mesurer.disabled && scan.querySelector('.etat-scan').textContent.startsWith('Reflet') ? 'reflet' : null), 'fin de la première mesure');
  if (fin === 'reflet') await mesurerCamera(scan);
  const images = Number(scan.querySelector('.feuille-resultat').dataset.images);
  vrai(images >= 5 && images <= 10, `mesure combinée sur plusieurs images (${images} sur 10)`);
  egal(scan.querySelector('canvas.image-figee').hidden, false, 'image figée');
  cliquer('[data-action="recommencer"]', scan.querySelector('.feuille-resultat'));
  vrai(scan.querySelector('.feuille-resultat').hidden, 'Recommencer : feuille retirée');
  await mesurerCamera(scan);
  const feuille = scan.querySelector('.feuille-resultat');
  vrai(feuille.scrollHeight <= feuille.clientHeight + 1, `tout tient sans défiler (${feuille.scrollHeight} ≤ ${feuille.clientHeight})`);

  const proches = cartesChoix(feuille);
  egal(proches.length, 12, '12 couleurs proches');
  const ecarts = proches.map((c) => parseFloat(c.querySelector('.detail').textContent.replace('ΔE ', '').replace(',', '.')));
  vrai(ecarts.every((e, i) => i === 0 || e >= ecarts[i - 1]), `du plus proche au plus éloigné : ${ecarts}`);
  cliquer('[data-segment="neutres"]', feuille);
  const neutres = cartesChoix(feuille).map((c) => c.querySelector('.nom').textContent);
  egal(neutres[0], 'Noir', 'neutres du plus foncé au plus clair : le noir d\'abord (#000000 de XKCD, puis Black)');
  vrai(neutres.indexOf('Black') < neutres.indexOf('Gris clair') && neutres.indexOf('Gris clair') < neutres.indexOf('White'), `ordre : ${neutres}`);
  egal(neutres[neutres.length - 1], 'Blanc', 'White et Blanc (#ffffff) en dernier, Wada d\'abord');
  vrai(neutres.length >= 23, `les 7 neutres des combinaisons (C* ≤ 8), les 16 de XKCD, plus ceux de Papier Tigre importés plus haut : ${neutres}`);
  cliquer('[data-segment="proches"]', feuille);
  const choisie = cartesChoix(feuille)[1];
  const idChoisi = choisie.dataset.couleur;
  const nomChoisi = choisie.querySelector('.nom').textContent;
  choisie.click();
  egal(choisie.getAttribute('aria-selected'), 'true');
  egal(feuille.querySelector('[data-couleur="mesure"]').getAttribute('aria-selected'), 'false');
  vrai(feuille.querySelector('.resultat-entete').textContent.includes(nomChoisi), 'choix affiché en haut');
  vrai(feuille.querySelector('[data-action="tout-catalogue"]'), 'accès à tout le catalogue');
  cliquer('[data-type="pull"]', feuille);
  cliquer('[data-action="enregistrer-scan"]', feuille);
  await sansPhoto();
  await dialoguesFermes();
  await quand(() => stocke().vetements.length === 2, 'second vêtement mesuré enregistré');
  const vetement = stocke().vetements[1];
  egal(vetement.origine, 'scan');
  egal(vetement.idCouleurCatalogue, idChoisi);
  egal(doc.querySelector('[data-type="pull"] .nom').textContent, nomChoisi, 'nom et hex du catalogue');
});

// Écran de mesure de l'étalonnage, prêt (anti double tape écoulé).
const scanEtalonnage = (titre) => attendre(() => [...doc.querySelectorAll('dialog.scan[open]')]
  .find((d) => d.querySelector('h2').textContent === titre && 'pret' in d.dataset), `mesure « ${titre} »`);

// Étalonnage par photo : le déclencheur ouvre l'appareil photo, puis « Utiliser cette mesure » dans la feuille.
async function etalonnerParPhoto(titre, hex) {
  const scan = await scanEtalonnage(titre);
  egal(scan.querySelector('[data-action="photo"]').style.visibility, 'hidden', 'pas de second bouton photo');
  vrai(!scan.querySelector('[data-action="mesurer"]').disabled, 'déclencheur prêt, sans caméra');
  cliquer('[data-action="mesurer"]', scan);
  await fournirPhoto(await photoUnie(hex));
  await attendreReel(() => resultatPret() === scan, `résultat « ${titre} »`);
  cliquer('[data-action="utiliser-mesure"]', scan);
}

// Étalonnage à la caméra : mesure (réessayée en cas de reflet), puis « Utiliser cette mesure ».
async function etalonnerCamera(titre) {
  const scan = await scanEtalonnage(titre);
  await mesurerCamera(scan);
  cliquer('[data-action="utiliser-mesure"]', scan);
  return scan;
}

// Caméra simulée avec torche (demande de Théo, 2026-09-27 : étalonner avec et sans torche) : flux d'une toile unie
// de la couleur voulue ; la torche demandée par l'app est notée. retirer() rend la caméra simulée d'Edge.
function cameraAvecTorche() {
  const toile = fenetre.document.createElement('canvas');
  toile.width = 320;
  toile.height = 240;
  const camera = { couleur: '#dcdce6', torche: [] };
  const peindre = () => {
    const contexte = toile.getContext('2d');
    contexte.fillStyle = camera.couleur;
    contexte.fillRect(0, 0, toile.width, toile.height);
  };
  peindre();
  const minuterie = fenetre.setInterval(peindre, 40); // une image par dessin
  const media = fenetre.navigator.mediaDevices;
  media.getUserMedia = async () => {
    const flux = toile.captureStream(25);
    const piste = flux.getVideoTracks()[0];
    piste.getCapabilities = () => ({ torch: true });
    piste.applyConstraints = async (contraintes) => { camera.torche.push(contraintes.advanced[0].torch); };
    return flux;
  };
  camera.retirer = () => {
    fenetre.clearInterval(minuterie);
    delete media.getUserMedia;
  };
  return camera;
}

test('app : étalonnage par photos (blanc, noir), puis un vêtement noir corrigé en « Black »', async () => {
  cliquer('#onglets [data-ecran="reglages"]');
  egal(doc.querySelector('[data-mode="photo"] .valeur-ligne').textContent, 'non étalonné');
  cliquer('[data-mode="photo"][data-action="etalonner"]');
  const depart = await dialogueOuvert();
  egal(depart.querySelector('h2').textContent, 'Étalonner : par photo');
  egal(depart.querySelector('[data-action="supprimer-etalonnage"]'), null, 'rien à supprimer');
  cliquer('[data-valeur="commencer"]', depart);
  await etalonnerParPhoto('Étalonnage : vêtement blanc', '#dcdce6');
  await etalonnerParPhoto('Étalonnage : vêtement noir', '#46464f');
  await attendreReel(() => stocke().reglages.etalonnage?.photo, 'étalonnage enregistré');
  egalProfond(stocke().reglages.etalonnage.photo.blanc, [220, 220, 230]);
  egalProfond(stocke().reglages.etalonnage.photo.noir, [70, 70, 79]);
  await quand(() => doc.querySelector('[data-mode="photo"] .valeur-ligne')?.textContent.startsWith('étalonné le'), 'état affiché');
  egal(doc.querySelector('[data-mode="torche"] .valeur-ligne').textContent, 'non étalonné', 'un étalonnage par façon de mesurer');

  cliquer('#onglets [data-ecran="garde-robe"]');
  await menuAjout('scanner');
  const scan = await dialogueOuvert('dialog.scan[open]');
  cliquer('[data-action="photo"]', scan);
  await fournirPhoto(await photoUnie('#46464f'));
  await attendreReel(() => resultatPret(), 'résultat corrigé');
  const feuille = scan.querySelector('.feuille-resultat');
  egal(feuille.querySelector('.resultat-pastille').style.backgroundColor, 'rgb(17, 19, 20)', 'noir mesuré recalé sur Black');
  vrai(feuille.querySelector('[data-info="etalonnage"]').textContent.includes('#46464f'), 'mesure brute affichée');
  cliquer('[data-type="pantalon"]', feuille);
  cliquer('[data-action="enregistrer-scan"]', feuille);
  await sansPhoto();
  await dialoguesFermes();
  await quand(() => stocke().vetements.length === 3, 'pantalon enregistré');
  egal(stocke().vetements[2].hex, '#111314');
});

test('app : étalonnage « avec la torche » sur un appareil sans torche, refusé avant toute mesure', async () => {
  cliquer('#onglets [data-ecran="reglages"]');
  cliquer('[data-mode="torche"][data-action="etalonner"]');
  const depart = await dialogueOuvert();
  egal(depart.querySelector('h2').textContent, 'Étalonner : avec la torche');
  cliquer('[data-valeur="commencer"]', depart);
  const scan = await scanEtalonnage('Étalonnage : vêtement blanc');
  await attendreReel(() => scan.querySelector('.etat-scan').textContent.startsWith('Pas de torche'), 'message sans torche');
  vrai(scan.querySelector('[data-action="mesurer"]').disabled, 'aucune mesure possible');
  cliquer('[data-action="annuler-scan"]', scan);
  await dialoguesFermes();
  egalProfond(Object.keys(stocke().reglages.etalonnage), ['photo'], 'rien d\'enregistré');
});

test('app : étalonnages avec et sans torche, chacun gardé à côté de celui par photo', async () => {
  const camera = cameraAvecTorche();
  try {
    cliquer('[data-mode="torche"][data-action="etalonner"]');
    cliquer('[data-valeur="commencer"]', await dialogueOuvert());
    let scan = await scanEtalonnage('Étalonnage : vêtement blanc');
    await attendreReel(() => camera.torche.includes(true) && !scan.querySelector('[data-action="mesurer"]').disabled, 'torche allumée, déclencheur prêt');
    vrai(scan.querySelector('[data-action="torche"]').hidden, 'torche imposée : pas de bascule');
    egal(scan.querySelector('[data-action="photo"]').style.visibility, 'hidden', 'pas de photo pendant cet étalonnage');
    await etalonnerCamera('Étalonnage : vêtement blanc');
    camera.couleur = '#46464f';
    await etalonnerCamera('Étalonnage : vêtement noir');
    await attendreReel(() => stocke().reglages.etalonnage?.torche, 'étalonnage avec la torche enregistré');

    // Sans torche : la torche n'est jamais allumée.
    const avant = camera.torche.length;
    camera.couleur = '#dcdce6';
    cliquer('[data-mode="sans-torche"][data-action="etalonner"]');
    const depart = await dialogueOuvert();
    egal(depart.querySelector('h2').textContent, 'Étalonner : sans torche');
    cliquer('[data-valeur="commencer"]', depart);
    scan = await etalonnerCamera('Étalonnage : vêtement blanc');
    vrai(scan.querySelector('[data-action="torche"]').hidden, 'pas de bouton torche');
    camera.couleur = '#46464f';
    await etalonnerCamera('Étalonnage : vêtement noir');
    await attendreReel(() => stocke().reglages.etalonnage?.['sans-torche'], 'étalonnage sans torche enregistré');
    egal(camera.torche.slice(avant).includes(true), false, 'torche jamais allumée');
  } finally {
    camera.retirer();
  }
  const { etalonnage } = stocke().reglages;
  egalProfond(Object.keys(etalonnage).sort(), ['photo', 'sans-torche', 'torche'], 'trois étalonnages, un par façon de mesurer');
  for (const mode of ['torche', 'sans-torche']) {
    vrai(etalonnage[mode].blanc.every((v, i) => Math.abs(v - [220, 220, 230][i]) <= 6), `${mode} : blanc ${etalonnage[mode].blanc}`);
    vrai(etalonnage[mode].noir.every((v, i) => Math.abs(v - [70, 70, 79][i]) <= 6), `${mode} : noir ${etalonnage[mode].noir}`);
  }
  await quand(() => doc.querySelector('[data-mode="sans-torche"] .valeur-ligne')?.textContent.startsWith('étalonné le'), 'état affiché');

  // Supprimer un seul étalonnage : les autres restent.
  cliquer('[data-mode="torche"][data-action="etalonner"]');
  const fiche = await dialogueOuvert();
  egal(fiche.querySelector('[data-valeur="commencer"]').textContent, 'Refaire');
  cliquer('[data-action="supprimer-etalonnage"]', fiche);
  const alerte = await attendre(() => [...doc.querySelectorAll('dialog.alerte[open]')].find((d) => 'pret' in d.dataset), 'confirmation');
  cliquer('[data-valeur="oui"]', alerte);
  await dialoguesFermes();
  await quand(() => !stocke().reglages.etalonnage.torche, 'étalonnage avec la torche supprimé');
  egalProfond(Object.keys(stocke().reglages.etalonnage).sort(), ['photo', 'sans-torche']);
  await quand(() => doc.querySelector('[data-mode="torche"] .valeur-ligne')?.textContent === 'non étalonné', 'ligne à jour');
});

test('app : tenue du jour, propositions, avatar, sélection, favoris et filtre', async () => {
  cliquer('#onglets [data-ecran="tenue"]');
  cliquer('[data-type-tenue="short"]');
  egal(doc.querySelector('[data-type-tenue="pantalon"]').getAttribute('aria-pressed'), 'false', 'short et pantalon exclusifs');
  cliquer('[data-type-tenue="pantalon"]');
  egal(doc.querySelector('[data-type-tenue="short"]').getAttribute('aria-pressed'), 'false');
  // La robe écarte le bas et le t-shirt ; un bas écarte la robe.
  const presse = (type) => doc.querySelector(`[data-type-tenue="${type}"]`).getAttribute('aria-pressed');
  cliquer('[data-type-tenue="robe"]');
  vrai(presse('robe') === 'true' && presse('pantalon') === 'false' && presse('t-shirt') === 'false', 'robe : ni bas ni t-shirt');
  cliquer('[data-type-tenue="jupe"]');
  vrai(presse('jupe') === 'true' && presse('robe') === 'false', 'jupe : plus de robe');
  cliquer('[data-type-tenue="pantalon"]');
  egal(presse('jupe'), 'false', 'un seul bas');
  cliquer('[data-type-tenue="t-shirt"]'); // on revient à la tenue de départ (t-shirt coché)
  cliquer('[data-type-tenue="t-shirt"]');
  cliquer('[data-type-tenue="pull"]');
  vrai(doc.querySelector('[data-action="proposer"]').classList.contains('bouton-flottant'), '« Proposer » flotte en bas');
  cliquer('[data-action="proposer"]');
  await quand(() => doc.querySelector('.proposition'), 'propositions');
  egal(doc.querySelector('[data-action="proposer"]'), null, 'plus de bouton flottant une fois proposé');
  const cartes = [...doc.querySelectorAll('.proposition')];
  vrai(cartes.length >= 2 && cartes.length <= 20, `entre 2 et 20 propositions (${cartes.length})`);
  const references = cartes.map((c) => c.querySelector('.infos strong').textContent);
  vrai(references.some((r) => r.startsWith('Combinaison n° ')) && references.every((r) => !r.includes('Wada')),
    `« Combinaison n° » au lieu de « Wada » : ${references.slice(0, 3).join(' ; ')}`);
  egal(cartes[0].getAttribute('aria-pressed'), 'true', 'la première est sélectionnée');
  vrai(stocke().tenuesTypes.some((tenue) => tenue.join(',') === 'chaussures,pantalon,pull'), 'tenue type enregistrée');
  const panneau = doc.querySelector('.panneau-avatar');
  egal(panneau.dataset.selection, cartes[0].dataset.combinaison);
  const zones = [...panneau.querySelectorAll('svg g[data-type]')].map((g) => g.dataset.type);
  egalProfond(zones.filter((z) => z !== 'ceinture').sort(), ['chaussures', 'pantalon', 'pull'], 'avatar : les pièces de la tenue');
  vrai(doc.querySelector('.details .pieces'), 'détail de la proposition choisie');
  cartes[1].click();
  egal(doc.querySelector('.panneau-avatar').dataset.selection, cartes[1].dataset.combinaison, 'l\'avatar suit la proposition touchée');
  egal(doc.querySelectorAll('.proposition[aria-pressed="true"]').length, 1);
  const favorisAvant = stocke().reglages.favoris.length;
  const etoile = doc.querySelector('[data-action="etoile-proposition"][aria-pressed="false"]');
  const idEtoile = etoile.dataset.couleur;
  etoile.click();
  await quand(() => stocke().reglages.favoris.length === favorisAvant + 1, 'favori ajouté');
  vrai(stocke().reglages.favoris.includes(idEtoile));
  doc.getElementById('filtre-favoris').click();
  await quand(() => doc.getElementById('filtre-favoris')?.checked, 'filtre actif');
  const filtrees = [...doc.querySelectorAll('.proposition')];
  vrai(filtrees.length > 0 && filtrees.every((c) => c.textContent.includes('★')), 'filtre : seulement des propositions avec un favori');
});

test('app : ♡ garder une tenue, la retrouver dans Mes tenues avec son avatar, la nommer, puis la retirer', async () => {
  const garder = doc.querySelector('.panneau-avatar [data-action="garder-tenue"]');
  egal(garder.getAttribute('aria-pressed'), 'false');
  const reference = doc.querySelector('.panneau-avatar .legende strong').textContent;
  garder.click();
  await quand(() => stocke().tenuesGardees.length === 1, 'tenue gardée');
  egal(doc.querySelector('.panneau-avatar [data-action="garder-tenue"]').getAttribute('aria-pressed'), 'true', 'cœur plein');
  const gardee = stocke().tenuesGardees[0];
  egal(`Combinaison ${gardee.combinaison.ref}`, reference);
  // Partager depuis la tenue du jour : image PNG par le partage d'iOS.
  const partages = simulerPartage();
  cliquer('.panneau-avatar [data-action="partager-tenue"]');
  await attendreReel(() => partages.length === 1, 'partage depuis la tenue du jour');
  egal(partages[0].files[0].type, 'image/png');
  vrai(partages[0].files[0].size > 10000, 'image non vide');
  vrai(gardee.pieces.every((p) => /^#[0-9a-f]{6}$/.test(p.hex)), 'couleurs figées');

  cliquer('#onglets [data-ecran="mes-tenues"]');
  const carte = await attendre(() => doc.querySelector(`[data-tenue-gardee="${gardee.id}"]`), 'carte de la tenue');
  vrai(carte.querySelector('svg.avatar g[data-type]'), 'avatar habillé sur la carte');
  egal(carte.querySelector('.nom-tenue').textContent, reference);
  vrai(doc.getElementById('ce-qui-te-manque'), 'les manques fréquents sont en bas de Mes tenues');
  carte.click();
  const feuille = await dialogueOuvert('dialog.detail-tenue[open]');
  egal(feuille.querySelectorAll('.piece-tenue').length, gardee.pieces.length, 'une ligne par pièce');
  const champ = feuille.querySelector('[data-action="nom-tenue"]');
  champ.value = '  Dîner chez Julie ';
  champ.dispatchEvent(new fenetre.Event('change'));
  await quand(() => stocke().tenuesGardees[0].nom === 'Dîner chez Julie', 'nom enregistré');
  cliquer('[data-action="fermer-feuille"]', feuille);
  await dialoguesFermes();
  await quand(() => doc.querySelector(`[data-tenue-gardee="${gardee.id}"] .nom-tenue`)?.textContent === 'Dîner chez Julie', 'nom sur la carte');

  cliquer(`[data-tenue-gardee="${gardee.id}"]`);
  const detail = await dialogueOuvert('dialog.detail-tenue[open]');
  cliquer('[data-action="partager-tenue-gardee"]', detail);
  await attendreReel(() => partages.length === 2, 'partage depuis Mes tenues');
  egal(partages[1].files[0].name, 'tenue-diner-chez-julie.png', 'fichier nommé d\'après la tenue');
  cliquer('[data-action="fermer-feuille"]', detail);
  await dialoguesFermes();

  cliquer(`[data-tenue-gardee="${gardee.id}"]`);
  cliquer('[data-action="retirer-tenue-gardee"]', await dialogueOuvert('dialog.detail-tenue[open]'));
  const alerte = await attendre(() => [...doc.querySelectorAll('dialog[open]')]
    .find((d) => d.querySelector('h2').textContent === 'Retirer cette tenue ?' && 'pret' in d.dataset), 'confirmation');
  cliquer('[data-valeur="oui"]', alerte);
  await dialoguesFermes();
  await quand(() => stocke().tenuesGardees.length === 0, 'tenue retirée');
  vrai(doc.querySelector('[data-info="sans-tenue-gardee"]'), 'Mes tenues vide');
  cliquer('#onglets [data-ecran="tenue"]');
});

test('app : partir d\'un vêtement (depuis la garde-robe), porté dans chaque proposition ; retrait puis épingle depuis la tenue', async () => {
  cliquer('#onglets [data-ecran="garde-robe"]');
  const pantalon = stocke().vetements.find((v) => v.type === 'pantalon');
  cliquer(`[data-vetement="${pantalon.id}"]`);
  cliquer('[data-action="composer-tenue"]', await dialogueOuvert());
  await dialoguesFermes();
  await quand(() => doc.querySelector('#onglets [aria-current="page"]')?.dataset.ecran === 'tenue', 'onglet Tenue');
  vrai(doc.querySelector('.puce-epingle[data-epingle="pantalon"]'), 'pantalon épinglé');
  vrai(doc.querySelector('.choix-tenue summary').textContent.includes(`avec Couleur mesurée ${pantalon.hex}`), 'rappel dans le résumé');
  cliquer('[data-action="proposer"]');
  await quand(() => doc.getElementById('filtre-favoris'), 'propositions');
  if (doc.getElementById('filtre-favoris').checked) doc.getElementById('filtre-favoris').click(); // filtre du test précédent
  await quand(() => doc.querySelector('.proposition'), 'propositions sans filtre');
  const nb = Math.min(3, doc.querySelectorAll('.proposition').length);
  for (let i = 0; i < nb; i++) {
    doc.querySelectorAll('.proposition')[i].click();
    const ligne = await attendre(() => doc.querySelector('.details [data-epingle="pantalon"]'), `pantalon épinglé dans le détail ${i + 1}`);
    vrai(ligne.textContent.includes(pantalon.hex), `proposition ${i + 1} : le pantalon choisi est porté`);
  }
  doc.querySelector('.choix-tenue').open = true;
  cliquer('.puce-epingle [data-action="retirer-epingle"]');
  egal(doc.querySelector('.puce-epingle'), null, 'épingle retirée');
  cliquer('[data-action="epingler"]');
  cliquer(`[data-choix="${pantalon.id}"]`, await dialogueOuvert());
  await dialoguesFermes();
  vrai(doc.querySelector('.puce-epingle[data-epingle="pantalon"]'), 'épinglé depuis la tenue');
  cliquer('.puce-epingle [data-action="retirer-epingle"]');
});

test('app : manques fréquents, top 10 trié, résultat gardé en mémoire puis recalculé après un réglage', async () => {
  cliquer('#onglets [data-ecran="mes-tenues"]');
  // Déjà calculé au passage précédent dans Mes tenues (même garde-robe, mêmes réglages) : affiché tout de suite.
  await quand(() => doc.querySelector('.manque-frequent'), 'lignes des manques');
  const lignes = [...doc.querySelectorAll('.manque-frequent')];
  vrai(lignes.length >= 1 && lignes.length <= 10, `entre 1 et 10 lignes (${lignes.length})`);
  const nombres = lignes.map((l) => Number(l.dataset.nombre));
  vrai(nombres.every((n, i) => n >= 1 && (i === 0 || n <= nombres[i - 1])), `nombres décroissants (${nombres.join(', ')})`);
  for (const ligne of lignes) {
    vrai(ligne.querySelector('.pastille') && ligne.querySelector('.nom').textContent.length > 0, 'pastille et nom');
    vrai(ligne.querySelector('.detail').textContent.length > 0, 'type');
    if (ligne.dataset.couleur === 'joker') {
      egal(ligne.querySelector('.nom').textContent, 'Noir ou blanc');
      vrai(ligne.querySelector('.pastille').classList.contains('joker'), 'pastille noire et blanche');
    }
  }
  vrai(doc.querySelector('[data-info="bilan"]').textContent.includes('pour tes 2 tenues types'));
  egal(doc.querySelectorAll('.tenues-comptees li').length, 2);

  cliquer('#onglets [data-ecran="garde-robe"]');
  cliquer('#onglets [data-ecran="mes-tenues"]');
  vrai(doc.querySelector('.manque-frequent'), 'résultat gardé en mémoire : affiché sans recalcul');

  cliquer('#onglets [data-ecran="reglages"]');
  const curseur = doc.getElementById('reglage-tolerance');
  curseur.value = '30';
  curseur.dispatchEvent(new fenetre.Event('change'));
  egal(stocke().reglages.tolerance, 30);
  cliquer('#onglets [data-ecran="mes-tenues"]');
  vrai(doc.querySelector('[data-info="calcul"]'), 'réglage changé : recalcul');
  await quand(() => doc.querySelector('.manque-frequent, [data-info="rien-ne-manque"]'), 'nouveau résultat');
});

test('app : manques fréquents, retrait d\'une tenue type après confirmation, dépliant resté ouvert', async () => {
  cliquer('.tenues-comptees summary');
  vrai(doc.querySelector('.tenues-comptees').open, 'dépliant ouvert');
  cliquer('[data-action="retirer-tenue"][data-tenue="chaussures,pantalon,t-shirt"]');
  const dialogue = await attendre(() => [...doc.querySelectorAll('dialog[open]')]
    .find((d) => d.querySelector('h2').textContent === 'Retirer cette tenue ?' && 'pret' in d.dataset), 'confirmation');
  cliquer('[data-valeur="oui"]', dialogue);
  await dialoguesFermes();
  await quand(() => stocke().tenuesTypes.length === 1, 'tenue retirée');
  egalProfond(stocke().tenuesTypes, [['chaussures', 'pantalon', 'pull']]);
  await quand(() => doc.querySelector('[data-info="bilan"]')?.textContent.includes('pour ta tenue type'), 'bilan recalculé');
  vrai(doc.querySelector('.tenues-comptees').open, 'le dépliant reste ouvert');
  egal(doc.querySelectorAll('.tenues-comptees li').length, 1);
});

test('app : « Wada » n\'apparaît que dans les crédits (demande de Théo)', async () => {
  for (const ecran of ['garde-robe', 'tenue', 'mes-tenues', 'reglages']) {
    cliquer(`#onglets [data-ecran="${ecran}"]`);
    await quand(() => !doc.querySelector('[data-info="calcul"]'), `écran ${ecran} calculé`);
    const copie = doc.getElementById('contenu').cloneNode(true);
    copie.querySelector('[data-section="a-propos"]')?.remove();
    vrai(!copie.textContent.includes('Wada'), `aucun « Wada » dans l'écran ${ecran}`);
  }
  vrai(doc.querySelector('[data-section="a-propos"]').textContent.includes('Sanzō Wada'), 'crédits conservés (licence MIT)');
});

test('app : balayer une ligne vers la gauche découvre « Supprimer », puis suppression après confirmation', async () => {
  cliquer('#onglets [data-ecran="garde-robe"]');
  const avant = stocke().vetements.length;
  const li = doc.querySelector('[data-type="pantalon"] .vetement');
  const ligne = li.querySelector('.ligne-vetement');
  const pointeur = (type, x, y = 300) => ligne.dispatchEvent(new fenetre.PointerEvent(type, { bubbles: true, pointerId: 9, clientX: x, clientY: y }));
  // Geste vertical : défilement, la ligne ne bouge pas.
  pointeur('pointerdown', 300, 300);
  pointeur('pointermove', 302, 360);
  pointeur('pointerup', 302, 360);
  vrai(!li.classList.contains('ouverte'), 'un défilement vertical n\'ouvre pas la ligne');
  // Geste horizontal vers la gauche : la ligne s'ouvre et reste ouverte.
  pointeur('pointerdown', 300);
  pointeur('pointermove', 260);
  pointeur('pointermove', 180);
  pointeur('pointerup', 180);
  vrai(li.classList.contains('ouverte'), 'ligne ouverte');
  ligne.click();
  vrai(doc.querySelector('dialog') === null, 'le clic qui suit le geste n\'ouvre pas la modification');
  cliquer('.action-supprimer', li);
  const alerte = await attendre(() => [...doc.querySelectorAll('dialog[open]')]
    .find((d) => d.querySelector('h2').textContent === 'Supprimer ce vêtement ?' && 'pret' in d.dataset), 'confirmation');
  cliquer('[data-valeur="oui"]', alerte);
  await dialoguesFermes();
  await quand(() => stocke().vetements.length === avant - 1, 'vêtement supprimé');
});

test('app : rappel de sauvegarde (jamais sauvegardé), « Plus tard », puis export complet avec les photos', async () => {
  // Un vêtement ajouté il y a longtemps, avec sa photo, jamais sauvegardé : le rappel est dû.
  const PHOTO = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2w==';
  const { derniereSauvegarde, rappelSauvegarde, ...reglages } = stocke().reglages;
  const sauvegarde = {
    format: 'garde-robe-chromatique', version: 2, dateExport: '2026-01-02T10:00:00.000Z', reglages, tenuesTypes: [], tenuesGardees: [],
    vetements: [{ id: 'ancien', type: 'pull', hex: '#ae5224', origine: 'manuel', dateAjout: '2026-01-01T10:00:00.000Z', marque: 'Petit Bateau', photo: true }],
    photos: { ancien: PHOTO },
  };
  cliquer('#onglets [data-ecran="reglages"]');
  cliquer('[data-action="importer"]');
  await fournirFichier(JSON.stringify(sauvegarde));
  cliquer('[data-valeur="oui"]', await dialogueOuvert());
  await dialoguesFermes();
  await quand(() => stocke().vetements.length === 1 && stocke().vetements[0].id === 'ancien', 'données importées');
  vrai(doc.querySelector('[data-info="derniere-sauvegarde"]').textContent.startsWith('Jamais sauvegardé'));
  let enBase = null;
  for (let essai = 0; essai < 30 && !enBase?.get('ancien'); essai++) enBase = await photosDeTest();
  egal(enBase.get('ancien'), PHOTO, 'photo importée dans IndexedDB');

  cliquer('#onglets [data-ecran="garde-robe"]');
  vrai(doc.querySelector('[data-info="rappel-sauvegarde"]'), 'rappel affiché');
  cliquer('[data-action="rappel-plus-tard"]');
  await quand(() => stocke().reglages.rappelSauvegarde, 'rappel reporté');
  egal(doc.querySelector('[data-info="rappel-sauvegarde"]'), null, 'rappel masqué pour une semaine');
  egal(Math.round((Date.parse(stocke().reglages.rappelSauvegarde) - Date.now()) / 86400000), 7);

  // Export complet par le partage d'iOS (simulé) : le fichier contient la photo ; la sauvegarde est notée.
  const partages = simulerPartage();
  cliquer('#onglets [data-ecran="reglages"]');
  cliquer('[data-action="exporter"]');
  await attendreReel(() => partages.length === 1, 'export partagé');
  const fichier = partages[0].files[0];
  vrai(fichier.name.startsWith('garde-robe-') && fichier.name.endsWith('.json'), fichier.name);
  const relu = lireExport(await avecTempsReel(fichier.text(), 'lecture du fichier'));
  egal(relu.erreurs.length, 0);
  egal(relu.photos.get('ancien'), PHOTO, 'photo dans le fichier exporté');
  egal(relu.etat.vetements[0].marque, 'Petit Bateau');
  await quand(() => stocke().reglages.derniereSauvegarde, 'sauvegarde notée');
  egal(stocke().reglages.rappelSauvegarde, undefined, 'report effacé');
  await quand(() => doc.querySelector('[data-info="derniere-sauvegarde"]')?.textContent.startsWith('Dernière sauvegarde : le '), 'date affichée');
});

// Vêtement multicolore (demande de Théo, 2026-09-27). L'étalonnage « photo » du test plus haut est toujours là
// (réglages réimportés) : chaque couleur mesurée par photo est corrigée, la deuxième comme la première.
test('app : vêtement bicolore mesuré, « Autre couleur » relance la caméra, puces, ✕, 3 couleurs au plus, puis fiche', async () => {
  cliquer('#onglets [data-ecran="garde-robe"]');
  await menuAjout('scanner');
  const scan = await dialogueOuvert('dialog.scan[open]');
  cliquer('[data-action="photo"]', scan);
  await fournirPhoto(await photoUnie('#b03a2e'));
  await attendreReel(() => resultatPret() === scan, 'première couleur');
  const feuille = scan.querySelector('.feuille-resultat');
  const puces = () => [...feuille.querySelectorAll('.puce-couleur')];
  const hexEntete = () => feuille.querySelector('.resultat-entete .discret').textContent.slice(0, 7);
  egal(puces().length, 1, 'une puce : la couleur principale');
  egal(feuille.querySelector('[data-action="retirer-couleur-mesure"]'), null, 'la principale ne se retire pas');
  const hexPrincipal = hexEntete();
  cliquer('[data-type="short"]', feuille);

  // Deuxième couleur : la caméra repart (« Retour à la fiche » possible), mesure par photo d'un noir.
  cliquer('[data-action="ajouter-couleur-mesure"]', feuille);
  vrai(feuille.hidden, 'caméra relancée, feuille masquée');
  egal(scan.querySelector('.etat-scan').textContent, 'Vise la couleur suivante du vêtement.');
  vrai(!scan.querySelector('[data-action="retour-feuille"]').hidden, 'retour à la fiche possible');
  cliquer('[data-action="photo"]', scan);
  await fournirPhoto(await photoUnie('#46464f'));
  await attendreReel(() => resultatPret() === scan && puces().length === 2, 'deuxième couleur');
  vrai(scan.querySelector('[data-action="retour-feuille"]').hidden);
  egal(puces()[1].getAttribute('aria-pressed'), 'true', 'la nouvelle couleur est celle qui s\'ajuste');
  egal(feuille.querySelector('.resultat-pastille').style.backgroundColor, 'rgb(17, 19, 20)', 'corrigée par l\'étalonnage, comme la première');
  vrai(feuille.querySelector('[data-info="etalonnage"]').textContent.includes('#46464f'), 'mesure brute de la deuxième couleur');
  egal(feuille.querySelector('[data-type="short"]').getAttribute('aria-pressed'), 'true', 'type gardé');
  vrai(feuille.scrollHeight <= feuille.clientHeight + 1, `tout tient sans défiler (${feuille.scrollHeight} ≤ ${feuille.clientHeight})`);
  cliquer('[data-segment="neutres"]', feuille);
  const noir = cartesChoix(feuille).find((c) => c.querySelector('.nom').textContent === 'Black');
  noir.click();
  egal(puces()[1].querySelector('.pastille').style.backgroundColor, 'rgb(17, 19, 20)', 'puce à jour');
  puces()[0].click();
  egal(hexEntete(), hexPrincipal, 'la puce touchée revient à la principale');
  egal(feuille.querySelector('[data-couleur="mesure"]').getAttribute('aria-selected'), 'true', 'la principale garde sa mesure');

  // « Autre couleur » puis « Retour à la fiche » : rien ne change.
  cliquer('[data-action="ajouter-couleur-mesure"]', feuille);
  cliquer('[data-action="retour-feuille"]', scan);
  vrai(!feuille.hidden && scan.dataset.etape === 'resultat', 'feuille revenue');
  egal(scan.querySelector('img.image-figee').hidden, false, 'image figée remontrée');
  egal(puces().length, 2);

  // Troisième couleur, puis plus de « + » ; ✕ retire la deuxième.
  await attendre(() => resultatPret(), 'feuille prête');
  cliquer('[data-action="ajouter-couleur-mesure"]', feuille);
  cliquer('[data-action="photo"]', scan);
  await fournirPhoto(await photoUnie('#d8b040'));
  await attendreReel(() => resultatPret() === scan && puces().length === 3, 'troisième couleur');
  egal(feuille.querySelector('[data-action="ajouter-couleur-mesure"]'), null, '3 couleurs au plus');
  const hexJaune = hexEntete();
  vrai(feuille.scrollHeight <= feuille.clientHeight + 1, `trois couleurs, toujours sans défiler (${feuille.scrollHeight} ≤ ${feuille.clientHeight})`);
  cliquer('[data-action="retirer-couleur-mesure"][data-index="1"]', feuille);
  egal(puces().length, 2);
  egal(puces()[1].getAttribute('aria-pressed'), 'true', 'la couleur active reste la même');
  egal(hexEntete(), hexJaune);
  vrai(feuille.querySelector('[data-action="ajouter-couleur-mesure"]'), '« + » de retour');
  cliquer('[data-action="enregistrer-scan"]', feuille);
  await sansPhoto();
  await dialoguesFermes();
  await quand(() => stocke().vetements.some((v) => v.type === 'short'), 'short enregistré');
  const short = stocke().vetements.find((v) => v.type === 'short');
  egal(short.hex, hexPrincipal);
  egalProfond(short.couleursSecondaires, [{ hex: hexJaune }]);
  const ligne = doc.querySelector('[data-type="short"] .vetement');
  vrai(ligne.querySelector('.pastille.rayee'), 'pastille rayée dans la liste');
  vrai(ligne.querySelector('.nom').textContent.endsWith(` / ${hexJaune}`), ligne.querySelector('.nom').textContent);

  // Fiche : ✕ retire la couleur, « Ajouter une couleur » la choisit sur la carte.
  cliquer('[data-type="short"] [data-action="modifier"]');
  const fiche = await dialogueOuvert();
  egal(fiche.querySelectorAll('.ligne-couleur').length, 2);
  egal(fiche.querySelector('.ligne-couleur[data-index="0"] [data-action="retirer-couleur"]'), null, 'la principale ne se retire pas');
  cliquer('[data-action="retirer-couleur"][data-index="1"]', fiche);
  egal(fiche.querySelectorAll('.ligne-couleur').length, 1);
  cliquer('[data-action="ajouter-couleur"]', fiche);
  (await attendre(() => doc.querySelector('.menu [data-action="couleur-carte"]'), 'menu couleur')).click();
  const selecteur = await dialogueOuvert('dialog.selecteur[open]');
  await rechercher(selecteur, 'white');
  const blanc = await attendre(() => [...selecteur.querySelectorAll('[data-action="choisir-couleur"]')]
    .find((b) => b.querySelector('.nom').textContent === 'White'), 'carte White');
  blanc.click();
  await attendre(() => fiche.querySelectorAll('.ligne-couleur').length === 2, 'couleur ajoutée');
  vrai(fiche.querySelector('.ligne-couleur[data-index="1"]').textContent.includes('White'));
  await attendre(() => 'pret' in fiche.dataset, 'fiche prête');
  cliquer('[data-valeur="ok"]', fiche);
  await dialoguesFermes();
  await quand(() => stocke().vetements.find((v) => v.type === 'short').couleursSecondaires?.[0].idCouleurCatalogue === blanc.dataset.couleur, 'fiche enregistrée');
  const modifie = stocke().vetements.find((v) => v.type === 'short');
  egal(modifie.hex, hexPrincipal, 'principale inchangée');
  egal(modifie.couleursSecondaires.length, 1);
});
