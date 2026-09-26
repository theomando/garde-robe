// Service worker (sw.js) et mises à jour. Une nouvelle version s'installe en arrière-plan puis attend : le bandeau
// « Nouvelle version » propose de recharger, et elle ne prend la main qu'à ce moment (aucune saisie perdue).
// Pas d'enregistrement en développement local : le cache servirait d'anciennes versions des fichiers modifiés.

export function estDeveloppementLocal(hote) {
  return ['localhost', '127.0.0.1', '[::1]'].includes(hote);
}

// conteneur : navigator.serviceWorker (ou un double dans les tests). surNouvelleVersion : une version attend.
// recharger : appelé quand la version activée à la demande prend la main.
// Renvoie { activer, chercher, enregistrement }, ou null sans service worker.
export async function installerServiceWorker({ conteneur, url = 'sw.js', surNouvelleVersion, recharger }) {
  if (!conteneur) return null;
  let rechargementDemande = false;
  // À la première installation, clients.claim() change aussi de contrôleur : on ne recharge pas pour autant.
  conteneur.addEventListener('controllerchange', () => {
    if (rechargementDemande) recharger();
  });
  const enregistrement = await conteneur.register(url);

  // Une version qui attend alors qu'une autre contrôle déjà la page : c'est une mise à jour.
  const signaler = () => {
    if (enregistrement.waiting && conteneur.controller) surNouvelleVersion();
  };
  const suivre = (worker) => worker?.addEventListener('statechange', () => {
    if (worker.state === 'installed') signaler();
  });
  suivre(enregistrement.installing);
  enregistrement.addEventListener('updatefound', () => suivre(enregistrement.installing));
  signaler();

  function activer() {
    const enAttente = enregistrement.waiting;
    if (!enAttente) return false;
    rechargementDemande = true;
    enAttente.postMessage('activer');
    return true;
  }

  // Réglages > « Charger la dernière version » : cherche une version, l'active aussitôt. false : déjà à jour.
  async function chercher() {
    await enregistrement.update();
    const nouveau = enregistrement.installing;
    if (nouveau) {
      await new Promise((resoudre) => {
        const fin = () => { if (nouveau.state === 'installed' || nouveau.state === 'redundant') resoudre(); };
        nouveau.addEventListener('statechange', fin);
        fin();
      });
    }
    return activer();
  }

  return { activer, chercher, enregistrement };
}
