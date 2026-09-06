/**
 * Gestionnaire de mise à jour PWA — détecte les nouvelles versions du
 * Service Worker et notifie l'utilisateur.
 *
 * (_docs/11_MODULE_PWA.txt, section "Mises à jour")
 *
 * Ne recharge jamais automatiquement sans prévenir l'utilisateur.
 */

import { registerSW } from 'virtual:pwa-register';

class UpdateManager extends EventTarget {
  constructor() {
    super();
    this._updateReady = false;
    this._offlineReady = false;

    this._updateSW = registerSW({
      onNeedRefresh: () => {
        this._updateReady = true;
        this.dispatchEvent(new CustomEvent('updateAvailable'));
      },
      onOfflineReady: () => {
        this._offlineReady = true;
        this.dispatchEvent(new CustomEvent('offlineReady'));
      },
      onRegisteredSW(swUrl, registration) {
        // SW enregistré avec succès
      },
      onRegisterError(error) {
        console.error('[PWA] Erreur d\'enregistrement SW:', error);
      },
    });
  }

  get updateReady() {
    return this._updateReady;
  }

  get offlineReady() {
    return this._offlineReady;
  }

  /**
   * Applique la mise à jour en rechargeant la page.
   * À appeler uniquement après confirmation de l'utilisateur.
   */
  applyUpdate() {
    if (this._updateSW) {
      this._updateSW();
    }
  }
}

let updateManager = null;

export function initUpdateManager() {
  if (!updateManager) {
    updateManager = new UpdateManager();
  }
  return updateManager;
}

export default updateManager;
