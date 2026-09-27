// Wishlist (demande de Théo, 2026-09-27) : les vêtements que l'on aimerait avoir, avec leur couleur. Bouton
// « Wishlist » dans la barre de la garde-robe ; ajout rapide depuis « Ce qui te manque » (Mes tenues) et depuis une
// pièce ⚠ d'une proposition. « Je l'ai » : l'envie devient un vêtement de la garde-robe (même type, même couleur).

import { el, pastille, ouvrirDialogue, annoncer, nouvelIdentifiant, tuile } from '../ui.js';
import { icone } from '../icones.js';
import { TYPES, LIBELLES_TYPES, NOTE_ENVIE_MAX } from '../constantes.js';
import { ajouterEnvie, retirerEnvie, obtenirEnvie, estDansWishlist } from '../donnees.js';
import { nomCouleurVetement, choisirUneCouleur } from './garde-robe.js';
import { proposerPhoto } from './fiche-vetement.js';

// Nom de la couleur d'une envie : celui du catalogue si elle en vient encore, sinon son hex.
const nomEnvie = (app, envie) => nomCouleurVetement({ ...envie, origine: 'manuel' }, app.catalogue);

// Ajout rapide : envie { type, hex, idCouleurCatalogue?, note? }. Une même envie (type et couleur) n'est gardée qu'une
// fois. Renvoie true si elle a été ajoutée.
export function ajouterALaWishlist(app, actions, envie) {
  if (estDansWishlist(app.etat, envie.type, envie.hex)) {
    annoncer('Déjà dans ta wishlist');
    return false;
  }
  const ok = actions.mettreAJour(ajouterEnvie(app.etat, envie, { id: nouvelIdentifiant(), date: new Date() }));
  if (ok) annoncer(`Ajouté à ta wishlist : ${LIBELLES_TYPES[envie.type]}, ${nomEnvie(app, envie)}`);
  return ok;
}

// Bouton « + » ou ✓ d'une ligne qui propose un vêtement (manque fréquent, pièce ⚠ d'une proposition).
export function boutonEnvie(app, actions, envie, libelle) {
  const dejaLa = estDansWishlist(app.etat, envie.type, envie.hex);
  return el('button', {
    type: 'button', class: 'bouton-envie', 'data-action': 'ajouter-a-la-wishlist', disabled: dejaLa,
    'aria-label': dejaLa ? `${libelle} : déjà dans ta wishlist` : `Ajouter à ma wishlist : ${libelle}`,
    onclick: () => ajouterALaWishlist(app, actions, envie),
  }, icone(dejaLa ? 'coche' : 'cadeau'));
}

// Bouton « Wishlist » de la barre de la garde-robe, avec le nombre d'envies.
export function boutonWishlist(app, actions) {
  const n = app.etat.wishlist.length;
  return el('button', {
    type: 'button', class: 'verre bouton-capsule', 'data-action': 'wishlist', 'aria-label': `Wishlist, ${n} envie${n > 1 ? 's' : ''}`,
    onclick: (evenement) => ouvrirWishlist(app, actions, evenement.currentTarget),
  }, icone('cadeau'), el('span', {}, 'Wishlist'), n > 0 ? el('span', { class: 'compte-capsule' }, String(n)) : null);
}

