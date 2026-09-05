import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary caught error]:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleResetAndReload = () => {
    try {
      sessionStorage.clear();
      localStorage.clear();
    } catch {}
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          background: '#f8fafc',
          color: '#1e293b',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          textAlign: 'center'
        }}>
          <div style={{
            maxWidth: '520px',
            width: '100%',
            background: '#ffffff',
            borderRadius: '16px',
            padding: '28px 20px',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)',
            border: '1px solid #e2e8f0'
          }}>
            <div style={{ fontSize: '3rem', marginBottom: '12px' }}>🍦</div>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 700, margin: '0 0 10px 0', color: '#0f172a' }}>
              Friozo Operadores
            </h2>
            <p style={{ fontSize: '0.88rem', color: '#64748b', lineHeight: '1.5', margin: '0 0 18px 0' }}>
              Se detectó un incidente al iniciar la vista operativa. Puedes recargar o restablecer el almacenamiento local.
            </p>

            {this.state.error && (
              <div style={{
                background: '#fef2f2',
                color: '#991b1b',
                padding: '12px',
                borderRadius: '8px',
                fontSize: '0.75rem',
                textAlign: 'left',
                marginBottom: '18px',
                wordBreak: 'break-word',
                border: '1px solid #fecaca',
                maxHeight: '180px',
                overflowY: 'auto'
              }}>
                <div style={{ fontWeight: 700, marginBottom: '4px' }}>Detalle técnico:</div>
                <code style={{ fontFamily: 'monospace', display: 'block', whiteSpace: 'pre-wrap' }}>
                  {String(this.state.error?.message || this.state.error)}
                </code>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                type="button"
                onClick={this.handleReload}
                style={{
                  background: '#0284c7',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '10px',
                  padding: '12px 20px',
                  fontSize: '0.95rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                🔄 Reintentar y Recargar
              </button>
              <button
                type="button"
                onClick={this.handleResetAndReload}
                style={{
                  background: '#f1f5f9',
                  color: '#475569',
                  border: '1px solid #cbd5e1',
                  borderRadius: '10px',
                  padding: '10px 16px',
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  fontWeight: 500
                }}
              >
                🧹 Restablecer Datos Locales y Reiniciar
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
