// Point d'entrée : chargement de l'état et du catalogue, navigation par onglets (sans # dans l'URL), actions.
// ?espace=<nom> isole un jeu de clés de stockage (tests, démo) ; ?ecran=<nom> choisit l'onglet de départ.

import { el, annoncer, ouvrirDialogue, confirmer, afficherErreurs, choisirFichier, estInstallee } from './ui.js';
import { etatInitial, premierLancement, exporterEtat, lireExport, basculerFavori } from './donnees.js';
import { creerStockage } from './stockage.js';
import { construireWada, fusionnerCatalogues } from './catalogue.js';
import { lirePapierTigre } from './papier-tigre.js';
import { rendrePremierLancement } from './ecrans/premier-lancement.js';
import { rendreGardeRobe } from './ecrans/garde-robe.js';
import { rendreReglages } from './ecrans/reglages.js';
import { rendreTenue } from './ecrans/tenue.js';
import { rendreMesTenues } from './ecrans/mes-tenues.js';
import { installerServiceWorker, estDeveloppementLocal } from './mise-a-jour.js';
import { VERSION_APP } from './constantes.js';
import { icone } from './icones.js';

const ICONES_ONGLETS = { 'garde-robe': 'cintre', tenue: 't-shirt', 'mes-tenues': 'coeur', reglages: 'engrenage' };

// localStorage peut être inaccessible (Safari avec « Bloquer tous les cookies », données de site bloquées).
// On ne bascule pas en mémoire en silence : chaque accès échoue, l'app le signale et n'enregistre rien.
let stockageAccessible = true;
function supportLocal() {
  try {
    const support = window.localStorage;
    support.getItem('garde-robe:sonde');
    return support;
  } catch {
    stockageAccessible = false;
    const refus = () => { throw new Error('stockage local inaccessible'); };
    return { getItem: refus, setItem: refus, removeItem: refus };
  }
}

const stockage = creerStockage(supportLocal(), new URLSearchParams(location.search).get('espace') ?? '');

const app = {
  etat: etatInitial(),
  wada: null,
  papierTigre: null,
  catalogue: null,
  ecran: 'garde-robe',
  persistance: 'non demandé',
  cacheEcarts: null, // ΔE00 vêtement × catalogue, gardé d'un calcul de propositions à l'autre
  tenue: null, // état de l'écran Tenue du jour (types cochés, sélection, filtre)
  manques: null, // dernier calcul des manques fréquents, avec l'état et le catalogue qui l'ont produit
  photos: new Map(), // photos des vêtements (id → data URL), chargées depuis IndexedDB au démarrage
};

const ECRANS = {
  'garde-robe': rendreGardeRobe,
  tenue: rendreTenue,
  'mes-tenues': rendreMesTenues, // les manques fréquents sont en bas de cet onglet
  reglages: rendreReglages,
};

function construireCatalogue() {
  app.catalogue = fusionnerCatalogues(app.wada, app.papierTigre?.catalogue ?? null);
}

// Sélecteur qui retrouve, après un nouveau rendu, l'élément qui avait le focus (curseur, interrupteur, teinte…) :
// sans cela le focus retombe sur <body>, ce qui perd VoiceOver à chaque réglage.
function selecteurDuFocus(element) {
  const contenu = document.getElementById('contenu');
  if (!element || !contenu.contains(element) || element === contenu) return null;
  if (element.id) return `#${CSS.escape(element.id)}`;
  for (const attribut of ['data-mst', 'data-vetement', 'data-action']) {
    if (element.hasAttribute(attribut)) return `[${attribut}="${CSS.escape(element.getAttribute(attribut))}"]`;
  }
  return null;
}