export async function ouvrirWishlist(app, actions) {
  const vide = el('p', { class: 'vide', 'data-info': 'wishlist-vide' },
    'Aucune envie pour l\'instant. Ajoute les vêtements que tu aimerais avoir, ou touche 🎁 dans « Ce qui te manque » (Mes tenues) ou sur une pièce ⚠ d\'une proposition.');
  const liste = el('div', { class: 'groupe liste-envies' });

  function afficher() {
    const envies = app.etat.wishlist;
    vide.hidden = envies.length > 0;
    liste.hidden = envies.length === 0;
    liste.replaceChildren(...envies.map((envie) => {
      const libelle = `${LIBELLES_TYPES[envie.type]} · ${nomEnvie(app, envie)}`;
      return el('div', { class: 'ligne ligne-envie', 'data-envie': envie.id },
        pastille(envie.hex, { classe: 'moyenne' }),
        el('span', { class: 'texte-ligne' }, libelle, envie.note ? el('small', {}, envie.note) : null),
        el('button', { type: 'button', class: 'bouton petit', 'data-action': 'envie-obtenue', onclick: () => obtenir(envie) }, 'Je l\'ai'),
        el('button', {
          type: 'button', class: 'retirer-couleur', 'data-action': 'retirer-envie', 'aria-label': `Retirer de la wishlist : ${libelle}`,
          onclick: () => {
            if (actions.mettreAJour(retirerEnvie(app.etat, envie.id))) {
              annoncer('Retiré de ta wishlist');
              afficher();
            }
          },
        }, icone('fermer')));
    }));
  }

  // « Je l'ai » : la photo est proposée comme pour tout nouveau vêtement, puis l'envie rejoint la garde-robe.
  async function obtenir(envie) {
    const photo = await proposerPhoto();
    const id = nouvelIdentifiant();
    let nouvelEtat;
    try {
      nouvelEtat = obtenirEnvie(app.etat, envie.id, { id, date: new Date(), photo: Boolean(photo) });
    } catch (erreur) {
      annoncer(erreur.message, 'erreur');
      return;
    }
    if (photo) actions.enregistrerPhoto(id, photo);
    if (actions.mettreAJour(nouvelEtat)) {
      annoncer(`Ajouté à ta garde-robe : ${LIBELLES_TYPES[envie.type]}, ${nomEnvie(app, envie)}`);
      afficher();
    } else if (photo) {
      actions.supprimerPhoto(id);
    }
  }

  const ajout = el('button', {
    type: 'button', class: 'ligne ligne-action', 'data-action': 'ajouter-envie',
    onclick: async (evenement) => {
      await nouvelleEnvie(app, actions, evenement.currentTarget);
      afficher();
    },
  }, icone('plus'), el('span', { class: 'texte-ligne' }, 'Ajouter une envie'));
  afficher();
  await ouvrirDialogue({
    titre: 'Ma wishlist',
    classe: 'feuille-wishlist',
    contenu: [
      el('p', { class: 'pied-groupe intro-wishlist' }, 'Les vêtements que tu aimerais avoir, avec leur couleur. « Je l\'ai » les range dans ta garde-robe.'),
      vide, liste,
      el('div', { class: 'groupe' }, ajout),
    ],
    boutons: [{ libelle: 'Fermer', valeur: null }],
  });
}

// Nouvelle envie : type, couleur (carte des couleurs ou mesure), note facultative.
async function nouvelleEnvie(app, actions, ancre) {
  const type = await ouvrirDialogue({
    titre: 'Quel vêtement ?',
    contenu: [el('div', { class: 'grille-types' }, TYPES.map((t) => tuile({ icone: t, libelle: LIBELLES_TYPES[t], 'data-choix': t })))],
    boutons: [{ libelle: 'Annuler', valeur: null }],
  });
  if (!type) return;
  const couleur = await choisirUneCouleur(app, actions, ancre, null);
  if (!couleur) return;
  const note = el('input', {
    type: 'text', class: 'champ-ligne', id: 'note-envie', maxlength: NOTE_ENVIE_MAX, placeholder: 'Facultatif', autocomplete: 'off', 'data-action': 'note-envie',
  });
  const reponse = await ouvrirDialogue({
    titre: 'Nouvelle envie',
    contenu: [
      el('div', { class: 'groupe' },
        el('div', { class: 'ligne' }, pastille(couleur.hex, { classe: 'moyenne' }),
          el('span', { class: 'texte-ligne' }, `${LIBELLES_TYPES[type]} · ${nomEnvie(app, couleur)}`)),
        el('label', { class: 'ligne', for: 'note-envie' }, el('span', {}, 'Note'), note)),
      el('p', { class: 'pied-groupe' }, 'Marque, magasin, taille…'),
    ],
    boutons: [{ libelle: 'Annuler', valeur: null }, { libelle: 'Ajouter', valeur: 'ok', style: 'principal' }],
  });
  if (reponse !== 'ok') return;
  try {
    ajouterALaWishlist(app, actions, { type, ...couleur, note: note.value });
  } catch (erreur) {
    annoncer(erreur.message, 'erreur');
  }
}
