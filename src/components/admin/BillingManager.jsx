import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../utils/supabaseClient';
import { updateSyncedData } from '../../utils/supabaseSync';

const DEFAULT_CONFIG = {
  enabled: false,
  provider: 'nubefact',
  ruc: '',
  businessName: '',
  businessAddress: '',
  igvPercent: 18,
  taxIncluded: true,
  defaultDocumentType: 'boleta',
  boletaSeries: 'B001',
  facturaSeries: 'F001',
  nextBoletaNumber: 1,
  nextFacturaNumber: 1,
  autoSendSunat: true,
};

const withoutSecrets = (config) => {
  const safeConfig = { ...(config || {}) };
  delete safeConfig.endpoint;
  delete safeConfig.token;
  return safeConfig;
};

const cleanText = (value, max = 180) => String(value || '').replace(/<[^>]*>/g, '').trim().slice(0, max);
const onlyDigits = (value, max = 20) => String(value || '').replace(/\D/g, '').slice(0, max);
const money = (value) => Math.round((Number(value) || 0) * 100) / 100;
const formatDatePE = (value) => {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return new Date().toLocaleDateString('es-PE').replace(/\//g, '-');
  return date.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-');
};

const getCustomerDoc = (order, documentType) => {
  const savedDocType = order.customer?.documentType || order.customer?.tipoDocumento;
  const savedDocNumber = onlyDigits(order.customer?.documentNumber || order.customer?.numeroDocumento, 11);
  if (savedDocNumber) {
    return {
      type: savedDocType || (savedDocNumber.length === 11 ? '6' : savedDocNumber.length === 8 ? '1' : '-'),
      number: savedDocNumber,
    };
  }
  const phone = onlyDigits(order.customer?.phone, 11);
  if (documentType === 'factura') return { type: '6', number: '' };
  if (phone.length === 8) return { type: '1', number: phone };
  return { type: '-', number: '' };
};

const orderItemsToBillingItems = (order, config) => {
  const igvPercent = Number(config.igvPercent || 18);
  const factor = 1 + (igvPercent / 100);
  return (order.items || []).map((item, index) => {
    const quantity = Math.max(1, Number(item.quantity || 1));
    const total = money(Number(item.price || 0) * quantity);
    const unitPrice = money(Number(item.price || 0));
    const taxable = config.taxIncluded ? money(total / factor) : total;
    const igv = config.taxIncluded ? money(total - taxable) : money(total * (igvPercent / 100));
    const subtotal = taxable;
    const finalTotal = config.taxIncluded ? total : money(total + igv);

    return {
      unidad_de_medida: 'NIU',
      codigo: cleanText(item.id || item.type || `ITEM-${index + 1}`, 30),
      descripcion: cleanText(item.name || item.items || 'Producto de heladeria', 240),
      cantidad: quantity,
      valor_unitario: money(subtotal / quantity),
      precio_unitario: config.taxIncluded ? unitPrice : money(unitPrice * factor),
      descuento: '',
      subtotal,
      tipo_de_igv: 1,
      igv,
      total: finalTotal,
      anticipo_regularizacion: false,
      anticipo_documento_serie: '',
      anticipo_documento_numero: '',
    };
  });
};

const buildNubefactPayload = ({ order, config, documentType, series, number }) => {
  const items = orderItemsToBillingItems(order, config);
  const total = money(items.reduce((sum, item) => sum + item.total, 0));
  const totalIgv = money(items.reduce((sum, item) => sum + item.igv, 0));
  const totalGravada = money(items.reduce((sum, item) => sum + item.subtotal, 0));
  const customerDoc = getCustomerDoc(order, documentType);

  return {
    operacion: 'generar_comprobante',
    tipo_de_comprobante: documentType === 'factura' ? 1 : 2,
    serie: series,
    numero: number,
    sunat_transaction: 1,
    cliente_tipo_de_documento: customerDoc.type,
    cliente_numero_de_documento: customerDoc.number,
    cliente_denominacion: cleanText(order.customer?.name || 'Cliente', 180),
    cliente_direccion: cleanText(order.customer?.address || '-', 240),
    cliente_email: '',
    fecha_de_emision: formatDatePE(order.date),
    fecha_de_vencimiento: '',
    moneda: 1,
    tipo_de_cambio: '',
    porcentaje_de_igv: Number(config.igvPercent || 18),
    descuento_global: '',
    total_descuento: '',
    total_anticipo: '',
    total_gravada: totalGravada,
    total_inafecta: '',
    total_exonerada: '',
    total_igv: totalIgv,
    total_gratuita: '',
    total_otros_cargos: '',
    total,
    percepcion_tipo: '',
    percepcion_base_imponible: '',
    total_percepcion: '',
    total_incluido_percepcion: '',
    detraccion: false,
    observaciones: cleanText(`Pedido ${order.id}`, 200),
    documento_que_se_modifica_tipo: '',
    documento_que_se_modifica_serie: '',
    documento_que_se_modifica_numero: '',
    tipo_de_nota_de_credito: '',
    tipo_de_nota_de_debito: '',
    enviar_automaticamente_a_la_sunat: config.autoSendSunat !== false,
    enviar_automaticamente_al_cliente: false,
    codigo_unico: cleanText(order.id, 80),
    condiciones_de_pago: '',
    medio_de_pago: cleanText(order.customer?.paymentMethod || 'Efectivo', 80),
    placa_vehiculo: '',
    orden_compra_servicio: '',
    formato_de_pdf: '',
    items,
  };
};

export default function BillingManager({
  orders,
  onUpdateOrders,
  billingConfig,
  onUpdateBillingConfig,
  addLog,
  currentUser,
  showAlert,
}) {
  const [localConfig, setLocalConfig] = useState({ ...DEFAULT_CONFIG, ...withoutSecrets(billingConfig) });
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [documentType, setDocumentType] = useState(localConfig.defaultDocumentType || 'boleta');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastResponse, setLastResponse] = useState(null);

  useEffect(() => {
    setLocalConfig({ ...DEFAULT_CONFIG, ...withoutSecrets(billingConfig) });
  }, [billingConfig]);

  const alert = (title, message, type = 'info') => {
    if (showAlert) showAlert(title, message, type);
    else window.alert(`${title}: ${message}`);
  };

  const billableOrders = useMemo(() => {
    return (orders || [])
      .filter(order => order.status !== 'Cancelado')
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [orders]);

  const selectedOrder = billableOrders.find(order => order.id === selectedOrderId) || billableOrders[0] || null;
  const currentSeries = documentType === 'factura' ? localConfig.facturaSeries : localConfig.boletaSeries;
  const currentNumber = documentType === 'factura' ? Number(localConfig.nextFacturaNumber || 1) : Number(localConfig.nextBoletaNumber || 1);

  const updateConfigField = (field, value) => {
    setLocalConfig(prev => ({ ...prev, [field]: value }));
  };

  const saveConfig = () => {
    const nextConfig = {
      ...localConfig,
      ruc: onlyDigits(localConfig.ruc, 11),
      businessName: cleanText(localConfig.businessName, 180),
      businessAddress: cleanText(localConfig.businessAddress, 240),
      igvPercent: Number(localConfig.igvPercent || 18),
      nextBoletaNumber: Math.max(1, Number(localConfig.nextBoletaNumber || 1)),
      nextFacturaNumber: Math.max(1, Number(localConfig.nextFacturaNumber || 1)),
    };
    onUpdateBillingConfig(nextConfig);
    alert('Configuracion guardada', 'La integracion de facturacion quedo actualizada.', 'success');
    addLog?.(`Configuracion de facturacion actualizada por ${currentUser?.name || 'administrador'}.`);
  };

  const emitDocument = async () => {
    if (!selectedOrder) {
      alert('Sin pedido', 'Selecciona un pedido para emitir el comprobante.', 'warning');
      return;
    }
    if (documentType === 'factura') {
      const customerDoc = getCustomerDoc(selectedOrder, documentType);
      if (customerDoc.type !== '6' || customerDoc.number.length !== 11) {
        alert('RUC requerido', 'Para factura necesitas registrar el RUC del cliente en el pedido o editarlo antes de emitir.', 'warning');
        return;
      }
    }

    setIsSubmitting(true);
    setLastResponse(null);
    try {
      const session = supabase ? (await supabase.auth.getSession()).data?.session : null;
      const payload = buildNubefactPayload({
        order: selectedOrder,
        config: localConfig,
        documentType,
        series: currentSeries,
        number: currentNumber,
      });

      const response = await fetch('/api/billing', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({
          provider: localConfig.provider || 'nubefact',
          payload,
        }),
      });
      const result = await response.json().catch(() => ({}));
      setLastResponse(result);

      if (!response.ok || !result.ok) {
        const message = result?.error || result?.result?.errors || 'No se pudo emitir el comprobante.';
        alert('Facturacion rechazada', typeof message === 'string' ? message : JSON.stringify(message), 'error');
        return;
      }

      const billingInfo = {
        provider: localConfig.provider || 'nubefact',
        documentType,
        series: currentSeries,
        number: currentNumber,
        emittedAt: new Date().toISOString(),
        status: 'Emitido',
        response: result.result,
        links: {
          pdf: result.result?.enlace_del_pdf || result.result?.enlace || '',
          xml: result.result?.enlace_del_xml || '',
          cdr: result.result?.enlace_del_cdr || '',
        },
      };

      const updatedOrder = { ...selectedOrder, billing: billingInfo };
      const nextOrders = orders.map(order => order.id === selectedOrder.id ? updatedOrder : order);
      onUpdateOrders(nextOrders);
      await updateSyncedData(`order_${selectedOrder.id}`, updatedOrder);

      const nextConfig = {
        ...localConfig,
        nextBoletaNumber: documentType === 'boleta' ? currentNumber + 1 : localConfig.nextBoletaNumber,
        nextFacturaNumber: documentType === 'factura' ? currentNumber + 1 : localConfig.nextFacturaNumber,
      };
      setLocalConfig(nextConfig);
      onUpdateBillingConfig(nextConfig);

      alert('Comprobante emitido', `${documentType === 'factura' ? 'Factura' : 'Boleta'} ${currentSeries}-${currentNumber} registrada.`, 'success');
      addLog?.(`Comprobante ${currentSeries}-${currentNumber} emitido para pedido ${selectedOrder.id}.`);
    } catch (err) {
      alert('Error de facturacion', err.message || 'No se pudo conectar con el proveedor.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="glass" style={{ padding: '24px' }}>
      <h2 style={{ fontSize: '1.7rem', marginBottom: '8px' }}>Facturacion electronica</h2>
      <p style={{ color: 'var(--text-light)', marginBottom: '18px', lineHeight: 1.5 }}>
        Integracion compatible con proveedores API REST tipo Nubefact. Las credenciales se leen desde el servidor para mantener el token fuera del navegador.
      </p>

      <div className="glass-card" style={{ padding: '18px', marginBottom: '18px' }}>
        <h3 style={{ fontSize: '1.1rem', marginBottom: '12px' }}>Configuracion del proveedor</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
          <label className="form-group">
            <span>Proveedor</span>
            <select className="form-control" value={localConfig.provider} onChange={(e) => updateConfigField('provider', e.target.value)}>
              <option value="nubefact">Nubefact / JSON compatible</option>
            </select>
          </label>
          <label className="form-group">
            <span>RUC emisor</span>
            <input className="form-control" value={localConfig.ruc || ''} onChange={(e) => updateConfigField('ruc', e.target.value)} placeholder="20123456789" />
          </label>
          <label className="form-group">
            <span>Razon social</span>
            <input className="form-control" value={localConfig.businessName || ''} onChange={(e) => updateConfigField('businessName', e.target.value)} placeholder="FRIOSO S.A.C." />
          </label>
          <label className="form-group">
            <span>Direccion fiscal</span>
            <input className="form-control" value={localConfig.businessAddress || ''} onChange={(e) => updateConfigField('businessAddress', e.target.value)} placeholder="Direccion del local" />
          </label>
          <div className="form-group" style={{ gridColumn: '1 / -1', padding: '12px', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', background: 'rgba(255,255,255,0.7)' }}>
            <span>Credenciales del proveedor</span>
            <p style={{ margin: '6px 0 0', color: 'var(--text-light)', fontSize: '0.9rem', lineHeight: 1.45 }}>
              Configura en el servidor las variables NUBEFACT_ENDPOINT y NUBEFACT_TOKEN. El panel nunca guarda el token.
            </p>
          </div>
          <label className="form-group">
            <span>Serie boleta</span>
            <input className="form-control" value={localConfig.boletaSeries || 'B001'} onChange={(e) => updateConfigField('boletaSeries', e.target.value.toUpperCase())} />
          </label>
          <label className="form-group">
            <span>Siguiente boleta</span>
            <input className="form-control" type="number" min="1" value={localConfig.nextBoletaNumber || 1} onChange={(e) => updateConfigField('nextBoletaNumber', e.target.value)} />
          </label>
          <label className="form-group">
            <span>Serie factura</span>
            <input className="form-control" value={localConfig.facturaSeries || 'F001'} onChange={(e) => updateConfigField('facturaSeries', e.target.value.toUpperCase())} />
          </label>
          <label className="form-group">
            <span>Siguiente factura</span>
            <input className="form-control" type="number" min="1" value={localConfig.nextFacturaNumber || 1} onChange={(e) => updateConfigField('nextFacturaNumber', e.target.value)} />
          </label>
          <label className="form-group">
            <span>IGV %</span>
            <input className="form-control" type="number" min="0" step="0.01" value={localConfig.igvPercent || 18} onChange={(e) => updateConfigField('igvPercent', e.target.value)} />
          </label>
          <label className="form-group">
            <span>Tipo por defecto</span>
            <select className="form-control" value={localConfig.defaultDocumentType || 'boleta'} onChange={(e) => { updateConfigField('defaultDocumentType', e.target.value); setDocumentType(e.target.value); }}>
              <option value="boleta">Boleta</option>
              <option value="factura">Factura</option>
            </select>
          </label>
        </div>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '14px' }}>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontWeight: 700 }}>
            <input type="checkbox" checked={localConfig.taxIncluded !== false} onChange={(e) => updateConfigField('taxIncluded', e.target.checked)} />
            Precios incluyen IGV
          </label>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontWeight: 700 }}>
            <input type="checkbox" checked={localConfig.autoSendSunat !== false} onChange={(e) => updateConfigField('autoSendSunat', e.target.checked)} />
            Enviar automaticamente a SUNAT
          </label>
        </div>
        <button className="btn btn-primary" style={{ marginTop: '14px' }} onClick={saveConfig}>Guardar configuracion</button>
      </div>

      <div className="glass-card" style={{ padding: '18px' }}>
        <h3 style={{ fontSize: '1.1rem', marginBottom: '12px' }}>Emitir desde pedido</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', alignItems: 'end' }}>
          <label className="form-group">
            <span>Pedido</span>
            <select className="form-control" value={selectedOrder?.id || ''} onChange={(e) => setSelectedOrderId(e.target.value)}>
              {billableOrders.map(order => (
                <option key={order.id} value={order.id}>
                  {order.id} - {order.customer?.name || 'Cliente'} - S/. {Number(order.grandTotal || 0).toFixed(2)} {order.billing?.status ? '(emitido)' : ''}
                </option>
              ))}
            </select>
          </label>
          <label className="form-group">
            <span>Comprobante</span>
            <select className="form-control" value={documentType} onChange={(e) => setDocumentType(e.target.value)}>
              <option value="boleta">Boleta</option>
              <option value="factura">Factura</option>
            </select>
          </label>
          <div>
            <span style={{ display: 'block', color: 'var(--text-light)', fontSize: '0.8rem', marginBottom: '6px' }}>Numero a emitir</span>
            <strong>{currentSeries}-{currentNumber}</strong>
          </div>
        </div>

        {selectedOrder && (
          <div style={{ marginTop: '12px', padding: '12px', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', background: 'rgba(255,255,255,0.65)' }}>
            <strong>{selectedOrder.customer?.name || 'Cliente'}</strong>
            <div style={{ color: 'var(--text-light)', fontSize: '0.85rem', marginTop: '4px' }}>
              Total: S/. {Number(selectedOrder.grandTotal || 0).toFixed(2)} - Pago: {selectedOrder.customer?.paymentMethod || 'No indicado'}
            </div>
            {selectedOrder.billing?.status && (
              <div style={{ color: 'var(--success)', fontSize: '0.85rem', marginTop: '6px', fontWeight: 700 }}>
                Ya emitido: {selectedOrder.billing.series}-{selectedOrder.billing.number}
              </div>
            )}
          </div>
        )}

        <button className="btn btn-primary" style={{ marginTop: '14px' }} onClick={emitDocument} disabled={isSubmitting || !selectedOrder}>
          {isSubmitting ? 'Emitiendo...' : 'Emitir comprobante'}
        </button>

        {lastResponse && (
          <details style={{ marginTop: '14px' }}>
            <summary style={{ cursor: 'pointer', fontWeight: 700 }}>Respuesta del proveedor</summary>
            <pre style={{ marginTop: '8px', whiteSpace: 'pre-wrap', background: '#fff', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.75rem', maxHeight: '260px', overflow: 'auto' }}>
              {JSON.stringify(lastResponse, null, 2)}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
}
