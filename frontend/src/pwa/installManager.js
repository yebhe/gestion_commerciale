/**
 * Gestionnaire d'installation PWA — capture l'événement beforeinstallprompt.
 *
 * (_docs/11_MODULE_PWA.txt, section "Installation")
 *
 * L'invitation n'est affichée que lorsque c'est pertinent, jamais de
 * manière intrusive.
 */

class InstallManager extends EventTarget {
  constructor() {
    super();
    this._deferredPrompt = null;
    this._installed = false;

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this._deferredPrompt = e;
      this.dispatchEvent(new CustomEvent('canInstall'));
    });

    window.addEventListener('appinstalled', () => {
      this._installed = true;
      this._deferredPrompt = null;
      this.dispatchEvent(new CustomEvent('installed'));
    });
  }

  get canInstall() {
    return !!this._deferredPrompt;
  }

  get isInstalled() {
    return this._installed || window.matchMedia('(display-mode: standalone)').matches;
  }

  async promptInstall() {
    if (!this._deferredPrompt) return false;
    this._deferredPrompt.prompt();
    const { outcome } = await this._deferredPrompt.userChoice;
    this._deferredPrompt = null;
    if (outcome === 'accepted') {
      this.dispatchEvent(new CustomEvent('installed'));
      return true;
    }
    this.dispatchEvent(new CustomEvent('dismissed'));
    return false;
  }
}

const installManager = new InstallManager();
export default installManager;
