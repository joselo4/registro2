import { useRef, useState } from 'react';
import { sendSupportMessage } from '../utils/supportMessaging';

export default function LiveChatTelegramBridge({ 
  view, 
  hasFloatingCart,
  showAlert
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [sendError, setSendError] = useState('');
  const sendingRef = useRef(false);

  if (view === 'admin') return null;

  const triggerAlert = (msg) => {
    if (showAlert) {
      const isError = msg.toLowerCase().includes('error') || msg.toLowerCase().includes('falló') || msg.toLowerCase().includes('conexión') || msg.toLowerCase().includes('obligatorio') || msg.toLowerCase().includes('inválido');
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
    if (sendingRef.current) return;

    // Sanitización básica de inputs (evitar inyección HTML/XSS)
    const cleanName = name.replace(/<[^>]*>/g, '').trim();
    const cleanPhone = phone.replace(/[^0-9+\s-]/g, '').trim();
    const cleanMessage = message.replace(/<[^>]*>/g, '').trim();

    if (cleanPhone.replace(/\D/g, '').length < 7) {
      triggerAlert("El número de teléfono es obligatorio y debe tener al menos 7 dígitos.");
      return;
    }

    if (!cleanMessage) {
      triggerAlert("El mensaje no puede estar vacío.");
      return;
    }

    sendingRef.current = true;
    setSending(true);
    setSendError('');

    try {
      await sendSupportMessage({ name: cleanName, phone: cleanPhone, message: cleanMessage });
      setSent(true);
      setMessage('');
    } catch (err) {
      setSendError(err?.message || 'No pudimos conectar. Conservamos tu consulta para que puedas reintentar.');
    } finally {
      setSending(false);
      sendingRef.current = false;
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
      <button type="button"
        className="live-chat-bubble"
        onClick={() => setIsOpen(!isOpen)}
        title="Consultar sobre mi pedido"
        aria-label={isOpen ? 'Cerrar chat' : 'Consultar sobre mi pedido'}
        aria-expanded={isOpen}
        aria-controls="support-chat"
      >
        {isOpen ? '✕' : '💬'}
      </button>

      {/* Ventana de chat */}
      {isOpen && (
        <div className="live-chat-window" id="support-chat" role="region" aria-label="Consulta sobre tu pedido">
          <div className="live-chat-header">
            <h4>Atención por Telegram</h4>
            <button className="live-chat-close" aria-label="Cerrar chat" onClick={() => setIsOpen(false)}>✕</button>
          </div>
          
          {sent ? (
            <div className="live-chat-success" role="status">
              <span className="live-chat-success-icon">✅</span>
              <strong style={{ fontSize: '0.9rem', color: 'var(--text-dark)' }}>¡Mensaje Enviado!</strong>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-light)', margin: 0 }}>
                Tu consulta llegó al Telegram de la tienda. El equipo tiene tus datos de contacto para atenderte.
              </p>
              <button type="button" className="btn btn-secondary" onClick={() => setSent(false)}>Enviar otra consulta</button>
            </div>
          ) : (
            <div className="live-chat-body">
              <p className="live-chat-welcome">
                ¿Una duda antes de pedir? Envía tu consulta directamente al Telegram de la tienda, sin salir de esta página.
              </p>
              
              <form className="live-chat-form" onSubmit={handleSendMessage}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label htmlFor="support-name">Tu nombre (opcional)</label>
                  <input
                    type="text"
                    id="support-name"
                    autoComplete="name"
                    maxLength={80}
                    disabled={sending}
                    className="form-control"
                    placeholder="Ej: Carlos"
                    style={{ fontSize: '0.8rem', padding: '6px 10px' }}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label htmlFor="support-phone">Tu teléfono de contacto</label>
                  <input
                    type="tel"
                    id="support-phone"
                    autoComplete="tel"
                    maxLength={20}
                    disabled={sending}
                    className="form-control"
                    placeholder="Ej: +51 987 654 321"
                    style={{ fontSize: '0.8rem', padding: '6px 10px' }}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                  />
                </div>
                
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label htmlFor="support-message">Tu consulta</label>
                  <textarea
                    id="support-message"
                    maxLength={1000}
                    disabled={sending}
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
                  {sending ? 'Enviando a Telegram…' : sendError ? 'Reintentar en Telegram' : 'Enviar a Telegram →'}
                </button>
                {sending && <p role="status" className="live-chat-welcome">Esperando confirmación de entrega…</p>}
                {sendError && <div className="live-chat-feedback" role="alert">{sendError}</div>}
              </form>
            </div>
          )}
        </div>
      )}
    </>
  );
}
