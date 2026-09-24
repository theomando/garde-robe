// Mini-harnais de test : enregistre des tests, les exécute dans l'ordre
// et écrit le bilan dans la page (dernière ligne : « RESULTAT ok/total »).
// Un test peut renvoyer une chaîne : elle s'affiche comme note à côté de « ok ».

const tests = [];

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
    try {
      const note = await fn();
      reussis++;
      lignes.push(`ok     ${nom}${typeof note === 'string' ? ` (${note})` : ''}`);
    } catch (erreur) {
      lignes.push(`ECHEC  ${nom} : ${erreur.message}`);
    }
  }
  lignes.push(`RESULTAT ${reussis}/${total}`);
  sortie.textContent = lignes.join('\n');
  document.title = `RESULTAT ${reussis}/${total}`;
}
