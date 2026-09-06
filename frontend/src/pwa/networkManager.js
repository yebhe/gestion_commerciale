/**
 * Gestionnaire d'état du réseau — détecte connecté / hors ligne / connexion lente.
 *
 * (_docs/11_MODULE_PWA.txt, section "État du réseau")
 *
 * Émet des événements via un EventTarget pour notifier les changements
 * d'état. Le PWAContext s'abonne pour mettre à jour l'UI.
 */

const SLOW_THRESHOLD_MS = 3000;

class NetworkManager extends EventTarget {
  constructor() {
    super();
    this._online = navigator.onLine;
    this._connection = 'unknown';
    this._latency = null;

    this._checkLatency();
    this._bindEvents();
  }

  _bindEvents() {
    window.addEventListener('online', () => {
      this._online = true;
      this._dispatch();
      this._checkLatency();
    });
    window.addEventListener('offline', () => {
      this._online = false;
      this._connection = 'none';
      this._dispatch();
    });

    if (navigator.connection) {
      navigator.connection.addEventListener('change', () => {
        this._connection = navigator.connection.effectiveType || 'unknown';
        this._dispatch();
      });
      this._connection = navigator.connection.effectiveType || 'unknown';
    }
  }

  _dispatch() {
    this.dispatchEvent(new CustomEvent('change', {
      detail: this.getState(),
    }));
  }

  async _checkLatency() {
    // Toujours synchroniser avec navigator.onLine (notamment pour DevTools)
    let now = navigator.onLine;
    if (!now) {
      if (this._online) {
        this._online = false;
        this._connection = 'none';
        this._dispatch();
      }
      return;
    }
    // Tester la connectivité réelle : si la requête échoue, on est offline
    try {
      const start = performance.now();
      await fetch('/favicon.svg', { method: 'HEAD', cache: 'no-store' });
      this._latency = Math.round(performance.now() - start);
      if (!this._online) {
        this._online = true;
        this._dispatch();
      }
    } catch {
      if (this._online) {
        this._online = false;
        this._connection = 'none';
        this._latency = null;
        this._dispatch();
      }
    }
  }

  getState() {
    let status = 'online';
    if (!this._online) {
      status = 'offline';
    } else if (this._latency !== null && this._latency > SLOW_THRESHOLD_MS) {
      status = 'slow';
    }
    return {
      online: this._online,
      status,
      connection: this._connection,
      latency: this._latency,
    };
  }

  // Vérification manuelle / immédiate (focus, retour en ligne, etc.)
  checkNow() {
    return this._checkLatency();
  }

  startLatencyPolling(intervalMs = 3000) {
    if (this._pollTimer) clearInterval(this._pollTimer);
    this._pollTimer = setInterval(() => this._checkLatency(), intervalMs);
  }

  stopLatencyPolling() {
    if (this._pollTimer) {
      clearInterval(this._pollTimer);
      this._pollTimer = null;
    }
  }
}

const networkManager = new NetworkManager();
export default networkManager;
