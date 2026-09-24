// Sélecteur de catalogue : composant commun au choix manuel, à « Ajuster » et aux favoris.
// mode 'choisir' : toucher une couleur la renvoie ; mode 'favoris' : toucher une couleur bascule son étoile.
// reference (Lab) : couleurs triées du ΔE00 le plus petit au plus grand, écart affiché.

import { el, pastille, terminaison } from '../ui.js';
import { plusProches } from '../catalogue.js';

const PAR_PAGE = 240;

function sansAccents(texte) {
  return texte.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

export function ouvrirSelecteur({ catalogue, titre, mode = 'choisir', reference = null, estFavori, basculerFavori }) {
  return new Promise((resoudre) => {
    const sourcesPresentes = [...new Set(catalogue.couleurs.map((c) => c.source))];
    const tout = reference
      ? plusProches(reference, catalogue, Infinity)
      : catalogue.couleurs.map((couleur) => ({ couleur, ecart: null }));
    const filtre = { texte: '', source: 'toutes', favorisSeulement: false, limite: PAR_PAGE };
    let terminer = null;

    const grille = el('div', { class: 'grille-couleurs', role: 'list' });
    const plus = el('button', { type: 'button', class: 'bouton secondaire plus', 'data-action': 'afficher-plus' }, 'Afficher plus');
    const compte = el('p', { class: 'discret compte' });

    function carte({ couleur, ecart }) {
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
      el('span', { class: 'detail' }, ecart === null ? couleur.hex : `ΔE ${ecart.toFixed(1).replace('.', ',')}`));
      return el('div', { class: 'carte-couleur', role: 'listitem' }, principal, etoile);
    }

    function afficher() {
      const texte = sansAccents(filtre.texte.trim());
      const visibles = tout.filter(({ couleur }) =>
        (filtre.source === 'toutes' || couleur.source === filtre.source)
        && (!filtre.favorisSeulement || estFavori(couleur.id))
        && (texte === '' || sansAccents(couleur.nom).includes(texte)));
      grille.replaceChildren(...visibles.slice(0, filtre.limite).map(carte));
      compte.textContent = visibles.length === 0 ? 'Aucune couleur ne correspond.'
        : `${Math.min(visibles.length, filtre.limite)} couleur(s) affichée(s) sur ${visibles.length}`;
      plus.hidden = visibles.length <= filtre.limite;
    }

    plus.addEventListener('click', () => { filtre.limite += PAR_PAGE; afficher(); });
    const recherche = el('input', {
      type: 'search', class: 'recherche', placeholder: 'Rechercher un nom', 'aria-label': 'Rechercher une couleur par son nom',
      autocomplete: 'off', 'data-action': 'rechercher',
      oninput: (e) => { filtre.texte = e.target.value; filtre.limite = PAR_PAGE; afficher(); },
    });

    const libellesSources = { toutes: 'Toutes', wada: 'Wada', 'papier-tigre': 'Papier Tigre' };
    const puces = el('div', { class: 'puces' });
    const sources = ['toutes', ...sourcesPresentes];
    const boutonsSource = sourcesPresentes.length > 1 ? sources.map((s) => el('button', {
      type: 'button', class: 'puce', 'aria-pressed': String(s === 'toutes'), 'data-source': s,
      onclick: (e) => {
        filtre.source = s;
        for (const b of puces.querySelectorAll('[data-source]')) b.setAttribute('aria-pressed', String(b === e.currentTarget));
        afficher();
      },
    }, libellesSources[s] ?? s)) : [];
    const puceFavoris = el('button', {
      type: 'button', class: 'puce', 'aria-pressed': 'false', 'data-action': 'favoris-seulement',
      onclick: (e) => {
        filtre.favorisSeulement = !filtre.favorisSeulement;
        e.currentTarget.setAttribute('aria-pressed', String(filtre.favorisSeulement));
        afficher();
      },
    }, '★ Favoris');
    puces.append(...boutonsSource, puceFavoris);

    const dialogue = el('dialog', { class: 'dialogue plein-ecran selecteur', 'aria-labelledby': 'titre-selecteur' },
      el('div', { class: 'selecteur-entete' },
        el('h2', { id: 'titre-selecteur', tabindex: '-1', autofocus: true }, titre),
        el('button', { type: 'button', class: 'bouton secondaire', 'data-action': 'fermer-selecteur', onclick: () => terminer(null) },
          mode === 'favoris' ? 'Terminé' : 'Annuler')),
      recherche,
      puces,
      reference ? el('p', { class: 'discret' }, 'Du plus proche au plus éloigné (ΔE00, écart de couleur).') : null,
      compte,
      grille,
      plus);
    terminer = terminaison(dialogue, resoudre);
    document.body.append(dialogue);
    afficher();
    dialogue.showModal();
  });
}
