import { test, vrai, egal, egalProfond, leve } from './mini-test.js';
import {
  etatInitial, premierLancement, normaliserTenue, validerEtat, exporterEtat, lireExport,
  ajouterVetement, modifierVetement, supprimerVetement, basculerFavori, modifierReglages, enregistrerTenueType,
  enregistrerEtalonnage, supprimerEtalonnage, retirerTenueType,
  garderTenue, retirerTenueGardee, renommerTenueGardee, marquesConnues, noterSauvegarde, reporterRappelSauvegarde, rappelSauvegardeDu,
} from '../js/donnees.js';
import { signatureTenue } from '../js/tenues.js';

// Tenue gardée d'exemple : pantalon porté (vêtement v2), pull manquant.
const TENUE = {
  types: ['pantalon', 'pull'],
  combinaison: {
    id: 'wada-n12', source: 'wada', ref: 'n° 12',
    couleurs: [{ id: 'wada-1', nom: 'Hermosa Pink', hex: '#F9C1CE' }, { id: 'wada-2', nom: 'Corinthian Pink', hex: '#f8b6ba' }],
  },
  pieces: [
    { type: 'pantalon', hex: '#000000', manque: false, joker: true, vetementId: 'v2' },
    { type: 'pull', hex: '#f9c1ce', manque: true, joker: false, couleurId: 'wada-1' },
  ],
};
const PHOTO = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2w==';

test('données v2 : un export de version 1 reste lisible (sans les champs de la version 2)', () => {
  const v1 = JSON.parse(exporterEtat(etatExemple(), DATE));
  v1.version = 1;
  delete v1.tenuesGardees;
  const { erreurs, etat } = lireExport(JSON.stringify(v1));
  egalProfond(erreurs, []);
  egalProfond(etat.tenuesGardees, [], 'aucune tenue gardée');
  egal(etat.vetements.length, 2);
  v1.vetements[0].marque = 'Lacoste';
  vrai(lireExport(JSON.stringify(v1)).erreurs.some((e) => e.includes('champ inconnu « marque »')), 'la marque n\'existe pas en version 1');
});

test('données v2 : marque et photo des vêtements, photos dans l\'export, réimport identique', () => {
  let etat = ajouterVetement(etatExemple(), { type: 'veste', hex: '#123456', origine: 'scan', marque: '  Petit   Bateau ', photo: true }, { id: 'v3', date: DATE });
  egalProfond(etat.vetements[2], { id: 'v3', type: 'veste', hex: '#123456', origine: 'scan', dateAjout: '2026-09-24T10:00:00.000Z', marque: 'Petit Bateau', photo: true });
  leve(() => ajouterVetement(etat, { type: 'veste', hex: '#123456', origine: 'scan', marque: 'x'.repeat(41) }, { id: 'v4', date: DATE }));
  egalProfond(marquesConnues(modifierVetement(etat, 'v1', { marque: 'petit bateau' })), ['petit bateau'], 'sans doublon de casse');
  egal(modifierVetement(etat, 'v3', { marque: '' }).vetements[2].marque, undefined, 'marque effacée');
  egal(modifierVetement(etat, 'v3', { photo: false }).vetements[2].photo, undefined, 'photo retirée');

  const texte = exporterEtat(etat, DATE, 2, new Map([['v3', PHOTO]]));
  const relu = lireExport(texte);
  egalProfond(relu.erreurs, []);
  egalProfond(relu.etat, etat);
  egalProfond([...relu.photos], [['v3', PHOTO]]);
  // L'indicateur « photo » suit les photos fournies par l'export.
  const sansPhoto = lireExport(exporterEtat(etat, DATE, 0, new Map()));
  egal(sansPhoto.etat.vetements[2].photo, undefined, 'photo annoncée mais absente : indicateur retiré');
  egal(lireExport(exporterEtat(etat, DATE)).photos, null, 'stockage local : pas de photos dans le document');
  const cas = [
    [(d) => { d.photos = { inconnu: PHOTO }; }, 'aucun vêtement ne porte cet identifiant'],
    [(d) => { d.photos = { v3: 'data:text/html;base64,AAAA' }; }, 'invalide'],
    [(d) => { d.photos = []; }, '« photos » doit être un objet'],
    [(d) => { d.vetements[2].photo = 'oui'; }, '« photo » doit valoir true'],
    [(d) => { d.vetements[2].marque = ' x'; }, 'marque invalide'],
  ];
  for (const [modifier, attendu] of cas) {
    const d = JSON.parse(texte);
    modifier(d);
    const r = lireExport(JSON.stringify(d));
    vrai(r.etat === null && r.erreurs.some((e) => e.includes(attendu)), `${attendu} : ${JSON.stringify(r.erreurs)}`);
  }
});

