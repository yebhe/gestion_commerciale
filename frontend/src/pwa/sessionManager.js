/**
 * Gestionnaire de session locale sécurisée.
 *
 * (_docs/11_MODULE_PWA.txt)
 *
 * Responsabilités :
 * - Créer une session locale chiffrée après la 1ère connexion en ligne.
 * - Permettre la connexion hors ligne si la session est valide.
 * - Gérer l'expiration (7 jours max).
 * - Générer et stocker un device_uuid unique par appareil.
 * - Chiffrer les données sensibles avec Web Crypto API (AES-GCM).
 *
 * Ne stocke JAMAIS : mot de passe, token brut.
 * Stocke : profil utilisateur, permissions, company, store, paramètres — chiffrés.
 */

const SESSION_KEY = 'yebhe_session';
const DEVICE_KEY = 'yebhe_device_uuid';
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 jours
const CRYPTO_ALGO = 'AES-GCM';
const CRYPTO_KEY_NAME = 'yebhe_crypto_key';

/**
 * Génère ou récupère un UUID unique par appareil.
 */
export function getDeviceUuid() {
  let uuid = localStorage.getItem(DEVICE_KEY);
  if (!uuid) {
    uuid = crypto.randomUUID();
    localStorage.setItem(DEVICE_KEY, uuid);
  }
  return uuid;
}

/**
 * Détermine ou récupère la clé de chiffrement.
 * Utilise IndexedDB pour persister la clé entre les sessions.
 */
async function idbRequest(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function waitTransaction(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(new Error('Transaction aborted'));
  });
}

async function getCryptoKey() {
  // Tenter de récupérer la clé depuis IndexedDB
  const db = await openCryptoDB();
  const tx = db.transaction('keys', 'readonly');
  const stored = await idbRequest(tx.objectStore('keys').get(CRYPTO_KEY_NAME));
  if (stored && stored.key && typeof stored.key === 'object' && stored.key.type) {
    return stored.key;
  }

  // Créer une nouvelle clé
  const key = await crypto.subtle.generateKey(
    { name: CRYPTO_ALGO, length: 256 },
    true,
    ['encrypt', 'decrypt']
  );

  // Persister
  const tx2 = db.transaction('keys', 'readwrite');
  tx2.objectStore('keys').put({ name: CRYPTO_KEY_NAME, key });
  await waitTransaction(tx2);

  return key;
}

function openCryptoDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('yebhe-crypto', 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore('keys', { keyPath: 'name' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Chiffre une chaîne avec AES-GCM.
 */
async function encrypt(data) {
  const key = await getCryptoKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(JSON.stringify(data));
  const ciphertext = await crypto.subtle.encrypt(
    { name: CRYPTO_ALGO, iv },
    key,
    encoded
  );
  // Combiner iv + ciphertext en base64
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(ciphertext), iv.length);
  return btoa(String.fromCharCode(...combined));
}

/**
 * Déchiffre une chaîne AES-GCM.
 */
async function decrypt(encryptedB64) {
  const key = await getCryptoKey();
  const combined = Uint8Array.from(atob(encryptedB64), (c) => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);
  const decrypted = await crypto.subtle.decrypt(
    { name: CRYPTO_ALGO, iv },
    key,
    ciphertext
  );
  return JSON.parse(new TextDecoder().decode(decrypted));
}

/**
 * Crée une session locale chiffrée après une connexion en ligne réussie.
 *
 * @param {object} params - { user, permissions, company, store, settings }
 */
export async function createLocalSession(params) {
  const { user, permissions, company, store, settings } = params;
  const now = Date.now();

  const sessionData = {
    user,
    permissions,
    company,
    store,
    settings,
    device_uuid: getDeviceUuid(),
    created_at: now,
    expires_at: now + SESSION_DURATION_MS,
    logged_out: false,
  };

  const encrypted = await encrypt(sessionData);
  localStorage.setItem(SESSION_KEY, encrypted);
}

/**
 * Récupère et déchiffre la session locale.
 * Retourne null si inexistante ou illisible.
 */
export async function getLocalSession() {
  const encrypted = localStorage.getItem(SESSION_KEY);
  if (!encrypted) return null;

  try {
    const session = await decrypt(encrypted);
    return session;
  } catch {
    return null;
  }
}

/**
 * Vérifie si la session locale est valide pour une connexion hors ligne.
 *
 * (_docs/11_MODULE_PWA.txt, section "CONNEXION HORS LIGNE")
 */
export async function isValidOfflineSession() {
  const session = await getLocalSession();
  if (!session) return false;
  if (session.logged_out) return false;
  if (Date.now() > session.expires_at) return false;
  if (session.device_uuid !== getDeviceUuid()) return false;
  return true;
}

/**
 * Vérifie si la session a expiré (pour forcer une reconnexion en ligne).
 */
export async function isSessionExpired() {
  const session = await getLocalSession();
  if (!session) return true;
  return Date.now() > session.expires_at;
}

/**
 * Marque la session comme déconnectée.
 * Les données de la session sont supprimées mais les ventes en attente sont préservées.
 */
export async function destroyLocalSession() {
  localStorage.removeItem(SESSION_KEY);
}

/**
 * Met à jour les données de la session (ex: après un refresh des permissions).
 */
export async function updateLocalSession(updates) {
  const session = await getLocalSession();
  if (!session) return;
  const updated = { ...session, ...updates };
  const encrypted = await encrypt(updated);
  localStorage.setItem(SESSION_KEY, encrypted);
}

/**
 * Vérifie si un autre utilisateur a des ventes non synchronisées sur cet appareil.
 * Empêche le changement d'utilisateur tant que ces ventes ne sont pas synchronisées.
 *
 * (_docs/11_MODULE_PWA.txt, section "BLOCAGE DE CHANGEMENT D'UTILISATEUR")
 *
 * @param {string} newUserUuid - UUID de l'utilisateur qui tente de se connecter
 * @param {object} db - instance Dexie
 * @returns {object|null} - { user_uuid, count } si bloqué, null sinon
 */
export async function checkUserChangeBlock(db, newUserUuid) {
  const pending = await db.syncQueue
    .where('status').anyOf(['pending', 'error', 'conflict'])
    .and((op) => op.user_uuid && op.user_uuid !== newUserUuid)
    .toArray();

  if (pending.length === 0) return null;

  // Grouper par user_uuid
  const byUser = {};
  for (const op of pending) {
    if (!byUser[op.user_uuid]) byUser[op.user_uuid] = 0;
    byUser[op.user_uuid]++;
  }

  const [blockedUser, count] = Object.entries(byUser)[0];
  return { user_uuid: blockedUser, count };
}
