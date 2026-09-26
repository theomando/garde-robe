// Écran Tenue du jour : cases des types (pantalon et short exclusifs), bouton « Proposer » (enregistre la tenue
// type), avatar, au plus 20 propositions avec source et référence, filtre « avec mes favoris ».
// Toucher une proposition met l'avatar à jour et affiche son détail (vêtements à porter, manques, favoris).

import { el, pastille } from '../ui.js';
import { TYPES, LIBELLES_TYPES, BAS, MST, PROPOSITIONS_MAX } from '../constantes.js';
import { enregistrerTenueType, basculerFavori } from '../donnees.js';
import { proposer, selectionner } from '../moteur.js';
import { dessinerAvatar, planAvatar } from '../avatar.js';
import { estNoir, labDepuisHex } from '../couleur.js';
import { nomCouleurVetement } from './garde-robe.js';

const ecartTexte = (ecart) => ecart.toFixed(1).replace('.', ',');

// État de l'écran, gardé en mémoire d'un onglet à l'autre (pas enregistré).
function etatEcran(app) {
  if (!app.tenue) {
    app.tenue = { types: [...(app.etat.tenuesTypes.at(-1) ?? [])], propose: false, selection: null, avecFavoris: false };
  }
  return app.tenue;
}

function reference(combinaison) {
  if (combinaison.source === 'wada') return `Wada ${combinaison.ref}`;
  return `Papier Tigre ${combinaison.ref}${combinaison.nom ? ` · ${combinaison.nom}` : ''}`;
}

function resume(proposition) {
  const n = proposition.nbManques;
  return [
    n === 0 ? 'rien ne manque' : `${n} manque${n > 1 ? 's' : ''}`,
    proposition.peauUtilisee ? 'avec la peau' : null,
    `écart moyen ${proposition.ecartMoyen === Infinity ? '—' : ecartTexte(proposition.ecartMoyen)}`,
    proposition.nbFavoris > 0 ? `★ ${proposition.nbFavoris}` : null,
  ].filter(Boolean).join(' · ');
}

