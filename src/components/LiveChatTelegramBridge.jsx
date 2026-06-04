import { useState } from 'react';

export default function LiveChatTelegramBridge({ 
  storePhone, 
  storeName, 
  view, 
  hasFloatingCart,
  showAlert
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  if (view === 'admin') return null;

  const triggerAlert = (msg) => {
    if (showAlert) {
      const isError = msg.toLowerCase().includes('error') || msg.toLowerCase().includes('falló') || msg.toLowerCase().includes('conexión');
      const isSuccess = msg.toLowerCase().includes('enviado') || msg.toLowerCase().includes('éxito');
      const type = isError ? 'error' : isSuccess ? 'success' : 'warning';
      const title = isError ? 'Error de Envío' : isSuccess ? 'Mensaje Enviado' : 'Aviso';
      showAlert(title, msg, type);
    } else {
      window.alert(msg);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!message.trim()) return;

    setSending(true);
    const textMsg = `💬 *¡NUEVO MENSAJE DE CLIENTE!* 💬\n\n` +
      `*Cliente:* ${name.trim() || 'Anónimo'}\n` +
      `*Mensaje:* ${message.trim()}\n\n` +
      `_Enviado desde el chat en vivo de la heladería._`;

    try {
      const response = await fetch('/api/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: textMsg,
          parse_mode: 'Markdown',
          kind: 'support'
        })
      });

      if (response.ok) {
        setSent(true);
        setMessage('');
        setTimeout(() => {
          setSent(false);
          setIsOpen(false);
        }, 3000);
      } else {
        const cleanPhone = String(storePhone || '').replace(/\D/g, '');
        const waMessage = `Hola, mi nombre es ${name || 'Cliente'}. Tengo una consulta sobre ${storeName || 'helados'}:\n\n${message}`;
        const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(waMessage)}`;
        window.open(waUrl, '_blank');
        setIsOpen(false);
        setMessage('');
      }
    } catch (err) {
      console.error("Error al enviar mensaje a Telegram:", err);
      triggerAlert("Error de conexión. Inténtalo de nuevo.");
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        .live-chat-bubble {
          position: fixed;
          bottom: ${hasFloatingCart ? '145px' : '85px'};
          right: 20px;
          width: 56px;
          height: 56px;
          background: linear-gradient(135deg, var(--primary-color) 0%, var(--secondary-color) 100%);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: 1.6rem;
          cursor: pointer;
          box-shadow: 0 4px 15px rgba(255, 107, 129, 0.4);
          z-index: 9999;
          transition: bottom 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275), transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275), box-shadow 0.3s ease;
        }
        .live-chat-bubble:hover {
          transform: scale(1.1);
          box-shadow: 0 6px 20px rgba(255, 107, 129, 0.5);
        }
        .live-chat-window {
          position: fixed;
          bottom: ${hasFloatingCart ? '215px' : '155px'};
          right: 20px;
          width: 320px;
          max-width: calc(100vw - 40px);
          background: var(--glass-bg, rgba(255, 255, 255, 0.9));
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border: 1px solid var(--border-color);
          border-radius: 16px;
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
          z-index: 9998;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          transition: bottom 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
          animation: slideUpIn 0.3s cubic-bezier(0.165, 0.84, 0.44, 1);
        }
        @keyframes slideUpIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .live-chat-header {
          padding: 12px 16px;
          background: linear-gradient(135deg, var(--primary-color) 0%, var(--secondary-color) 100%);
          color: white;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .live-chat-header h4 {
          margin: 0;
          font-size: 0.95rem;
          font-weight: 700;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .live-chat-close {
          background: none;
          border: none;
          color: white;
          font-size: 1.2rem;
          cursor: pointer;
          opacity: 0.8;
          transition: opacity 0.2s ease;
          padding: 0;
          line-height: 1;
        }
        .live-chat-close:hover {
          opacity: 1;
        }
        .live-chat-body {
          padding: 15px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .live-chat-welcome {
          font-size: 0.78rem;
          color: var(--text-light);
          margin: 0 0 5px 0;
          line-height: 1.4;
        }
        .live-chat-form {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .live-chat-form label {
          font-size: 0.72rem;
          font-weight: bold;
          margin-bottom: -4px;
          color: var(--text-dark);
          text-align: left;
          display: block;
        }
        .live-chat-success {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 25px 15px;
          text-align: center;
          gap: 10px;
        }
        .live-chat-success-icon {
          font-size: 3rem;
          animation: scalePop 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }
        @keyframes scalePop {
          0% { transform: scale(0.5); }
          100% { transform: scale(1); }
        }
      ` }} />

      {/* Burbuja flotante */}
      <div 
        className="live-chat-bubble"
        onClick={() => setIsOpen(!isOpen)}
        title="Chat de soporte en vivo"
      >
        {isOpen ? '✕' : '💬'}
      </div>

      {/* Ventana de chat */}
      {isOpen && (
        <div className="live-chat-window">
          <div className="live-chat-header">
            <h4>🍦 Chat en Vivo</h4>
            <button className="live-chat-close" onClick={() => setIsOpen(false)}>✕</button>
          </div>
          
          {sent ? (
            <div className="live-chat-success">
              <span className="live-chat-success-icon">✅</span>
              <strong style={{ fontSize: '0.9rem', color: 'var(--text-dark)' }}>¡Mensaje Enviado!</strong>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-light)', margin: 0 }}>
                Tu mensaje ha sido enviado al administrador a través del puente de soporte. Te responderemos muy pronto.
              </p>
            </div>
          ) : (
            <div className="live-chat-body">
              <p className="live-chat-welcome">
                ¿Tienes alguna consulta o inconveniente con tu pedido? Escríbenos directamente y un administrador te atenderá de inmediato.
              </p>
              
              <form className="live-chat-form" onSubmit={handleSendMessage}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Tu Nombre (Opcional)</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Ej: Carlos"
                    style={{ fontSize: '0.8rem', padding: '6px 10px' }}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Tu Mensaje</label>
                  <textarea
                    className="form-control"
                    rows="3"
                    placeholder="Escribe tu consulta aquí..."
                    style={{ fontSize: '0.8rem', padding: '6px 10px', resize: 'none' }}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    required
                  />
                </div>

                <button 
                  type="submit" 
                  className="btn btn-primary"
                  style={{ width: '100%', padding: '8px', fontSize: '0.8rem', marginTop: '5px', cursor: 'pointer' }}
                  disabled={sending}
                >
                  {sending ? 'Enviando...' : '🚀 Enviar Mensaje'}
                </button>
              </form>
            </div>
          )}
        </div>
      )}
    </>
  );
}