test('mes tenues : garder (la plus récente d\'abord, sans doublon), renommer, retirer, exporter', () => {
  let etat = garderTenue(etatExemple(), TENUE, { id: 't1', date: DATE }, signatureTenue);
  egal(etat.tenuesGardees[0].combinaison.couleurs[0].hex, '#f9c1ce', 'hex normalisé');
  egal(garderTenue(etat, TENUE, { id: 't2', date: DATE }, signatureTenue), etat, 'même tenue : pas de doublon');
  etat = garderTenue(etat, { ...TENUE, types: ['pantalon', 'pull', 'chapeau'], pieces: [...TENUE.pieces, { type: 'chapeau', hex: '#000000', manque: true, joker: true }] },
    { id: 't2', date: new Date('2026-09-25T10:00:00Z') }, signatureTenue);
  egalProfond(etat.tenuesGardees.map((t) => t.id), ['t2', 't1'], 'la plus récente d\'abord');
  etat = renommerTenueGardee(etat, 't1', '  Mariage de Julie ');
  egal(etat.tenuesGardees[1].nom, 'Mariage de Julie');
  egal(renommerTenueGardee(etat, 't1', '').tenuesGardees[1].nom, undefined, 'nom effacé');
  leve(() => renommerTenueGardee(etat, 't1', 'x'.repeat(61)));
  const relu = lireExport(exporterEtat(etat, DATE));
  egalProfond(relu.erreurs, []);
  egalProfond(relu.etat.tenuesGardees, etat.tenuesGardees);
  egal(retirerTenueGardee(etat, 't2').tenuesGardees.length, 1);
  leve(() => retirerTenueGardee(etat, 'absente'));
  leve(() => garderTenue(etat, { ...TENUE, pieces: [] }, { id: 't3', date: DATE }), 'tenue sans pièce refusée');
});

test('mes tenues : tenue gardée invalide refusée à l\'import', () => {
  const base = () => JSON.parse(exporterEtat(garderTenue(etatExemple(), TENUE, { id: 't1', date: DATE }), DATE));
  const cas = [
    [(d) => { d.tenuesGardees[0].pieces[0].hex = 'rouge'; }, 'pièce 1 : couleur « rouge » invalide'],
    [(d) => { d.tenuesGardees[0].combinaison.source = 'autre'; }, 'source « autre » inconnue'],
    [(d) => { d.tenuesGardees[0].combinaison.couleurs = [d.tenuesGardees[0].combinaison.couleurs[0]]; }, '2 à 6 couleurs'],
    [(d) => { d.tenuesGardees[0].types = ['pantalon', 'short']; }, 'pantalon et short ensemble'],
    [(d) => { d.tenuesGardees.push(d.tenuesGardees[0]); }, 'identifiant « t1 » en double'],
    [(d) => { d.tenuesGardees[0].pieces[1].manque = 'oui'; }, '« manque » et « joker »'],
    [(d) => { d.tenuesGardees[0].favori = true; }, 'champ inconnu « favori »'],
  ];
  for (const [modifier, attendu] of cas) {
    const d = base();
    modifier(d);
    const r = lireExport(JSON.stringify(d));
    vrai(r.etat === null && r.erreurs.some((e) => e.includes(attendu)), `${attendu} : ${JSON.stringify(r.erreurs)}`);
  }
});