function rendre() {
  const contenu = document.getElementById('contenu');
  const onglets = document.getElementById('onglets');
  const focus = selecteurDuFocus(document.activeElement);
  document.getElementById('bandeau').hidden = stockageAccessible;
  if (premierLancement(app.etat)) {
    onglets.hidden = true;
    rendrePremierLancement(contenu, app, actions);
  } else {
    onglets.hidden = false;
    for (const bouton of onglets.querySelectorAll('[data-ecran]')) {
      if (bouton.dataset.ecran === app.ecran) bouton.setAttribute('aria-current', 'page');
      else bouton.removeAttribute('aria-current');
    }
    ECRANS[app.ecran](contenu, app, actions);
  }
  if (focus) contenu.querySelector(focus)?.focus({ preventScroll: true });
}

// Défilement : le titre réduit apparaît dans la barre du haut dès que le grand titre passe dessous ; la barre
// d'onglets se fait discrète en descendant et revient en remontant (comme sous iOS 26).
let dernierDefilement = 0;
function suivreDefilement() {
  const y = window.scrollY;
  document.body.classList.toggle('defile', y > 34);
  const onglets = document.getElementById('onglets');
  if (y < 60 || y < dernierDefilement - 8) onglets.classList.remove('reduite');
  else if (y > dernierDefilement + 8) onglets.classList.add('reduite');
  if (Math.abs(y - dernierDefilement) > 8 || y < 60) dernierDefilement = y;
}

function chargerPapierTigre() {
  const texte = stockage.chargerPapierTigre();
  app.papierTigre = null;
  if (!texte) return;
  const resultat = lirePapierTigre(texte);
  if (resultat.erreurs.length === 0) app.papierTigre = resultat;
  else annoncer('Le catalogue Papier Tigre enregistré est illisible : réimporte-le depuis les Réglages.', 'erreur');
}

function nomFichierExport(date) {
  return `garde-robe-${date.toISOString().slice(0, 10)}.json`;
}

