// Premier lancement (écran d'accueil façon iOS) : choix du teint (MST 1 à 10, obligatoire) et interrupteur
// « teint dans les combinaisons ».

import { el, estInstallee, interrupteur } from '../ui.js';
import { MST } from '../constantes.js';
import { modifierReglages } from '../donnees.js';

export function rendrePremierLancement(conteneur, app, actions) {
  let mst = null;
  const teintActif = interrupteur({ id: 'teint-actif' });
  const commencer = el('button', {
    type: 'button', class: 'bouton principal large', disabled: true, 'data-action': 'commencer',
    onclick: () => {
      if (actions.mettreAJour(modifierReglages(app.etat, { mst, teintActif: teintActif.checked }))) actions.demanderPersistance();
    },
  }, 'Commencer');
  const teintes = el('div', { class: 'teintes', role: 'group', 'aria-label': 'Teintes de peau, échelle Monk de 1 à 10' },
    MST.map((hex, i) => el('button', {
      type: 'button', class: 'teinte', style: { backgroundColor: hex }, 'aria-pressed': 'false',
      'data-mst': i + 1, 'aria-label': `Teinte ${i + 1}`,
      onclick: (evenement) => {
        mst = i + 1;
        for (const bouton of teintes.children) bouton.setAttribute('aria-pressed', String(bouton === evenement.currentTarget));
        commencer.disabled = false;
      },
    }, el('span', {}, String(i + 1)))));

  conteneur.replaceChildren(el('section', { id: 'premier-lancement', class: 'premier-lancement' },
    el('h1', {}, 'Bienvenue'),
    el('p', { class: 'accroche' }, 'Enregistre les couleurs de tes vêtements : l\'app te propose des tenues qui vont ensemble.'),
    el('h2', { class: 'titre-groupe' }, 'Ton teint'),
    el('div', { class: 'groupe' },
      teintes,
      el('label', { class: 'ligne ligne-interrupteur', for: 'teint-actif' },
        el('span', { class: 'texte-ligne' }, 'Teint dans les combinaisons'), teintActif)),
    el('p', { class: 'pied-groupe' }, 'Choisis la teinte la plus proche de ta peau : elle colore l\'avatar. Avec l\'interrupteur, la peau peut aussi porter l\'une des couleurs, si elle est proche de ton teint.'),
    // Chemin d'installation de Safari sous iOS 26 (menu « ⋯ », puis Partager) : à vérifier sur l'iPhone.
    estInstallee() ? null : el('p', { class: 'encart astuce' },
      'Conseil : installe d\'abord l\'app sur l\'écran d\'accueil. Dans Safari, touche « ⋯ », puis Partager, ',
      'puis « Sur l\'écran d\'accueil ». Les données saisies dans Safari restent séparées de celles de l\'app installée.'),
    commencer,
    el('button', { type: 'button', class: 'bouton lien', 'data-action': 'restaurer', onclick: () => actions.importerDonnees() },
      'Restaurer une sauvegarde'),
    el('button', { type: 'button', class: 'bouton lien', onclick: () => actions.importerDonnees('') },
      'Fichier grisé ? Restaurer sans filtre'),
    el('p', { class: 'credit discret' }, 'Teintes : Monk, Ellis. « Monk Skin Tone Scale », 2019, skintone.google, licence CC BY 4.0.')));
}
