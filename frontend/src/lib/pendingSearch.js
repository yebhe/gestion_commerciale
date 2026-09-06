// Petit pont entre la recherche globale de la Topbar et les modules :
// on stocke la requête tapée par l'utilisateur pour que le module cible
// puisse pré-remplir son propre champ de recherche à l'ouverture.
const PREFIX = 'pendingSearch:';

export function setPendingSearch(appKey, query) {
  try {
    sessionStorage.setItem(`${PREFIX}${appKey}`, query);
  } catch {
    // ignore (sessionStorage indisponible)
  }
}

export function consumePendingSearch(appKey) {
  try {
    const key = `${PREFIX}${appKey}`;
    const value = sessionStorage.getItem(key);
    if (value !== null) sessionStorage.removeItem(key);
    return value;
  } catch {
    return null;
  }
}