test('rappel de sauvegarde : jamais sauvegardé, sauvegarde ancienne avec ajouts, report d\'une semaine', () => {
  const jour = (n) => new Date(Date.UTC(2026, 8, 24) + n * 86400000);
  const etat = etatExemple(); // vêtements ajoutés le 24/09/2026
  egal(rappelSauvegardeDu(etatInitial(), jour(100)), false, 'garde-robe vide : pas de rappel');
  egal(rappelSauvegardeDu(etat, jour(3)), false, 'jamais sauvegardé, vêtements récents');
  egal(rappelSauvegardeDu(etat, jour(8)), true, 'jamais sauvegardé, premier vêtement vieux de plus de 7 jours');
  const sauve = noterSauvegarde(etat, jour(8));
  egal(sauve.reglages.derniereSauvegarde, jour(8).toISOString());
  egal(rappelSauvegardeDu(sauve, jour(60)), false, 'rien d\'ajouté depuis la sauvegarde');
  const ajout = ajouterVetement(sauve, { type: 'chapeau', hex: '#101010', origine: 'manuel' }, { id: 'v9', date: jour(20) });
  egal(rappelSauvegardeDu(ajout, jour(30)), false, 'sauvegarde de moins de 30 jours');
  egal(rappelSauvegardeDu(ajout, jour(39)), true, 'plus de 30 jours et un ajout depuis');
  const reporte = reporterRappelSauvegarde(ajout, jour(39));
  egal(rappelSauvegardeDu(reporte, jour(45)), false, '« Plus tard » : une semaine de répit');
  egal(rappelSauvegardeDu(reporte, jour(47)), true);
  egal(noterSauvegarde(reporte, jour(47)).reglages.rappelSauvegarde, undefined, 'une sauvegarde efface le report');
  egalProfond(lireExport(exporterEtat(reporte, DATE)).etat.reglages, reporte.reglages, 'dates exportées et relues');
});

const DATE = new Date('2026-09-24T10:00:00.000Z');

function etatExemple() {
  let etat = modifierReglages(etatInitial(), { mst: 5 });
  etat = ajouterVetement(etat, { type: 'pull', hex: '#A07E56', origine: 'manuel', idCouleurCatalogue: 'wada-12' }, { id: 'v1', date: DATE });
  etat = ajouterVetement(etat, { type: 'pantalon', hex: '#000000', origine: 'scan' }, { id: 'v2', date: new Date('2026-09-24T11:00:00Z') });
  etat = basculerFavori(etat, 'wada-3');
  etat = enregistrerTenueType(etat, ['pull', 'pantalon', 'chaussures']);
  return etat;
}

test('données : état initial et premier lancement', () => {
  const etat = etatInitial();
  egal(premierLancement(etat), true);
  egalProfond(etat.reglages, { mst: null, teintActif: false, tolerance: 10, favoris: [] });
  egal(premierLancement(modifierReglages(etat, { mst: 3 })), false);
});

test('données : opérations sans modifier l\'état reçu', () => {
  const avant = etatExemple();
  const copie = JSON.stringify(avant);
  egal(avant.vetements[0].hex, '#a07e56', 'hex normalisé en minuscules');
  egal(avant.vetements[0].dateAjout, '2026-09-24T10:00:00.000Z');
  const modifie = modifierVetement(avant, 'v1', { type: 'veste', hex: '#FFFFFF', idCouleurCatalogue: null });
  egalProfond(modifie.vetements[0], { id: 'v1', type: 'veste', hex: '#ffffff', origine: 'manuel', dateAjout: '2026-09-24T10:00:00.000Z' });
  egal(supprimerVetement(avant, 'v1').vetements.length, 1);
  egalProfond(basculerFavori(avant, 'wada-3').reglages.favoris, [], 'favori retiré');
  egalProfond(basculerFavori(avant, 'wada-9').reglages.favoris, ['wada-3', 'wada-9']);
  egal(modifierReglages(avant, { tolerance: 12.5 }).reglages.tolerance, 12.5);
  egal(JSON.stringify(avant), copie, 'état d\'origine intact');
});

test('données : opérations invalides refusées', () => {
  const etat = etatExemple();
  leve(() => ajouterVetement(etat, { type: 'robe', hex: '#000000', origine: 'manuel' }, { id: 'x', date: DATE }));
  leve(() => ajouterVetement(etat, { type: 'pull', hex: '#00000', origine: 'manuel' }, { id: 'x', date: DATE }));
  leve(() => ajouterVetement(etat, { type: 'pull', hex: '#000000', origine: 'photo' }, { id: 'x', date: DATE }));
  leve(() => ajouterVetement(etat, { type: 'pull', hex: '#000000', origine: 'manuel' }, { id: 'v1', date: DATE }), 'id en double');
  leve(() => modifierVetement(etat, 'absent', { type: 'pull' }));
  leve(() => modifierVetement(etat, 'v1', { type: 'robe' }));
  leve(() => supprimerVetement(etat, 'absent'));
  leve(() => modifierReglages(etat, { mst: 11 }));
  leve(() => modifierReglages(etat, { tolerance: 0.5 }));
  leve(() => modifierReglages(etat, { tolerance: 31 }));
  leve(() => modifierReglages(etat, { tolerance: 12.3 }), 'hors du pas de 0,5');
  leve(() => modifierReglages(etat, { teintActif: 'oui' }));
});

