import { useEffect, useState } from 'react';
import { disablePush, enablePush, getPushStatus, sendTestPush } from '../../utils/pushNotifications';

// Lets each staff phone opt in to alerts that arrive with the screen locked.
export default function PushAlertsToggle() {
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let alive = true;
    getPushStatus().then(next => { if (alive) setStatus(next); }).catch(() => {});
    return () => { alive = false; };
  }, []);

  if (!status?.supported || !status.configured) return null;

  const run = async (action, done) => {
    setBusy(true);
    setMessage('');
    try {
      await action();
      setStatus(await getPushStatus());
      setMessage(done);
    } catch (error) {
      setMessage(error.message || 'No se pudo completar la acción.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`push-toggle${status.subscribed ? ' is-on' : ''}`}>
      {status.subscribed ? (
        <>
          <span className="push-toggle-state"><span aria-hidden="true">●</span> Avisos activos en este teléfono</span>
          <div className="push-toggle-actions">
            <button type="button" disabled={busy} onClick={() => run(sendTestPush, 'Enviamos un aviso de prueba.')}>Probar</button>
            <button type="button" disabled={busy} onClick={() => run(disablePush, 'Avisos desactivados en este teléfono.')}>Desactivar</button>
          </div>
        </>
      ) : (
        <button type="button" className="push-toggle-enable" disabled={busy} onClick={() => run(enablePush, 'Listo: te avisaremos aunque el teléfono esté bloqueado.')}>
          🔔 Activar avisos con pantalla bloqueada
        </button>
      )}
      {message && <small role="status">{message}</small>}
    </div>
  );
}
