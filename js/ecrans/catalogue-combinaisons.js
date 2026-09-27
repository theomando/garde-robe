// Catalogue des combinaisons (demande de Théo, 2026-09-27) : toutes les combinaisons, rien que leurs couleurs (bandes et
// noms), à mettre en favorites (★). Ouvert par le bouton « Combinaisons » de l'onglet Tenue. Une combinaison favorite
// passe en tête des propositions à manques égaux (js/moteur.js) et compte dans « Ce qui te manque » (js/statistiques.js).

import { el, terminaison, armerDialogue, boutonRond } from '../ui.js';
import { basculerFavoriCombinaison } from '../donnees.js';

const PAR_PAGE = 60;
const sansAccents = (texte) => texte.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
const majuscule = (texte) => texte.charAt(0).toUpperCase() + texte.slice(1);

// Noms des couleurs d'une combinaison : ceux du relevé (français) pour une combinaison pour s'habiller, sinon ceux du
// catalogue.
export function nomsCombinaison(combinaison, catalogue) {
  if (combinaison.noms) return combinaison.noms.map(majuscule);
  return combinaison.couleurs.map((id) => catalogue.couleurParId.get(id).nom);
}

// Bandes d'une combinaison (une soutien de Papier Tigre deux fois plus étroite).
export function bandesCombinaison(combinaison, catalogue) {
  return el('span', { class: 'bandes', 'aria-hidden': 'true' }, combinaison.couleurs.map((id, j) => el('span', {
    class: `bande${combinaison.roles?.[j] === 'soutien' ? ' soutien' : ''}`, style: { backgroundColor: catalogue.couleurParId.get(id).hex },
  })));
}

const FILTRES = [['toutes', 'Toutes'], ['favorites', '★ Favorites'], ['vetements', 'Pour s\'habiller']];
const NOMBRES = [[0, 'Toutes'], [2, '2 couleurs'], [3, '3'], [4, '4 et plus']];

export function ouvrirCatalogueCombinaisons(app, actions) {
  return new Promise((resoudre) => {
    const { catalogue } = app;
    const favorites = () => new Set(app.etat.reglages.favorisCombinaisons ?? []);
    // Celles pour s'habiller d'abord (préférées), puis l'ordre du catalogue.
    const toutes = [...catalogue.combinaisons.filter((k) => k.source === 'vetements'), ...catalogue.combinaisons.filter((k) => k.source !== 'vetements')];
    let filtre = 'toutes';
    let nombre = 0;
    let texte = '';
    let limite = PAR_PAGE;

    function carte(combinaison) {
      const noms = nomsCombinaison(combinaison, catalogue);
      const etoile = el('button', { type: 'button', class: 'etoile-combinaison', 'data-action': 'favori-combinaison', 'data-combinaison': combinaison.id });
      const dessinerEtoile = () => {
        const favorite = favorites().has(combinaison.id);
        etoile.textContent = favorite ? '★' : '☆';
        etoile.setAttribute('aria-pressed', String(favorite));
        etoile.setAttribute('aria-label', `${favorite ? 'Retirer' : 'Ajouter'} ${noms.join(', ')} ${favorite ? 'des' : 'aux'} favorites`);
      };
      etoile.addEventListener('click', () => {
        if (actions.mettreAJour(basculerFavoriCombinaison(app.etat, combinaison.id), { sansRendu: true })) dessinerEtoile();
      });
      dessinerEtoile();
      return el('li', { class: `carte-combinaison${combinaison.source === 'vetements' ? ' pour-vetements' : ''}`, 'data-combinaison': combinaison.id },
        bandesCombinaison(combinaison, catalogue), el('span', { class: 'noms-combinaison' }, noms.join(' · ')), etoile);
    }

    function trouvees() {
      const cle = sansAccents(texte.trim());
      const fav = favorites();
      return toutes.filter((k) => (filtre !== 'favorites' || fav.has(k.id))
        && (filtre !== 'vetements' || k.source === 'vetements')
        && (nombre === 0 || (nombre === 4 ? k.couleurs.length >= 4 : k.couleurs.length === nombre))
        && (cle === '' || [...nomsCombinaison(k, catalogue), ...k.couleurs.map((id) => catalogue.couleurParId.get(id).nom)]
          .some((nom) => sansAccents(nom).includes(cle))));
    }

    const compte = el('p', { class: 'compte discret', 'data-info': 'compte-combinaisons' });
    const corps = el('div', { class: 'vue-combinaisons' });
    function afficher() {
      const liste = trouvees();
      compte.textContent = liste.length > 0 ? `${liste.length} combinaison${liste.length > 1 ? 's' : ''}`
        : filtre === 'favorites' && texte.trim() === '' && nombre === 0 ? 'Aucune combinaison favorite : touche ☆ sur celles que tu aimes.'
          : 'Aucune combinaison ne correspond.';
      corps.replaceChildren(
        el('ul', { class: 'grille-combinaisons' }, liste.slice(0, limite).map(carte)),
        ...(liste.length > limite ? [el('button', {
          type: 'button', class: 'bouton plus', 'data-action': 'afficher-plus', onclick: () => { limite += PAR_PAGE; afficher(); },
        }, 'Afficher plus')] : []));
    }

    const puces = (options, courant, choisir, attribut) => {
      const groupe = el('div', { class: 'puces', role: 'group' }, options.map(([valeur, libelle]) => el('button', {
        type: 'button', class: 'puce', [attribut]: valeur, 'aria-pressed': String(valeur === courant()),
        onclick: () => {
          choisir(valeur);
          limite = PAR_PAGE;
          for (const b of groupe.children) b.setAttribute('aria-pressed', String(b.getAttribute(attribut) === String(valeur)));
          afficher();
        },
      }, libelle)));
      return groupe;
    };
    const recherche = el('input', {
      type: 'search', class: 'recherche', placeholder: 'Rechercher une couleur', 'aria-label': 'Rechercher une combinaison par une de ses couleurs',
      autocomplete: 'off', 'data-action': 'rechercher-combinaison',
      oninput: (e) => { texte = e.target.value; limite = PAR_PAGE; afficher(); },
    });

    const dialogue = el('dialog', { class: 'dialogue plein-ecran catalogue-combinaisons', 'aria-labelledby': 'titre-combinaisons' },
      el('div', { class: 'selecteur-entete' },
        el('div', { class: 'gauche' }),
        el('h2', { id: 'titre-combinaisons', tabindex: '-1', autofocus: true }, 'Combinaisons'),
        el('div', { class: 'droite' }, boutonRond({ icone: 'fermer', libelle: 'Fermer', action: 'fermer-combinaisons', onclick: () => terminer(null) }))),
      el('p', { class: 'pied-groupe intro-combinaisons' }, 'Les couleurs de chaque combinaison. ☆ : favorite, proposée en premier dans la tenue du jour.'),
      recherche,
      puces(FILTRES, () => filtre, (v) => { filtre = v; }, 'data-filtre'),
      puces(NOMBRES, () => nombre, (v) => { nombre = Number(v); }, 'data-nombre'),
      compte, corps);
    // À la fermeture, l'onglet Tenue se redessine : les favorites passent en tête des propositions.
    const terminer = terminaison(dialogue, (valeur) => { resoudre(valeur); actions.rafraichir(); });
    document.body.append(dialogue);
    armerDialogue(dialogue);
    afficher();
    dialogue.showModal();
  });
}
