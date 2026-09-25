// Écran Réglages : teint, interrupteur, tolérance, favoris, catalogue Papier Tigre, export et import, crédits.

import { el, pastille } from '../ui.js';
import { MST, TOLERANCE_MIN, TOLERANCE_MAX, TOLERANCE_PAS, TOLERANCE_DEFAUT, VERSION_APP } from '../constantes.js';
import { modifierReglages } from '../donnees.js';
import { ouvrirSelecteur } from './selecteur-catalogue.js';

const ACCEPT_JSON = '.json,application/json';

function section(titre, ...contenu) {
  return el('section', { class: 'carte' }, el('h2', {}, titre), contenu);
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

  const interrupteur = el('input', {
    type: 'checkbox', role: 'switch', class: 'interrupteur', id: 'reglage-teint-actif', checked: reglages.teintActif,
    onchange: (e) => actions.mettreAJour(modifierReglages(app.etat, { teintActif: e.target.checked })),
  });

  const valeurTolerance = el('output', { for: 'reglage-tolerance', class: 'valeur' }, formaterTolerance(reglages.tolerance));
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
    el('div', { class: 'entete-ecran' }, el('h1', {}, 'Réglages')),

    section('Teint',
      el('p', { class: 'discret' }, 'Échelle Monk, de 1 (le plus clair) à 10 (le plus foncé).'),
      teintes,
      el('label', { class: 'ligne-interrupteur', for: 'reglage-teint-actif' },
        el('span', {}, 'Teint dans les combinaisons',
          el('small', { class: 'discret' }, 'La peau peut porter une couleur proche de ton teint.')),
        interrupteur)),

    section('Tolérance',
      el('label', { class: 'ligne-curseur', for: 'reglage-tolerance' }, el('span', {}, 'Écart maximal (ΔE00)'), valeurTolerance),
      curseur,
      el('p', { class: 'discret' },
        `Un vêtement correspond à une couleur si leur écart ne dépasse pas cette valeur. ${TOLERANCE_DEFAUT} par défaut : `,
        'valeur de départ, à ajuster à l\'usage (plus bas = plus exigeant).')),

    section('Favoris',
      el('p', {}, connus.length === 0 ? 'Aucune couleur favorite.' : `${connus.length} couleur${connus.length > 1 ? 's' : ''} favorite${connus.length > 1 ? 's' : ''}.`),
      connus.length > 0 ? el('div', { class: 'rangee-pastilles' }, connus.slice(0, 40).map((c) => pastille(c.hex, { titre: c.nom }))) : null,
      absents > 0 ? el('p', { class: 'discret' }, `${absents} favori(s) du catalogue Papier Tigre, absent sur cet appareil.`) : null,
      el('button', {
        type: 'button', class: 'bouton secondaire', 'data-action': 'gerer-favoris',
        onclick: async () => {
          await ouvrirSelecteur({ catalogue: app.catalogue, titre: 'Mes favoris', mode: 'favoris', ...actions.favorisPourSelecteur() });
          actions.rafraichir();
        },
      }, 'Gérer mes favoris')),

    section('Catalogue Papier Tigre',
      el('p', { 'data-info': 'papier-tigre' }, papierTigre
        ? `Importé : ${papierTigre.combinaisons.length} harmonies, ${papierTigre.couleurs.length} couleurs.`
        : 'Non importé. Saisis les harmonies des livres dans un fichier JSON, puis importe-le ici. Il reste sur cet appareil.'),
      el('div', { class: 'rangee-boutons' },
        el('button', { type: 'button', class: 'bouton secondaire', 'data-action': 'importer-papier-tigre', onclick: () => actions.importerPapierTigre(ACCEPT_JSON) },
          papierTigre ? 'Remplacer le fichier' : 'Importer un fichier'),
        papierTigre ? el('button', { type: 'button', class: 'bouton secondaire danger', 'data-action': 'retirer-papier-tigre', onclick: () => actions.retirerPapierTigre() }, 'Retirer') : null),
      el('button', { type: 'button', class: 'bouton lien', onclick: () => actions.importerPapierTigre('') }, 'Le fichier apparaît grisé ? Choisir sans filtre')),

    section('Mes données',
      el('p', { class: 'discret' }, 'Tes vêtements et réglages restent sur cet appareil. Exporte-les régulièrement pour les sauvegarder ou les passer sur un autre appareil.'),
      el('div', { class: 'rangee-boutons' },
        el('button', { type: 'button', class: 'bouton secondaire', 'data-action': 'exporter', onclick: () => actions.exporterDonnees() }, 'Exporter'),
        el('button', { type: 'button', class: 'bouton secondaire', 'data-action': 'importer', onclick: () => actions.importerDonnees(ACCEPT_JSON) }, 'Importer')),
      el('button', { type: 'button', class: 'bouton lien', 'data-action': 'copier-texte', onclick: () => actions.afficherTexteDonnees() }, 'Afficher mes données en texte (à copier)'),
      el('button', { type: 'button', class: 'bouton lien', onclick: () => actions.importerDonnees('') }, 'Le fichier apparaît grisé ? Importer sans filtre'),
      el('p', { class: 'discret', 'data-info': 'persistance' }, `Stockage persistant : ${app.persistance}.`)),

    section('Crédits',
      el('ul', { class: 'credits' },
        el('li', {}, 'Combinaisons : Sanzō Wada, A Dictionary of Color Combinations. Données de Matt DesLauriers ',
          '(mattdesl/dictionary-of-colour-combinations) et Dain M. Blodorn Kim (dblodorn/sanzo-wada), licence MIT : ',
          // Nouvel onglet : dans l'app installée, une navigation sur place n'aurait pas de bouton retour.
          el('a', { href: 'data/LICENSE-wada.md', target: '_blank', rel: 'noopener' }, 'texte des licences'), '.'),
        el('li', {}, 'Teintes : Monk, Ellis. « Monk Skin Tone Scale », 2019, skintone.google, licence CC BY 4.0.'),
        el('li', {}, 'Harmonies Papier Tigre : Color Inspiration, volumes 1 à 3, saisies par l\'utilisateur, jamais publiées.')),
      el('p', { class: 'discret' }, `Version ${VERSION_APP}`)));
}
