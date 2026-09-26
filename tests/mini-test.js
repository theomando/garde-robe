// Mini-harnais de test : enregistre des tests, les exécute dans l'ordre
// et écrit le bilan dans la page (dernière ligne : « RESULTAT ok/total »).
// Un test peut renvoyer une chaîne : elle s'affiche comme note à côté de « ok ».

const tests = [];
const DELAI_TEST_MS = 20000; // un test qui ne se termine pas échoue au lieu de figer toute la page

export class EchecAssertion extends Error {}

export function test(nom, fn) {
  tests.push({ nom, fn });
}

export function vrai(condition, message = 'condition fausse') {
  if (!condition) throw new EchecAssertion(message);
}

export function egal(obtenu, attendu, message = '') {
  if (!Object.is(obtenu, attendu)) {
    throw new EchecAssertion(`${message} attendu ${String(attendu)}, obtenu ${String(obtenu)}`.trim());
  }
}

export function egalProfond(obtenu, attendu, message = '') {
  const a = JSON.stringify(obtenu);
  const b = JSON.stringify(attendu);
  if (a !== b) throw new EchecAssertion(`${message} attendu ${b}, obtenu ${a}`.trim());
}

export function proche(obtenu, attendu, tolerance, message = '') {
  const ecart = Math.abs(obtenu - attendu);
  if (!(ecart <= tolerance)) {
    throw new EchecAssertion(`${message} attendu ${attendu} ± ${tolerance}, obtenu ${obtenu} (écart ${ecart})`.trim());
  }
}

export function leve(fn, message = 'une erreur était attendue') {
  try {
    fn();
  } catch (erreur) {
    if (erreur instanceof EchecAssertion) throw erreur;
    return erreur;
  }
  throw new EchecAssertion(message);
}

// Attend qu'une condition renvoie une valeur vraie (interrogée toutes les 25 ms, 10 s au plus).
export function attendre(condition, message = 'condition') {
  return new Promise((resoudre, rejeter) => {
    let essais = 0;
    const verifier = () => {
      let valeur;
      try { valeur = condition(); } catch { valeur = null; }
      if (valeur) resoudre(valeur);
      else if (++essais > 400) rejeter(new EchecAssertion(`délai dépassé : ${message}`));
      else setTimeout(verifier, 25);
    };
    verifier();
  });
}

export async function lancer(fichiers, sortie) {
  const lignes = [];
  let reussis = 0;
  let total = 0;
  for (const fichier of fichiers) {
    try {
      await import(fichier);
    } catch (erreur) {
      total++;
      lignes.push(`ECHEC import ${fichier} : ${erreur.message}`);
    }
  }
  for (const { nom, fn } of tests) {
    total++;
    // Progression visible : si la page se fige, le dernier test lancé apparaît dans la sortie.
    sortie.textContent = [...lignes, `EN COURS : ${nom}`].join('\n');
    let minuterie = null;
    const delai = new Promise((_, rejeter) => {
      minuterie = setTimeout(() => rejeter(new EchecAssertion(`délai de ${DELAI_TEST_MS / 1000} s dépassé`)), DELAI_TEST_MS);
    });
    try {
      const note = await Promise.race([Promise.resolve().then(fn), delai]);
      reussis++;
      lignes.push(`ok     ${nom}${typeof note === 'string' ? ` (${note})` : ''}`);
    } catch (erreur) {
      lignes.push(`ECHEC  ${nom} : ${erreur.message}`);
    } finally {
      clearTimeout(minuterie);
    }
  }
  lignes.push(`RESULTAT ${reussis}/${total}`);
  sortie.textContent = lignes.join('\n');
  document.title = `RESULTAT ${reussis}/${total}`;
}
