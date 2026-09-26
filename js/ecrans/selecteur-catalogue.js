// Carte des couleurs (demande de Théo, 2026-09-26) : composant commun au choix manuel, à « Tout le catalogue » de
// la mesure, à « Changer la couleur » et aux favoris.
// Vue « carte » : les plus proches de la mesure (si une référence est donnée), puis la mosaïque des familles
// (★ Favoris d'abord, s'il y en a). Toucher une famille ouvre sa section : toutes ses variations, du plus clair au
// plus foncé ; « ‹ Carte » revient. La recherche par nom porte sur tout le catalogue.
// mode 'choisir' : toucher une couleur la renvoie ; mode 'favoris' : toucher une couleur bascule son étoile.

import { el, pastille, terminaison, armerDialogue, boutonRond } from '../ui.js';
import { icone } from '../icones.js';
import { plusProches } from '../catalogue.js';
import { deltaE00 } from '../couleur.js';
import { grouperParFamille } from '../familles.js';

const PAR_PAGE = 240;
const CASES_DAMIER = 9; // damier 3 × 3 d'une tuile de famille
const NB_PROCHES = 12;

// Rangement calculé une fois par catalogue (il change seulement à l'import ou au retrait de Papier Tigre).
const familles = new WeakMap();
function famillesDe(catalogue) {
  if (!familles.has(catalogue)) familles.set(catalogue, grouperParFamille(catalogue.couleurs));
  return familles.get(catalogue);
}

