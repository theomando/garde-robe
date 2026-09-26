// Écran Réglages (dans le style de l'app Réglages d'iOS) : teint, interrupteur, étalonnage de la caméra, tolérance,
// favoris, catalogue Papier Tigre, export et import, version et crédits.

import { el, pastille, confirmer, annoncer, barreNavigation, interrupteur } from '../ui.js';
import { icone } from '../icones.js';
import {
  MST, TOLERANCE_MIN, TOLERANCE_MAX, TOLERANCE_PAS, TOLERANCE_DEFAUT, VERSION_APP, MODES_SCAN, LIBELLES_MODES_SCAN,
} from '../constantes.js';
import { modifierReglages, supprimerEtalonnage } from '../donnees.js';
import { rgbVersHex } from '../couleur.js';
import { ouvrirSelecteur } from './selecteur-catalogue.js';
import { etalonner } from './etalonnage.js';

const ACCEPT_JSON = '.json,application/json';

// Section groupée : titre au-dessus, cellules dans un bloc arrondi, note en dessous.
function groupe(titre, lignes, pied = null, attributs = {}) {
  return el('section', attributs,
    el('h2', { class: 'titre-groupe' }, titre),
    el('div', { class: 'groupe' }, lignes),
    pied ? el('p', { class: 'pied-groupe' }, pied) : null);
}

function ligneAction(libelle, { action, onclick, danger = false, valeur = null, chevron = false }) {
  return el('button', { type: 'button', class: `ligne ligne-action${danger ? ' danger' : ''}`, 'data-action': action, onclick },
    el('span', { class: 'texte-ligne' }, libelle),
    valeur !== null ? el('span', { class: 'valeur-ligne' }, valeur) : null,
    chevron ? icone('chevron-droite', { classe: 'chevron' }) : null);
}

function formaterTolerance(valeur) {
  return String(valeur).replace('.', ',');
}