const actions = {
  // Écrit d'abord, puis met à jour la mémoire : une écriture refusée laisse tout inchangé.
  mettreAJour(nouvelEtat, { sansRendu = false } = {}) {
    try {
      stockage.enregistrerEtat(nouvelEtat);
    } catch (erreur) {
      annoncer(`Enregistrement impossible (${erreur.name ?? 'erreur'}) : rien n'a été modifié.`, 'erreur');
      // Redessiner remet curseurs et interrupteurs sur les valeurs réellement enregistrées.
      if (!sansRendu) rendre();
      return false;
    }
    app.etat = nouvelEtat;
    if (!sansRendu) rendre();
    return true;
  },

  rafraichir() {
    rendre();
  },

  naviguer(ecran) {
    app.ecran = ecran;
    rendre();
    window.scrollTo(0, 0);
    suivreDefilement();
  },

  favorisPourSelecteur() {
    return {
      estFavori: (id) => app.etat.reglages.favoris.includes(id),
      basculerFavori: (id) => actions.mettreAJour(basculerFavori(app.etat, id), { sansRendu: true }),
    };
  },

  demanderPersistance() {
    if (!navigator.storage?.persist) { app.persistance = 'non disponible sur ce navigateur'; return; }
    navigator.storage.persist()
      .then((accorde) => { app.persistance = accorde ? 'accordé' : 'non accordé'; })
      .catch(() => { app.persistance = 'non disponible'; });
  },

  async importerDonnees(accept = '.json,application/json') {
    const texte = await choisirFichier(accept);
    if (texte === null) return;
    const { erreurs, etat } = lireExport(texte);
    if (erreurs.length > 0) {
      await afficherErreurs('Import refusé', 'Le fichier n\'a pas été importé : tes données n\'ont pas changé.', erreurs);
      return;
    }
    if (!premierLancement(app.etat)) {
      const n = etat.vetements.length;
      const ok = await confirmer('Remplacer tes données ?',
        `Le fichier contient ${n} vêtement${n > 1 ? 's' : ''}. Tes données actuelles (${app.etat.vetements.length} vêtement${app.etat.vetements.length > 1 ? 's' : ''}, réglages et favoris) seront remplacées.`,
        'Remplacer');
      if (!ok) return;
    }
    if (actions.mettreAJour(etat)) annoncer('Données importées');
  },

  exporterDonnees() {
    const date = new Date();
    const fichier = new File([exporterEtat(app.etat, date, 2)], nomFichierExport(date), { type: 'application/json' });
    if (navigator.canShare?.({ files: [fichier] })) {
      navigator.share({ files: [fichier], title: 'Garde-robe chromatique' }).catch((erreur) => {
        if (erreur.name !== 'AbortError') actions.telecharger(fichier);
      });
      return;
    }
    actions.telecharger(fichier);
  },

  telecharger(fichier) {
    const adresse = URL.createObjectURL(fichier);
    const lien = el('a', { href: adresse, download: fichier.name, hidden: true });
    document.body.append(lien);
    lien.click();
    lien.remove();
    setTimeout(() => URL.revokeObjectURL(adresse), 60000);
    annoncer(`Fichier ${fichier.name} créé. S'il n'apparaît pas, utilise « Afficher mes données en texte ».`);
  },

  afficherTexteDonnees() {
    const zone = el('textarea', { class: 'texte-donnees', readonly: true, rows: 10, 'aria-label': 'Mes données au format JSON' });
    zone.value = exporterEtat(app.etat, new Date(), 2);
    const copier = el('button', {
      type: 'button', class: 'bouton secondaire large',
      onclick: () => {
        navigator.clipboard?.writeText(zone.value)
          .then(() => annoncer('Données copiées'))
          .catch(() => { zone.select(); annoncer('Sélectionne le texte puis copie-le.'); });
      },
    }, 'Copier le texte');
    return ouvrirDialogue({ titre: 'Mes données', contenu: [el('p', { class: 'discret' }, 'Colle ce texte dans un fichier .json pour le garder.'), zone, copier] });
  },

  async importerPapierTigre(accept) {
    const texte = await choisirFichier(accept);
    if (texte === null) return;
    const resultat = lirePapierTigre(texte);
    if (resultat.erreurs.length > 0) {
      await afficherErreurs('Fichier Papier Tigre refusé', 'Le catalogue actuel n\'a pas changé. Corrige ces points (outils/validateur.html aide à vérifier le fichier) :', resultat.erreurs);
      return;
    }
    try {
      stockage.enregistrerPapierTigre(JSON.stringify(resultat.donnees));
    } catch (erreur) {
      annoncer(`Enregistrement impossible (${erreur.name ?? 'erreur'}) : le catalogue n'a pas changé.`, 'erreur');
      return;
    }
    app.papierTigre = resultat;
    construireCatalogue();
    rendre();
    const { combinaisons, couleurs } = resultat.catalogue;
    annoncer(`Papier Tigre importé : ${combinaisons.length} harmonies, ${couleurs.length} couleurs.`);
    if (resultat.avertissements.length > 0) {
      await afficherErreurs('Import réussi, à vérifier', 'Le fichier est importé, mais ces points semblent suspects :', resultat.avertissements);
    }
  },

  // Avec le service worker : on lui demande de chercher une version plus récente et de l'activer.
  // Sans (développement local, navigateur sans service worker) : l'hébergeur garde les fichiers quelques minutes
  // en cache HTTP (10 min sur GitHub Pages) ; on retélécharge chaque fichier déjà chargé en contournant ce cache,
  // puis on recharge la page.
  async chargerDerniereVersion() {
    if (miseAJour) {
      annoncer('Recherche d\'une nouvelle version…');
      let trouvee;
      try {
        trouvee = await miseAJour.chercher();
      } catch {
        annoncer('Vérification impossible : es-tu connecté à internet ?', 'erreur');
        return;
      }
      // Version trouvée : elle prend la main, puis la page se recharge (controllerchange).
      if (!trouvee) annoncer(`Tu as déjà la dernière version (${VERSION_APP}).`);
      return;
    }
    annoncer('Téléchargement de la dernière version…');
    const adresses = new Set([location.href.split('?')[0], location.href]);
    for (const ressource of performance.getEntriesByType('resource')) {
      if (ressource.name.startsWith(location.origin)) adresses.add(ressource.name);
    }
    await Promise.all([...adresses].map((adresse) => fetch(adresse, { cache: 'reload' }).catch(() => null)));
    location.reload();
  },

  async retirerPapierTigre() {
    if (!(await confirmer('Retirer le catalogue Papier Tigre ?', 'Ses harmonies ne seront plus proposées. Tes vêtements et favoris sont conservés.', 'Retirer'))) return;
    try {
      stockage.supprimerPapierTigre();
    } catch {
      annoncer('Suppression impossible.', 'erreur');
      return;
    }
    app.papierTigre = null;
    construireCatalogue();
    rendre();
    annoncer('Catalogue Papier Tigre retiré');
  },
};

