// Stockage local (localStorage). Deux clés préfixées : l'état utilisateur et le catalogue Papier Tigre.
// Chaque enregistrement est une seule écriture : si elle échoue, l'ancienne valeur reste intacte.
// « espace » isole un jeu de clés (tests) : garde-robe-<espace>:… au lieu de garde-robe:…

import { etatInitial, exporterEtat, lireExport } from './donnees.js';

export function creerStockage(support, espace = '') {
  const prefixe = espace ? `garde-robe-${espace}:` : 'garde-robe:';
  const cle = (nom) => prefixe + nom;

  return {
    prefixe,

    // Renvoie { etat, avertissement }. Des données illisibles sont copiées à part avant d'être ignorées.
    chargerEtat() {
      let brut;
      try {
        brut = support.getItem(cle('etat'));
      } catch {
        return { etat: etatInitial(), avertissement: 'Stockage local inaccessible : les données ne seront pas enregistrées.' };
      }
      if (brut === null) return { etat: etatInitial(), avertissement: null };
      const { erreurs, etat } = lireExport(brut);
      if (erreurs.length === 0) return { etat, avertissement: null };
      try { support.setItem(cle('etat-illisible'), brut); } catch { /* rien de plus à faire */ }
      return { etat: etatInitial(), avertissement: `Données locales illisibles (${erreurs[0]}). Une copie est conservée.` };
    },

    // Lève une erreur si l'écriture échoue (quota, stockage indisponible) : l'appelant garde l'ancien état.
    enregistrerEtat(etat, date = new Date()) {
      support.setItem(cle('etat'), exporterEtat(etat, date));
    },

    // Préférences d'affichage de cet appareil (catégories pliées…) : hors des données exportées ; en cas d'échec,
    // la valeur par défaut, ou une préférence qui ne dure que la session.
    chargerPreference(nom, defaut) {
      try {
        const brut = support.getItem(cle(`preference-${nom}`));
        return brut === null ? defaut : JSON.parse(brut);
      } catch {
        return defaut;
      }
    },

    enregistrerPreference(nom, valeur) {
      try { support.setItem(cle(`preference-${nom}`), JSON.stringify(valeur)); } catch { /* préférence de la session seulement */ }
    },

    chargerPapierTigre() {
      try {
        return support.getItem(cle('papier-tigre'));
      } catch {
        return null;
      }
    },

    enregistrerPapierTigre(texte) {
      support.setItem(cle('papier-tigre'), texte);
    },

    supprimerPapierTigre() {
      support.removeItem(cle('papier-tigre'));
    },
  };
}