test('données : tenue type canonique, sans doublon, pantalon et short refusés', () => {
  egalProfond(normaliserTenue(['pull', 'chaussures', 'pantalon']), ['chaussures', 'pantalon', 'pull']);
  const etat = etatExemple();
  egal(enregistrerTenueType(etat, ['chaussures', 'pantalon', 'pull']), etat, 'même tenue dans un autre ordre : inchangé');
  egal(enregistrerTenueType(etat, ['short']).tenuesTypes.length, 2);
  leve(() => normaliserTenue(['pantalon', 'short']));
  leve(() => normaliserTenue([]));
  leve(() => normaliserTenue(['pull', 'pull']));
});

test('données : retrait d\'une tenue type (ordre indifférent), tenue absente sans effet', () => {
  const etat = enregistrerTenueType(etatExemple(), ['short', 't-shirt']);
  const copie = JSON.stringify(etat);
  egalProfond(retirerTenueType(etat, ['pull', 'chaussures', 'pantalon']).tenuesTypes, [['short', 't-shirt']]);
  egal(retirerTenueType(etat, ['chapeau']), etat, 'tenue absente : même état');
  egal(JSON.stringify(etat), copie, 'état d\'origine intact');
  leve(() => retirerTenueType(etat, ['pantalon', 'short']));
});

test('export puis import : mêmes données', () => {
  const etat = etatExemple();
  const texte = exporterEtat(etat, DATE, 2);
  const doc = JSON.parse(texte);
  egal(doc.format, 'garde-robe-chromatique');
  egal(doc.version, 2);
  egal(doc.dateExport, '2026-09-24T10:00:00.000Z');
  const { erreurs, etat: relu } = lireExport(texte);
  egalProfond(erreurs, []);
  egalProfond(relu, etat);
  egalProfond(lireExport(String.fromCharCode(0xfeff) + texte).erreurs, [], 'BOM accepté');
});

test('import : chaque document invalide est refusé avec un message', () => {
  const base = () => JSON.parse(exporterEtat(etatExemple(), DATE));
  const cas = [
    ['JSON tronqué', '{', 'JSON invalide'],
    ['tableau', '[]', 'pas un export'],
    ['autre format', JSON.stringify({ ...base(), format: 'autre' }), 'pas un export'],
    ['version future', (d) => { d.version = 999; }, 'version 999 plus récente'],
    ['version absente', (d) => { delete d.version; }, '« version » doit valoir 1'],
    ['champ inconnu', (d) => { d.extra = 1; }, 'champ inconnu « extra »'],
    ['date d\'export', (d) => { d.dateExport = 'hier'; }, '« dateExport » invalide'],
    ['type inconnu', (d) => { d.vetements[0].type = 'robe'; }, 'type « robe » inconnu'],
    ['hex à 5 chiffres', (d) => { d.vetements[0].hex = '#12345'; }, 'couleur « #12345 » invalide'],
    ['origine inconnue', (d) => { d.vetements[0].origine = 'photo'; }, 'origine « photo » inconnue'],
    ['identifiant en double', (d) => { d.vetements[1].id = d.vetements[0].id; }, 'identifiant « v1 » en double'],
    ['date d\'ajout', (d) => { d.vetements[0].dateAjout = '2026-13-45'; }, 'date d\'ajout'],
    ['champ inconnu de vêtement', (d) => { d.vetements[0].couleurPreferee = 'x'; }, 'vêtement 1 : champ inconnu « couleurPreferee »'],
    ['vêtements non liste', (d) => { d.vetements = {}; }, '« vetements » doit être une liste'],
    ['mst 11', (d) => { d.reglages.mst = 11; }, '« mst » doit être un entier de 1 à 10'],
    ['mst absent', (d) => { d.reglages.mst = null; }, '« mst » doit être un entier'],
    ['tolérance négative', (d) => { d.reglages.tolerance = -1; }, '« tolerance » doit être un nombre de 1 à 30'],
    ['tolérance hors du pas', (d) => { d.reglages.tolerance = 12.3; }, 'par pas de 0,5'],
    ['teintActif texte', (d) => { d.reglages.teintActif = 'oui'; }, '« teintActif »'],
    ['favori numérique', (d) => { d.reglages.favoris = [42]; }, '« favoris » doit être une liste'],
    ['favori en double', (d) => { d.reglages.favoris = ['a', 'a']; }, 'favori en double'],
    ['tenue pantalon et short', (d) => { d.tenuesTypes = [['pantalon', 'short']]; }, 'pantalon et short ensemble'],
    ['tenue en double', (d) => { d.tenuesTypes = [['pull'], ['pull']]; }, 'en double'],
    ['tenue vide', (d) => { d.tenuesTypes = [[]]; }, 'tenue vide'],
  ];
  for (const [nom, modification, attendu] of cas) {
    let texte = modification;
    if (typeof modification === 'function') {
      const d = base();
      modification(d);
      texte = JSON.stringify(d);
    }
    const { erreurs, etat } = lireExport(texte);
    egal(etat, null, `${nom} : doit être refusé`);
    vrai(erreurs.some((e) => e.includes(attendu)), `${nom} : message « ${attendu} » absent de ${JSON.stringify(erreurs)}`);
  }
});

