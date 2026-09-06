import { useState } from 'react';
import { PAYMENT_METHODS, getEnabledPaymentMethods } from '../../utils/paymentMethods';

export default function PaymentMethodsSettings({ value = {}, onChange, onSave }) {
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const save = async () => {
    setSaving(true);
    setMessage('');
    try {
      await onSave();
      setMessage('Métodos de pago guardados.');
    } catch {
      setMessage('No se pudieron guardar los métodos. Revisa tu conexión e inténtalo nuevamente.');
    } finally { setSaving(false); }
  };
  return <section className="glass" style={{ padding: '20px', marginBottom: '16px' }} aria-labelledby="payment-methods-title">
    <h3 id="payment-methods-title">Métodos de pago</h3>
    <p>Activa los métodos disponibles para pedidos nuevos y cobros. Los pedidos existentes conservan el método acordado.</p>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', margin: '16px 0' }}>
      {PAYMENT_METHODS.map(method => <label key={method} style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '1rem' }}>
        <input type="checkbox" checked={value[method] !== false} disabled={saving} onChange={event => { onChange({ ...value, [method]: event.target.checked }); setMessage(''); }} />
        {method}
      </label>)}
    </div>
    <p>Tarjeta: cobro presencial con POS al recibir el pedido.</p>
    {!getEnabledPaymentMethods({ paymentMethods: value }).length && <p role="alert">Todos los métodos están desactivados. No se podrán confirmar pedidos nuevos.</p>}
    <button type="button" className="btn btn-primary" disabled={saving} onClick={save}>{saving ? 'Guardando…' : 'Guardar métodos de pago'}</button>
    {message && <p role="status">{message}</p>}
  </section>;
}
