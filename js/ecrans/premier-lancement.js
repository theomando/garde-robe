// Premier lancement, en deux temps comme les écrans d'accueil d'iOS : « Bienvenue » (icône, trois atouts illustrés,
// Continuer ou Restaurer une sauvegarde), puis choix du teint (MST 1 à 10, obligatoire) et interrupteur
// « teint dans les combinaisons ».

import { el, estInstallee, interrupteur } from '../ui.js';
import { icone } from '../icones.js';
import { MST } from '../constantes.js';
import { modifierReglages } from '../donnees.js';

let etape = 'bienvenue'; // gardée d'un rendu à l'autre tant que l'accueil n'est pas terminé

const ATOUTS = [
  ['camera', 'Mesure tes vêtements', 'La caméra relève leur couleur, ou choisis-la sur la carte des couleurs.'],
  ['t-shirt', 'Des tenues qui vont ensemble', 'Pour la tenue du jour, l\'app propose des combinaisons de couleurs harmonieuses.'],
  ['sac', 'Ce qui te manque', 'Elle repère les couleurs qui manquent le plus souvent à ta garde-robe.'],
];

function bienvenue(conteneur, app, actions) {
  conteneur.replaceChildren(el('section', { id: 'premier-lancement', class: 'premier-lancement', 'data-etape': 'bienvenue' },
    el('img', { class: 'icone-app', src: 'icones/icone-180.png', alt: '' }),
    el('h1', {}, 'Bienvenue'),
    el('p', { class: 'accroche' }, 'Associe les couleurs de tes vêtements. Tout reste sur ton téléphone.'),
    el('ul', { class: 'atouts' }, ATOUTS.map(([nom, titre, texte]) => el('li', {},
      icone(nom), el('div', {}, el('strong', {}, titre), el('p', {}, texte))))),
    // Chemin d'installation de Safari sous iOS 26 (menu « ⋯ », puis Partager) : à vérifier sur l'iPhone.
    estInstallee() ? null : el('p', { class: 'encart astuce' },
      'Conseil : installe d\'abord l\'app sur l\'écran d\'accueil. Dans Safari, touche « ⋯ », puis Partager, ',
      'puis « Sur l\'écran d\'accueil ». Les données saisies dans Safari restent séparées de celles de l\'app installée.'),
    el('button', {
      type: 'button', class: 'bouton principal large', 'data-action': 'continuer',
      onclick: () => { etape = 'teint'; actions.rafraichir(); window.scrollTo(0, 0); },
    }, 'Continuer'),
    el('button', { type: 'button', class: 'bouton lien', 'data-action': 'restaurer', onclick: () => actions.importerDonnees() },
      'Restaurer une sauvegarde'),
    el('button', { type: 'button', class: 'bouton lien', onclick: () => actions.importerDonnees('') },
      'Fichier grisé ? Restaurer sans filtre')));
}

function teint(conteneur, app, actions) {
  let mst = null;
  const teintActif = interrupteur({ id: 'teint-actif' });
  const commencer = el('button', {
    type: 'button', class: 'bouton principal large', disabled: true, 'data-action': 'commencer',
    onclick: () => {
      if (actions.mettreAJour(modifierReglages(app.etat, { mst, teintActif: teintActif.checked }))) {
        etape = 'bienvenue';
        actions.demanderPersistance();
      }
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

  conteneur.replaceChildren(el('section', { id: 'premier-lancement', class: 'premier-lancement', 'data-etape': 'teint' },
    el('h1', {}, 'Ton teint'),
    el('p', { class: 'accroche' }, 'Choisis la teinte la plus proche de ta peau : elle colore l\'avatar de la tenue du jour.'),
    el('div', { class: 'groupe' },
      teintes,
      el('label', { class: 'ligne ligne-interrupteur', for: 'teint-actif' },
        el('span', { class: 'texte-ligne' }, 'Teint dans les combinaisons'), teintActif)),
    el('p', { class: 'pied-groupe' }, 'Avec l\'interrupteur, la peau peut aussi porter l\'une des couleurs d\'une combinaison, si elle est proche de ton teint. Modifiable plus tard dans les Réglages.'),
    commencer,
    el('button', { type: 'button', class: 'bouton lien', 'data-action': 'retour-bienvenue', onclick: () => { etape = 'bienvenue'; actions.rafraichir(); } },
      'Retour'),
    el('p', { class: 'credit discret' }, 'Teintes : Monk, Ellis. « Monk Skin Tone Scale », 2019, skintone.google, licence CC BY 4.0.')));
}

export function rendrePremierLancement(conteneur, app, actions) {
  if (etape === 'teint') teint(conteneur, app, actions);
  else bienvenue(conteneur, app, actions);
}