test('validerEtat : un id de catalogue inconnu est accepté (Papier Tigre absent sur cet appareil)', () => {
  const etat = etatExemple();
  const autre = { ...etat, reglages: { ...etat.reglages, favoris: ['papier-tigre-v1-p30-d1'] } };
  egalProfond(validerEtat(autre).erreurs, []);
});

test('données : étalonnage enregistré par mode, exporté, réimporté, supprimé', () => {
  let etat = etatExemple();
  etat = enregistrerEtalonnage(etat, 'torche', { blanc: [220, 220, 230], noir: [70, 70, 79] }, DATE);
  egalProfond(etat.reglages.etalonnage, { torche: { blanc: [220, 220, 230], noir: [70, 70, 79], date: '2026-09-24T10:00:00.000Z' } });
  etat = enregistrerEtalonnage(etat, 'photo', { blanc: [240, 240, 240], noir: [40, 40, 40] }, DATE);
  egalProfond(Object.keys(etat.reglages.etalonnage), ['torche', 'photo'], 'un étalonnage par façon de mesurer');
  const { erreurs, etat: relu } = lireExport(exporterEtat(etat, DATE));
  egalProfond(erreurs, []);
  egalProfond(relu, etat);
  egal(supprimerEtalonnage(etat).reglages.etalonnage, undefined);
  egalProfond(lireExport(exporterEtat(etatExemple(), DATE)).etat.reglages.etalonnage, undefined, 'facultatif');
  leve(() => enregistrerEtalonnage(etat, 'lune', { blanc: [220, 220, 230], noir: [70, 70, 79] }, DATE));
  leve(() => enregistrerEtalonnage(etat, 'photo', { blanc: [100, 100, 100], noir: [90, 90, 90] }, DATE));
});

test('import : étalonnage invalide refusé avec un message', () => {
  const base = () => {
    const d = JSON.parse(exporterEtat(etatExemple(), DATE));
    d.reglages.etalonnage = { torche: { blanc: [220, 220, 230], noir: [70, 70, 79], date: '2026-09-24T10:00:00.000Z' } };
    return d;
  };
  egalProfond(lireExport(JSON.stringify(base())).erreurs, [], 'document de base valide');
  const cas = [
    ['mode inconnu', (d) => { d.reglages.etalonnage.lune = d.reglages.etalonnage.torche; }, 'mode inconnu'],
    ['triplet invalide', (d) => { d.reglages.etalonnage.torche.blanc = [300, 0, 0]; }, 'invalides'],
    ['blanc et noir trop proches', (d) => { d.reglages.etalonnage.torche.blanc = [80, 80, 90]; }, 'trop proches'],
    ['date invalide', (d) => { d.reglages.etalonnage.torche.date = 'hier'; }, 'date invalide'],
    ['champ inconnu', (d) => { d.reglages.etalonnage.torche.gris = [1, 2, 3]; }, 'champ inconnu'],
    ['non objet', (d) => { d.reglages.etalonnage = []; }, 'doit être un objet'],
  ];
  for (const [nom, modifier, attendu] of cas) {
    const d = base();
    modifier(d);
    const { erreurs, etat } = lireExport(JSON.stringify(d));
    egal(etat, null, `${nom} : refusé`);
    vrai(erreurs.some((e) => e.includes(attendu)), `${nom} : message « ${attendu} » absent de ${JSON.stringify(erreurs)}`);
  }
});
