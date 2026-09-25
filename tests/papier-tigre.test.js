// Les RVB des fichiers d'exemple sont des données de test synthétiques, pas des couleurs des livres.
import { test, vrai, egal, egalProfond, leve } from './mini-test.js';
import { validerPapierTigre, convertirPapierTigre, lirePapierTigre } from '../js/papier-tigre.js';

const texteExemple = await (await fetch(new URL('./donnees/papier-tigre-exemple.json', import.meta.url))).text();
const exemple = () => JSON.parse(texteExemple);

test('Papier Tigre : le fichier d\'exemple est valide, sans avertissement', () => {
  const { erreurs, avertissements } = validerPapierTigre(exemple());
  egalProfond(erreurs, []);
  egalProfond(avertissements, []);
});

test('Papier Tigre : conversion (identifiants, noms, hex, rôles, ref, tri par volume puis page)', () => {
  const { couleurs, combinaisons } = convertirPapierTigre(exemple());
  egalProfond(combinaisons.map((c) => c.id), ['papier-tigre-v1-p12', 'papier-tigre-v1-p13', 'papier-tigre-v2-p40']);
  const a = combinaisons[0];
  egal(a.source, 'papier-tigre');
  egal(a.ref, 'vol. 1, p. 12');
  egal(a.nom, 'Exemple A (Pays test)');
  egalProfond(a.couleurs, ['d1', 'd2', 'd3', 's1', 's2', 's3'].map((s) => `papier-tigre-v1-p12-${s}`));
  egalProfond(a.roles, ['dominante', 'dominante', 'dominante', 'soutien', 'soutien', 'soutien']);
  egal(combinaisons[2].nom, 'Exemple B', 'nom sans pays');
  const d1 = couleurs.find((c) => c.id === 'papier-tigre-v1-p12-d1');
  egal(d1.nom, 'Exemple A, dominante 1');
  egal(d1.hex, '#ff0000');
  egal(d1.source, 'papier-tigre');
  vrai(Number.isFinite(d1.lab.L), 'Lab calculé');
  egal(couleurs.find((c) => c.id === 'papier-tigre-v2-p40-s1').nom, 'Exemple B, soutien 1');
  egal(couleurs.length, 11);
});

test('Papier Tigre : soutiens absents acceptés si 2 dominantes ou plus', () => {
  const d = exemple();
  d.harmonies = [{ volume: 3, page: 7, nom: 'Deux dominantes', dominantes: [[1, 2, 3], [4, 5, 6]] }];
  egalProfond(validerPapierTigre(d).erreurs, []);
  egalProfond(convertirPapierTigre(d).combinaisons[0].roles, ['dominante', 'dominante']);
});