function sansAccents(texte) {
  return texte.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

// Cases du damier : couleurs réparties régulièrement du clair au foncé (répétées si la famille est petite).
function damier(couleurs) {
  return Array.from({ length: CASES_DAMIER }, (_, i) => couleurs[Math.floor((i * couleurs.length) / CASES_DAMIER)]);
}

const ecartTexte = (ecart) => `ΔE ${ecart.toFixed(1).replace('.', ',')}`;

export function ouvrirSelecteur({ catalogue, titre, mode = 'choisir', reference = null, estFavori, basculerFavori }) {
  return new Promise((resoudre) => {
    const groupes = famillesDe(catalogue);
    const ecart = (couleur) => (reference ? deltaE00(reference, couleur.lab) : null);
    let vue = 'carte'; // 'carte', id d'une famille, 'favoris' ou 'recherche'
    let texte = '';
    let limite = PAR_PAGE;
    let terminer = null;

    const titreElement = el('h2', { id: 'titre-selecteur', tabindex: '-1', autofocus: true }, titre);
    const retour = el('button', {
      type: 'button', class: 'bouton-retour', 'data-action': 'retour-carte', hidden: true,
      onclick: () => { vue = 'carte'; limite = PAR_PAGE; afficher('arriere'); },
    }, icone('chevron-gauche'), 'Carte');
    const fermer = mode === 'favoris'
      ? el('button', { type: 'button', class: 'bouton principal petit', 'data-action': 'fermer-selecteur', onclick: () => terminer(null) }, 'Terminé')
      : boutonRond({ icone: 'fermer', libelle: 'Annuler', action: 'fermer-selecteur', onclick: () => terminer(null) });
    const recherche = el('input', {
      type: 'search', class: 'recherche', placeholder: 'Rechercher un nom', 'aria-label': 'Rechercher une couleur par son nom',
      autocomplete: 'off', 'data-action': 'rechercher',
      oninput: (e) => {
        texte = e.target.value;
        limite = PAR_PAGE;
        vue = texte.trim() === '' ? 'carte' : 'recherche';
        afficher();
      },
    });
    const corps = el('div', { class: 'vue-selecteur' });

    function carte(couleur) {
      const e = ecart(couleur);
      const etoile = el('button', {
        type: 'button', class: 'etoile', 'data-action': 'etoile', 'data-couleur': couleur.id,
        'aria-pressed': String(estFavori(couleur.id)),
        'aria-label': `${estFavori(couleur.id) ? 'Retirer' : 'Ajouter'} ${couleur.nom} ${estFavori(couleur.id) ? 'des' : 'aux'} favoris`,
      }, estFavori(couleur.id) ? '★' : '☆');
      etoile.addEventListener('click', () => {
        basculerFavori(couleur.id);
        const actif = estFavori(couleur.id);
        etoile.textContent = actif ? '★' : '☆';
        etoile.setAttribute('aria-pressed', String(actif));
        etoile.setAttribute('aria-label', `${actif ? 'Retirer' : 'Ajouter'} ${couleur.nom} ${actif ? 'des' : 'aux'} favoris`);
      });
      const principal = el('button', {
        type: 'button', class: 'choisir', 'data-action': 'choisir-couleur', 'data-couleur': couleur.id,
        onclick: () => {
          if (mode === 'favoris') etoile.click();
          else terminer(couleur);
        },
      },
      pastille(couleur.hex, { classe: 'grande' }),
      el('span', { class: 'nom' }, couleur.nom),
      el('span', { class: 'detail' }, e === null ? couleur.hex : ecartTexte(e)));
      return el('div', { class: 'carte-couleur', role: 'listitem' }, principal, etoile);
    }

    function grille(liste) {
      return [
        el('div', { class: 'grille-couleurs', role: 'list' }, liste.slice(0, limite).map(carte)),
        liste.length > limite ? el('button', {
          type: 'button', class: 'bouton plus', 'data-action': 'afficher-plus',
          onclick: () => { limite += PAR_PAGE; afficher(); },
        }, 'Afficher plus') : null,
      ];
    }

    function tuile(id, nom, couleurs) {
      return el('button', {
        type: 'button', class: 'tuile-famille', 'data-famille': id, 'aria-label': `${nom}, ${couleurs.length} couleurs`,
        onclick: () => { vue = id; limite = PAR_PAGE; afficher('avant'); },
      },
      el('span', { class: 'damier', 'aria-hidden': 'true' }, damier(couleurs).map((c) => el('span', { style: { backgroundColor: c.hex } }))),
      el('span', { class: 'nom-famille' }, nom),
      el('span', { class: 'compte-famille' }, `${couleurs.length} couleur${couleurs.length > 1 ? 's' : ''}`));
    }

    const favoris = () => catalogue.couleurs.filter((c) => estFavori(c.id));

    function afficher(sens = null) {
      let contenu;
      let titreVue = titre;
      if (vue === 'recherche') {
        const cle = sansAccents(texte.trim());
        let trouvees = catalogue.couleurs.filter((c) => sansAccents(c.nom).includes(cle));
        if (reference) trouvees = trouvees.map((c) => ({ c, e: ecart(c) })).sort((x, y) => x.e - y.e).map((x) => x.c);
        contenu = [
          el('p', { class: 'compte discret' }, trouvees.length === 0 ? 'Aucune couleur ne correspond.'
            : `${trouvees.length} couleur${trouvees.length > 1 ? 's' : ''}${reference ? ', de la plus proche à la plus éloignée' : ''}`),
          ...grille(trouvees),
        ];
      } else if (vue === 'carte') {
        const favorites = favoris();
        contenu = [
          reference ? el('h3', { class: 'titre-vue' }, 'Les plus proches de la mesure') : null,
          reference ? el('div', { class: 'rangee-proches', role: 'list' },
            plusProches(reference, catalogue, NB_PROCHES).map(({ couleur }) => carte(couleur))) : null,
          el('h3', { class: 'titre-vue' }, 'Carte des couleurs'),
          el('div', { class: 'mosaique' },
            favorites.length > 0 ? tuile('favoris', '★ Favoris', favorites) : null,
            groupes.map((g) => tuile(g.id, g.nom, g.couleurs))),
        ];
      } else {
        const groupe = vue === 'favoris' ? { nom: '★ Favoris', couleurs: favoris() } : groupes.find((g) => g.id === vue);
        titreVue = groupe.nom;
        contenu = [
          el('p', { class: 'compte discret' }, `${groupe.couleurs.length} couleur${groupe.couleurs.length > 1 ? 's' : ''}, de la plus claire à la plus foncée`),
          ...grille(groupe.couleurs),
        ];
      }
      titreElement.textContent = titreVue;
      retour.hidden = vue === 'carte' || vue === 'recherche';
      dialogue.dataset.vue = vue;
      corps.replaceChildren(...contenu.filter(Boolean));
      if (sens) {
        corps.classList.remove('avant', 'arriere');
        void corps.offsetWidth; // relance l'animation
        corps.classList.add(sens);
        dialogue.scrollTop = 0;
      }
    }

    const dialogue = el('dialog', { class: 'dialogue plein-ecran selecteur', 'aria-labelledby': 'titre-selecteur' },
      el('div', { class: 'selecteur-entete' },
        el('div', { class: 'gauche' }, retour), titreElement, el('div', { class: 'droite' }, fermer)),
      recherche,
      corps);
    terminer = terminaison(dialogue, resoudre);
    document.body.append(dialogue);
    armerDialogue(dialogue);
    afficher();
    dialogue.showModal();
  });
}