// Service worker : hors ligne et mises à jour (bandeau « Nouvelle version »). Son échec n'empêche pas l'app de marcher.
let miseAJour = null;
function preparerMisesAJour() {
  if (estDeveloppementLocal(location.hostname) || !navigator.serviceWorker) return;
  const bandeau = document.getElementById('nouvelle-version');
  document.getElementById('recharger-version').addEventListener('click', () => {
    if (!miseAJour?.activer()) location.reload();
  });
  installerServiceWorker({
    conteneur: navigator.serviceWorker,
    surNouvelleVersion: () => { bandeau.hidden = false; },
    recharger: () => location.reload(),
  }).then((resultat) => { miseAJour = resultat; }).catch(() => {});
  // L'app installée reste ouverte en arrière-plan : on vérifie aussi à chaque retour au premier plan.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') miseAJour?.enregistrement.update().catch(() => {});
  });
}

async function demarrer() {
  preparerMisesAJour();
  const { etat, avertissement } = stockage.chargerEtat();
  app.etat = etat;
  try {
    const reponse = await fetch('data/wada.json');
    if (!reponse.ok) throw new Error(`HTTP ${reponse.status}`);
    app.wada = construireWada(await reponse.json());
  } catch (erreur) {
    document.getElementById('contenu').replaceChildren(
      el('p', { class: 'vide' }, `Impossible de charger le catalogue des couleurs (${erreur.message}). Vérifie la connexion puis relance l'app.`));
    return;
  }
  chargerPapierTigre();
  construireCatalogue();

  // Un autre onglet de l'app a écrit : on relit, pour ne pas écraser ses changements à la prochaine écriture.
  window.addEventListener('storage', (evenement) => {
    if (evenement.key === null || evenement.key === `${stockage.prefixe}etat`) app.etat = stockage.chargerEtat().etat;
    if (evenement.key === null || evenement.key === `${stockage.prefixe}papier-tigre`) {
      chargerPapierTigre();
      construireCatalogue();
    }
    rendre();
  });

  // ?ecran=manques (ancien onglet) mène à Mes tenues, où se trouvent désormais les manques.
  const ecranDemande = { manques: 'mes-tenues' }[new URLSearchParams(location.search).get('ecran')] ?? new URLSearchParams(location.search).get('ecran');
  if (Object.hasOwn(ECRANS, ecranDemande)) app.ecran = ecranDemande;
  for (const bouton of document.querySelectorAll('#onglets [data-ecran]')) {
    bouton.prepend(icone(ICONES_ONGLETS[bouton.dataset.ecran]));
    bouton.addEventListener('click', () => actions.naviguer(bouton.dataset.ecran));
  }
  window.addEventListener('scroll', suivreDefilement, { passive: true });
  rendre();
  if (avertissement) annoncer(avertissement, 'erreur');
  if (!premierLancement(app.etat) && estInstallee()) actions.demanderPersistance();
  else navigator.storage?.persisted?.().then((oui) => { app.persistance = oui ? 'accordé' : 'non demandé'; });
  document.body.dataset.etat = 'pret';
}

demarrer();