test('Papier Tigre : chaque erreur de saisie est refusée avec un message précis', () => {
  const cas = [
    ['racine non objet', () => [], 'doit contenir un objet'],
    ['format', (d) => { d.format = 'autre'; }, '« format » doit valoir'],
    ['version future', (d) => { d.version = 2; }, 'version 2 non prise en charge'],
    ['version absente', (d) => { delete d.version; }, '« version » doit valoir 1'],
    ['harmonies non liste', (d) => { d.harmonies = {}; }, '« harmonies » doit être une liste'],
    ['champ racine inconnu', (d) => { d.harmonie = []; }, 'vouliez-vous dire « harmonies »'],
    ['volume 4', (d) => { d.harmonies[0].volume = 4; }, '« volume » doit être un entier de 1 à 3'],
    ['page 0', (d) => { d.harmonies[0].page = 0; }, '« page » doit être un entier'],
    ['page décimale', (d) => { d.harmonies[0].page = 1.5; }, '« page » doit être un entier'],
    ['nom vide', (d) => { d.harmonies[0].nom = '  '; }, '« nom » manquant ou vide'],
    ['pays vide', (d) => { d.harmonies[0].pays = ''; }, '« pays » doit être un texte non vide'],
    ['aucune dominante', (d) => { d.harmonies[0].dominantes = []; }, '« dominantes » doit être une liste de 1 à 3'],
    ['4 dominantes', (d) => { d.harmonies[1].dominantes.push([1, 1, 1]); }, '« dominantes » doit être une liste de 1 à 3'],
    ['4 soutiens', (d) => { d.harmonies[1].soutiens.push([1, 1, 1]); }, '« soutiens » doit être une liste de 0 à 3'],
    ['1 couleur au total', (d) => { d.harmonies[2].soutiens = []; }, '1 couleur(s) au total, 2 à 6 attendues'],
    ['RVB 256', (d) => { d.harmonies[0].dominantes[0] = [256, 0, 0]; }, 'dominante 1 : [256,0,0] n\'est pas un RVB valide'],
    ['RVB négatif', (d) => { d.harmonies[0].soutiens[0] = [0, -1, 0]; }, 'soutien 1 : [0,-1,0] n\'est pas un RVB valide'],
    ['RVB décimal', (d) => { d.harmonies[0].dominantes[1] = [1.5, 0, 0]; }, 'dominante 2 : [1.5,0,0]'],
    ['RVB à 2 valeurs', (d) => { d.harmonies[0].dominantes[0] = [1, 2]; }, 'dominante 1 : [1,2]'],
    ['RVB à 4 valeurs', (d) => { d.harmonies[0].dominantes[0] = [1, 2, 3, 4]; }, 'dominante 1 : [1,2,3,4]'],
    ['RVB en texte', (d) => { d.harmonies[0].dominantes[0] = ['1', '2', '3']; }, 'n\'est pas un RVB valide'],
    ['doublon volume et page', (d) => { d.harmonies[2].page = 12; }, 'même volume et même page que l\'harmonie 2'],
    ['champ inconnu', (d) => { d.harmonies[0].dominante = d.harmonies[0].dominantes; }, 'vouliez-vous dire « dominantes »'],
    ['cmjn de longueur différente', (d) => { d.harmonies[2].cmjn.soutiens = []; }, '« cmjn.soutiens » doit avoir autant'],
    ['cmjn hors bornes', (d) => { d.harmonies[2].cmjn.dominantes = [[101, 0, 0, 0]]; }, 'cmjn de la dominante 1'],
    ['cmjn non objet', (d) => { d.harmonies[2].cmjn = [[0, 0, 0, 0]]; }, '« cmjn » doit être un objet'],
  ];
  for (const [nom, modifier, attendu] of cas) {
    let d = exemple();
    const remplacement = modifier(d);
    if (remplacement !== undefined) d = remplacement;
    const { erreurs } = validerPapierTigre(d);
    vrai(erreurs.some((e) => e.includes(attendu)), `${nom} : message « ${attendu} » absent de ${JSON.stringify(erreurs)}`);
    leve(() => convertirPapierTigre(d), `${nom} : la conversion doit être refusée`);
  }
});

test('Papier Tigre : les messages situent l\'harmonie (numéro, volume, page, nom)', () => {
  const d = exemple();
  d.harmonies[0].dominantes[0] = [256, 0, 0];
  egal(validerPapierTigre(d).erreurs[0], 'harmonie 1 (vol. 2, p. 40, Exemple B) : dominante 1 : [256,0,0] n\'est pas un RVB valide (3 entiers de 0 à 255)');
});

test('Papier Tigre : avertissement si le même RVB apparaît deux fois dans une harmonie', () => {
  const d = exemple();
  d.harmonies[1].soutiens[2] = [255, 0, 0];
  const { erreurs, avertissements } = validerPapierTigre(d);
  egalProfond(erreurs, []);
  egalProfond(avertissements, ['harmonie 2 (vol. 1, p. 12, Exemple A) : dominante 1 et soutien 3 ont le même RVB [255,0,0]']);
});

test('Papier Tigre : lecture du texte (JSON invalide, BOM, fichier vide de harmonies)', () => {
  const invalide = lirePapierTigre('{ "format": ');
  vrai(invalide.erreurs[0].startsWith('JSON invalide'), invalide.erreurs[0]);
  egal(invalide.catalogue, null);
  const avecBom = lirePapierTigre(String.fromCharCode(0xfeff) + texteExemple);
  egalProfond(avecBom.erreurs, []);
  egal(avecBom.catalogue.combinaisons.length, 3);
  const vide = lirePapierTigre('{ "format": "papier-tigre", "version": 1, "harmonies": [] }');
  egalProfond(vide.erreurs, []);
  egalProfond(vide.avertissements, ['aucune harmonie dans le fichier']);
  egal(vide.catalogue.combinaisons.length, 0);
});