export function rendreReglages(conteneur, app, actions) {
  const { reglages } = app.etat;

  const teintes = el('div', { class: 'teintes', role: 'group', 'aria-label': 'Teinte de peau' },
    MST.map((hex, i) => el('button', {
      type: 'button', class: 'teinte', style: { backgroundColor: hex }, 'data-mst': i + 1,
      'aria-pressed': String(reglages.mst === i + 1), 'aria-label': `Teinte ${i + 1}`,
      onclick: () => actions.mettreAJour(modifierReglages(app.etat, { mst: i + 1 })),
    }, el('span', {}, String(i + 1)))));

  const teintActif = interrupteur({
    id: 'reglage-teint-actif', checked: reglages.teintActif,
    onchange: (e) => actions.mettreAJour(modifierReglages(app.etat, { teintActif: e.target.checked })),
  });

  const valeurTolerance = el('output', { for: 'reglage-tolerance', class: 'valeur valeur-ligne' }, formaterTolerance(reglages.tolerance));
  const curseur = el('input', {
    type: 'range', id: 'reglage-tolerance', min: TOLERANCE_MIN, max: TOLERANCE_MAX, step: TOLERANCE_PAS, value: reglages.tolerance,
    oninput: (e) => { valeurTolerance.textContent = formaterTolerance(Number(e.target.value)); },
    onchange: (e) => actions.mettreAJour(modifierReglages(app.etat, { tolerance: Number(e.target.value) })),
  });

  const favoris = reglages.favoris.map((id) => app.catalogue.couleurParId.get(id));
  const connus = favoris.filter(Boolean);
  const absents = favoris.length - connus.length;
  const papierTigre = app.papierTigre?.catalogue;

  conteneur.replaceChildren(
    ...barreNavigation({ titre: 'Réglages' }),

    groupe('Teint', [
      teintes,
      el('label', { class: 'ligne ligne-interrupteur', for: 'reglage-teint-actif' },
        el('span', { class: 'texte-ligne' }, 'Teint dans les combinaisons'), teintActif),
    ], 'Échelle Monk, de 1 (le plus clair) à 10 (le plus foncé). Avec l\'interrupteur, la peau peut porter une couleur proche de ton teint.'),

    groupe('Étalonnage de la caméra', [
      ...MODES_SCAN.map((mode) => {
        const mesures = reglages.etalonnage?.[mode];
        return el('div', { class: 'ligne etat-etalonnage', 'data-mode': mode },
          el('span', { class: 'texte-ligne' }, LIBELLES_MODES_SCAN[mode]),
          mesures ? pastille(rgbVersHex(mesures.blanc), { titre: `blanc mesuré ${rgbVersHex(mesures.blanc)}` }) : null,
          mesures ? pastille(rgbVersHex(mesures.noir), { titre: `noir mesuré ${rgbVersHex(mesures.noir)}` }) : null,
          el('span', { class: 'valeur-ligne' }, mesures ? `étalonné le ${new Date(mesures.date).toLocaleDateString('fr-FR')}` : 'non étalonné'));
      }),
      ligneAction(reglages.etalonnage ? 'Refaire l\'étalonnage' : 'Étalonner la caméra', { action: 'etalonner', onclick: () => etalonner(app, actions) }),
      reglages.etalonnage ? ligneAction('Supprimer l\'étalonnage', {
        action: 'supprimer-etalonnage', danger: true,
        onclick: async () => {
          if (!(await confirmer('Supprimer l\'étalonnage ?', 'Les prochains scans ne seront plus corrigés. Tes vêtements déjà enregistrés ne changent pas.', 'Supprimer'))) return;
          if (actions.mettreAJour(supprimerEtalonnage(app.etat))) annoncer('Étalonnage supprimé');
        },
      }) : null,
    ], 'À faire une seule fois : scanne un vêtement entièrement blanc, puis un entièrement noir. Les scans suivants faits de la même façon sont corrigés (exposition automatique de l\'iPhone, dominante bleue de la torche).'),

    groupe('Tolérance', [
      el('label', { class: 'ligne', for: 'reglage-tolerance' }, el('span', { class: 'texte-ligne' }, 'Écart maximal (ΔE00)'), valeurTolerance),
      el('div', { class: 'ligne ligne-curseur' }, curseur),
    ], `Un vêtement correspond à une couleur si leur écart ne dépasse pas cette valeur. ${TOLERANCE_DEFAUT} par défaut : valeur de départ, à ajuster à l'usage (plus bas = plus exigeant).`),

    groupe('Favoris', [
      ligneAction('Gérer mes favoris', {
        action: 'gerer-favoris', valeur: String(connus.length), chevron: true,
        onclick: async () => {
          await ouvrirSelecteur({ catalogue: app.catalogue, titre: 'Mes favoris', mode: 'favoris', ...actions.favorisPourSelecteur() });
          actions.rafraichir();
        },
      }),
      connus.length > 0 ? el('div', { class: 'ligne' }, el('div', { class: 'rangee-pastilles' }, connus.slice(0, 40).map((c) => pastille(c.hex, { titre: c.nom })))) : null,
    ], [
      connus.length === 0 ? 'Aucune couleur favorite.' : `${connus.length} couleur${connus.length > 1 ? 's' : ''} favorite${connus.length > 1 ? 's' : ''}.`,
      absents > 0 ? ` ${absents} favori(s) du catalogue Papier Tigre, absent sur cet appareil.` : '',
      ' Les propositions qui contiennent tes favoris passent devant.',
    ].join('')),

    groupe('Catalogue Papier Tigre', [
      el('div', { class: 'ligne', 'data-info': 'papier-tigre' }, el('span', { class: 'texte-ligne' }, papierTigre
        ? `Importé : ${papierTigre.combinaisons.length} harmonies, ${papierTigre.couleurs.length} couleurs.`
        : 'Non importé.')),
      ligneAction(papierTigre ? 'Remplacer le fichier' : 'Importer un fichier', { action: 'importer-papier-tigre', onclick: () => actions.importerPapierTigre(ACCEPT_JSON) }),
      papierTigre ? ligneAction('Retirer le catalogue', { action: 'retirer-papier-tigre', danger: true, onclick: () => actions.retirerPapierTigre() }) : null,
      ligneAction('Fichier grisé ? Choisir sans filtre', { onclick: () => actions.importerPapierTigre('') }),
    ], 'Saisis les harmonies des livres dans un fichier JSON, puis importe-le ici. Il reste sur cet appareil.'),

    groupe('Mes données', [
      ligneAction('Exporter mes données', { action: 'exporter', onclick: () => actions.exporterDonnees() }),
      ligneAction('Importer des données', { action: 'importer', onclick: () => actions.importerDonnees(ACCEPT_JSON) }),
      ligneAction('Afficher mes données en texte', { action: 'copier-texte', onclick: () => actions.afficherTexteDonnees() }),
      ligneAction('Fichier grisé ? Importer sans filtre', { onclick: () => actions.importerDonnees('') }),
    ], [
      'Tes vêtements et réglages restent sur cet appareil. Exporte-les régulièrement pour les sauvegarder ou les passer sur un autre appareil. ',
      el('span', { 'data-info': 'persistance' }, `Stockage persistant : ${app.persistance}.`),
    ]),

    groupe('À propos', [
      el('div', { class: 'ligne' }, el('span', { class: 'texte-ligne' }, 'Version'), el('span', { class: 'valeur-ligne' }, VERSION_APP)),
      ligneAction('Charger la dernière version', { action: 'derniere-version', onclick: () => actions.chargerDerniereVersion() }),
      el('div', { class: 'ligne' }, el('ul', { class: 'credits' },
        el('li', {}, 'Combinaisons : Sanzō Wada, A Dictionary of Color Combinations. Données de Matt DesLauriers ',
          '(mattdesl/dictionary-of-colour-combinations) et Dain M. Blodorn Kim (dblodorn/sanzo-wada), licence MIT : ',
          // Nouvel onglet : dans l'app installée, une navigation sur place n'aurait pas de bouton retour.
          el('a', { href: 'data/LICENSE-wada.md', target: '_blank', rel: 'noopener' }, 'texte des licences'), '.'),
        el('li', {}, 'Teintes : Monk, Ellis. « Monk Skin Tone Scale », 2019, skintone.google, licence CC BY 4.0.'),
        el('li', {}, 'Harmonies Papier Tigre : Color Inspiration, volumes 1 à 3, saisies par l\'utilisateur, jamais publiées.'))),
    ], null, { 'data-section': 'a-propos' }));
}
