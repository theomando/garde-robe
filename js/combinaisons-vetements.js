// Combinaisons pour s'habiller (demande de Théo, 2026-09-27) : relevé de Théo (data/combinaisons-vetements.json) des
// combinaisons attribuées à une maison ou publiées par la presse ou un guide (origine « mode »), et ses combinaisons
// personnelles (origine « perso »). Elles passent avant celles de Wada et de Papier Tigre (js/moteur.js) et sont
// entourées d'or à l'écran. Couleurs : le nuancier du relevé donne pour chaque nom français le hex d'une couleur de
// Wada ; les combinaisons citent donc des couleurs de Wada. Une combinaison de Wada aux mêmes couleurs fait doublon :
// elle est retirée (remplacees). Module pur, sans DOM.

export const SOURCE_VETEMENTS = 'vetements';
const ORIGINES = ['mode', 'perso'];

// donnees : contenu du fichier ; wada : partie Wada du catalogue ({ couleurs, combinaisons }).
// Renvoie { couleurs: [], combinaisons, remplacees (identifiants des combinaisons de Wada en double) }.
export function construireCombinaisonsVetements(donnees, wada) {
  if (donnees?.format !== 'combinaisons-vetements' || donnees.version !== 1) {
    throw new Error('combinaisons-vetements.json : format « combinaisons-vetements », version 1 attendus');
  }
  const parHex = new Map(wada.couleurs.map((c) => [c.hex, c]));
  const idDe = new Map();
  for (const [nom, hex] of Object.entries(donnees.nuancier ?? {})) {
    const couleur = parHex.get(hex);
    if (!couleur) throw new Error(`combinaisons-vetements.json : « ${nom} » (${hex}) n'est pas une couleur de Wada`);
    idDe.set(nom, couleur.id);
  }
  const cle = (ids) => [...ids].sort().join('+');
  const ensembles = new Map();
  const combinaisons = (donnees.combinaisons ?? []).map((c, i) => {
    const ou = `combinaisons-vetements.json, combinaison ${i + 1} (${c.ref})`;
    if (typeof c.id !== 'string' || typeof c.ref !== 'string' || c.ref === '') throw new Error(`${ou} : id et ref attendus`);
    if (!ORIGINES.includes(c.origine)) throw new Error(`${ou} : origine « ${c.origine} » inconnue`);
    if (!Array.isArray(c.couleurs) || c.couleurs.length < 2 || c.couleurs.length > 4) throw new Error(`${ou} : 2 à 4 couleurs attendues`);
    const ids = c.couleurs.map((nom) => {
      if (!idDe.has(nom)) throw new Error(`${ou} : « ${nom} » absent du nuancier`);
      return idDe.get(nom);
    });
    if (new Set(ids).size !== ids.length) throw new Error(`${ou} : deux noms donnent la même couleur`);
    if (ensembles.has(cle(ids))) throw new Error(`${ou} : mêmes couleurs que ${ensembles.get(cle(ids))}`);
    ensembles.set(cle(ids), c.ref);
    return {
      id: `vetements-${c.id}`, source: SOURCE_VETEMENTS, ref: c.ref, ...(c.note ? { nom: c.note } : {}), couleurs: ids,
      origine: c.origine, sources: [...(c.sources ?? [])], ...(c.remarque ? { remarque: c.remarque } : {}),
    };
  });
  const ids = combinaisons.map((c) => c.id);
  if (new Set(ids).size !== ids.length) throw new Error('combinaisons-vetements.json : identifiant en double');
  const remplacees = wada.combinaisons.filter((k) => ensembles.has(cle(k.couleurs))).map((k) => k.id);
  return { couleurs: [], combinaisons, remplacees };
}
