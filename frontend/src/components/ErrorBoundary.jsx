import { Component } from 'react';

/**
 * Empêche la page blanche en cas d'erreur de rendu : affiche un écran
 * d'erreur avec bouton de rechargement au lieu d'un arbre React vide.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, message: error?.message || '' };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: '16px',
          background: 'var(--background, #12151a)',
          color: 'var(--foreground, #e5e7eb)',
          fontFamily: 'system-ui, sans-serif', padding: '24px',
          textAlign: 'center',
        }}>
          <h1 style={{ fontSize: '20px', fontWeight: 700 }}>
            Une erreur est survenue
          </h1>
          <p style={{ opacity: 0.7, maxWidth: 480 }}>
            {this.state.message || "L'application a rencontré un problème."}
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '10px 24px', borderRadius: 10, border: 'none',
              background: 'var(--primary-600, #35645f)', color: '#fff',
              fontWeight: 600, cursor: 'pointer',
            }}
          >
            Recharger la page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