export function rendreTenue(conteneur, app, actions) {
  const ecran = etatEcran(app);
  const couleur = (id) => app.catalogue.couleurParId.get(id);
  const libelle = (type) => LIBELLES_TYPES[type];

  // ---- Choix de la tenue ----
  const proposerBouton = el('button', {
    type: 'button', class: 'bouton principal large', 'data-action': 'proposer', disabled: ecran.types.length === 0,
    onclick: () => {
      ecran.types = TYPES.filter((t) => ecran.types.includes(t));
      actions.mettreAJour(enregistrerTenueType(app.etat, ecran.types), { sansRendu: true });
      ecran.propose = true;
      ecran.selection = null;
      actions.rafraichir();
    },
  }, 'Proposer');
  const grilleTypes = el('div', { class: 'grille-types-tenue', role: 'group', 'aria-label': 'Pièces de la tenue' },
    TYPES.map((type) => el('button', {
      type: 'button', class: 'bouton secondaire choix-type', 'data-type-tenue': type, 'aria-pressed': String(ecran.types.includes(type)),
      onclick: () => {
        if (ecran.types.includes(type)) ecran.types = ecran.types.filter((t) => t !== type);
        else ecran.types = [...ecran.types.filter((t) => !(BAS.includes(type) && BAS.includes(t))), type]; // un seul bas
        ecran.propose = false;
        actions.rafraichir();
      },
    }, libelle(type))));
  const choix = el('details', { class: 'choix-tenue carte', open: !ecran.propose },
    el('summary', {}, ecran.types.length > 0
      ? `Tenue : ${TYPES.filter((t) => ecran.types.includes(t)).map((t) => libelle(t).toLowerCase()).join(', ')}`
      : 'Choisis les pièces de ta tenue'),
    el('p', { class: 'discret' }, 'Pantalon et short ne vont pas ensemble. Sous un pull, le t-shirt ne compte pas.'),
    grilleTypes, proposerBouton);

  const contenu = [el('div', { class: 'entete-ecran' }, el('h1', {}, 'Tenue du jour')), choix];
  if (!ecran.propose) {
    contenu.push(el('p', { class: 'vide' }, ecran.types.length === 0
      ? 'Choisis les pièces de ta tenue, puis touche « Proposer ».'
      : 'Touche « Proposer » pour voir les combinaisons de couleurs.'));
    conteneur.replaceChildren(...contenu);
    return;
  }

  // ---- Propositions ----
  const resultat = proposer({
    types: ecran.types, vetements: app.etat.vetements, catalogue: app.catalogue, reglages: app.etat.reglages, cache: app.cacheEcarts,
  });
  app.cacheEcarts = resultat.cache;
  const affichees = selectionner(resultat.retenues, { avecFavoris: ecran.avecFavoris });
  if (!affichees.some((p) => p.combinaison.id === ecran.selection)) ecran.selection = affichees[0]?.combinaison.id ?? null;

  const panneau = el('section', { class: 'panneau-avatar', 'aria-label': 'Avatar de la tenue' });
  const liste = el('ol', { class: 'propositions' });

  function dessinerPanneau() {
    const choisie = affichees.find((p) => p.combinaison.id === ecran.selection);
    const pieces = choisie ? planAvatar(choisie, app.catalogue) : [];
    const description = choisie
      ? `Avatar : ${choisie.pieces.map((p) => `${libelle(p.type).toLowerCase()} ${p.manque ? 'manquant' : ''}`.trim()).join(', ')}`
      : 'Avatar sans tenue';
    panneau.dataset.selection = ecran.selection ?? '';
    panneau.replaceChildren(
      dessinerAvatar({ peau: MST[app.etat.reglages.mst - 1], pieces, description }),
      el('div', { class: 'legende' },
        choisie ? el('strong', {}, reference(choisie.combinaison)) : el('span', {}, 'Aucune proposition'),
        choisie ? el('span', { class: 'discret' }, resume(choisie)) : null,
        el('span', { class: 'discret' }, 'Hachuré : pièce qui te manque.')));
  }

  function detailPiece(piece, proposition) {
    const cible = piece.couleurId ? couleur(piece.couleurId) : null;
    if (piece.manque) {
      const texte = cible ? `il te manque ${cible.nom}` : 'il te manque un noir ou un blanc';
      return el('li', { class: 'manque' }, el('span', { class: 'pastille hachuree', style: `--hachure: ${cible?.hex ?? '#000000'}` }),
        el('span', {}, el('strong', {}, `${libelle(piece.type)} : `), texte));
    }
    const vetement = piece.vetement;
    const nom = nomCouleurVetement(vetement, app.catalogue);
    const texte = piece.joker
      ? `${nom} (joker ${estNoir(labDepuisHex(vetement.hex)) ? 'noir' : 'blanc'})`
      : `${nom} pour ${cible.nom} (écart ${ecartTexte(piece.ecart)})`;
    return el('li', {}, pastille(vetement.hex), el('span', {}, el('strong', {}, `${libelle(piece.type)} : `), texte));
  }

  function details(proposition) {
    const couleurs = proposition.combinaison.couleurs.map(couleur);
    const favoris = app.etat.reglages.favoris;
    return el('div', { class: 'details' },
      el('ul', { class: 'pieces' }, proposition.pieces.map((piece) => detailPiece(piece, proposition))),
      proposition.peau
        ? el('p', {}, `Peau : porte ${couleur(proposition.peau.couleurId).nom} (écart ${ecartTexte(proposition.peau.ecart)}).`)
        : null,
      el('p', { class: 'sous-titre' }, 'Couleurs de la combinaison'),
      el('div', { class: 'couleurs-combinaison' }, couleurs.map((c, j) => el('button', {
        type: 'button', class: 'favori', 'data-action': 'etoile-proposition', 'data-couleur': c.id,
        'aria-pressed': String(favoris.includes(c.id)),
        'aria-label': `${favoris.includes(c.id) ? 'Retirer' : 'Ajouter'} ${c.nom} ${favoris.includes(c.id) ? 'des' : 'aux'} favoris`,
        onclick: () => {
          actions.mettreAJour(basculerFavori(app.etat, c.id), { sansRendu: true });
          actions.rafraichir();
        },
      }, pastille(c.hex), el('span', {}, c.nom, proposition.combinaison.roles?.[j] === 'soutien' ? ' (soutien)' : ''),
      el('span', { class: 'etoile-texte', 'aria-hidden': 'true' }, favoris.includes(c.id) ? '★' : '☆')))));
  }

  function dessinerListe() {
    liste.replaceChildren(...affichees.map((proposition, index) => {
      const choisie = proposition.combinaison.id === ecran.selection;
      const couleurs = proposition.combinaison.couleurs.map(couleur);
      return el('li', { class: 'proposition-item' },
        el('button', {
          type: 'button', class: 'proposition', 'aria-pressed': String(choisie), 'data-combinaison': proposition.combinaison.id,
          onclick: () => {
            ecran.selection = proposition.combinaison.id;
            dessinerPanneau();
            dessinerListe();
          },
        },
        el('span', { class: 'rang' }, String(index + 1)),
        el('span', { class: 'bandes', 'aria-hidden': 'true' }, couleurs.map((c, j) => el('span', {
          class: `bande${proposition.combinaison.roles?.[j] === 'soutien' ? ' soutien' : ''}`, style: { backgroundColor: c.hex }, title: c.nom,
        }))),
        el('span', { class: 'infos' }, el('strong', {}, reference(proposition.combinaison)), el('span', { class: 'discret' }, resume(proposition)))),
        choisie ? details(proposition) : null);
    }));
  }

  const filtre = el('input', {
    type: 'checkbox', role: 'switch', class: 'interrupteur', id: 'filtre-favoris', checked: ecran.avecFavoris,
    onchange: (e) => { ecran.avecFavoris = e.target.checked; actions.rafraichir(); },
  });
  const candidates = selectionner(resultat.retenues, { avecFavoris: ecran.avecFavoris, max: Infinity }).length;
  const total = resultat.retenues.length;
  contenu.push(
    resultat.gardeRobeVide
      ? el('p', { class: 'encart', 'data-info': 'garde-robe-vide' }, 'Ta garde-robe est vide : ajoute tes vêtements (onglet Garde-robe) pour obtenir des propositions.')
      : null,
    panneau,
    el('label', { class: 'ligne-interrupteur', for: 'filtre-favoris' }, el('span', {}, 'Avec mes favoris'), filtre),
    el('p', { class: 'discret compte', 'data-info': 'compte' }, affichees.length === 0
      ? (ecran.avecFavoris && total > 0
        ? 'Aucune proposition ne contient tes couleurs favorites.'
        : 'Aucune combinaison ne convient (plus de 2 manques partout). Ajoute des vêtements ou augmente la tolérance (Réglages).')
      : `${affichees.length} proposition${affichees.length > 1 ? 's' : ''}${candidates > affichees.length ? ` (les ${PROPOSITIONS_MAX} premières sur ${candidates})` : ''}.`),
    liste);
  dessinerPanneau();
  dessinerListe();
  conteneur.replaceChildren(...contenu.filter(Boolean));
}
