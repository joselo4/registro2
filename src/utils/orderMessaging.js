import { paymentDescription } from './orderLifecycle.js';

export const ORDER_STATUSES = [
  'Por Corroborar',
  'Pendiente',
  'Preparando',
  'Listo',
  'En camino',
  'Entregado',
  'Cancelado',
];

export const DEFAULT_SMS_TEMPLATES = {
  'Por Corroborar': 'Hola {cliente}, recibimos tu pedido {pedido}. Estamos corroborando los datos para enviarlo a preparacion. {tienda}',
  Pendiente: 'Hola {cliente}, tu pedido {pedido} fue confirmado. En breve iniciaremos la preparacion. {tienda}',
  Preparando: 'Hola {cliente}, tu pedido {pedido} ya esta en preparacion. Total: S/. {total}. {tienda}',
  Listo: 'Hola {cliente}, tu pedido {pedido} está listo para entregar. {tienda}',
  'En camino': 'Hola {cliente}, tu pedido {pedido} ya va en camino a {direccion}. {tienda}',
  Entregado: 'Hola {cliente}, tu pedido {pedido} figura como entregado. Gracias por comprar en {tienda}.',
  Cancelado: 'Hola {cliente}, tu pedido {pedido} fue cancelado. Comunicate con {tienda} si necesitas ayuda.',
};

export const normalizeSmsTemplates = (templates = {}) =>
  ORDER_STATUSES.reduce((acc, status) => {
    acc[status] = templates?.[status] || DEFAULT_SMS_TEMPLATES[status];
    return acc;
  }, {});

export const formatOrderStatusMessage = ({ template, order, status, storeName }) => {
  const customer = order?.customer || {};
  const values = {
    cliente: customer.name || 'cliente',
    pedido: order?.id || '',
    estado: status || order?.status || '',
    tienda: storeName || 'la tienda',
    total: Number(order?.grandTotal || 0).toFixed(2),
    direccion: customer.address || customer.tableNumber || 'tu direccion',
    telefono: customer.phone || '',
  };

  return String(template || '')
    .replace(/\{cliente\}/g, values.cliente)
    .replace(/\{pedido\}/g, values.pedido)
    .replace(/\{estado\}/g, values.estado)
    .replace(/\{tienda\}/g, values.tienda)
    .replace(/\{total\}/g, values.total)
    .replace(/\{direccion\}/g, values.direccion)
    .replace(/\{telefono\}/g, values.telefono);
};

export const buildSmsHref = (phone, message) => {
  const cleanPhone = String(phone || '').replace(/\D/g, '');
  if (!cleanPhone) return '';
  return `sms:${cleanPhone}?body=${encodeURIComponent(message || '')}`;
};

export const formatDriverDispatchMessage = ({ order, storeName, driverName }) => {
  const customer = order?.customer || {};
  const address = customer.address || customer.tableNumber || 'No especificada';
  const reference = customer.reference ? ` (Ref: ${customer.reference})` : '';
  const paymentText = order?.paymentVerified
    ? `✅ YA PAGADO (${customer.paymentMethod || 'Digital'})`
    : `💰 COBRAR / VERIFICAR PAGO: S/. ${Number(order?.grandTotal || 0).toFixed(2)} · ${paymentDescription(order)}. Solicita el pago y confirma el cobro antes de marcar Entregado.`;
  
  const itemsText = (order?.items || [])
    .map(item => `  • ${item.quantity || 1}x ${item.name || 'Producto'}`)
    .join('\n');

  const mapsQuery = encodeURIComponent(`${address}, Andahuaylas, Peru`);
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${mapsQuery}`;

  return `🛵 *HOJA DE RUTA / DESPACHO DE REPARTO - ${(storeName || 'FRIOZO').toUpperCase()}*
━━━━━━━━━━━━━━━━━━━
👤 *Repartidor:* ${driverName || 'Asignado'}
📦 *Pedido:* #${order?.id || ''}
👤 *Cliente:* ${customer.name || 'Cliente'}
📞 *Teléfono Cliente:* ${customer.phone || 'No especificado'}
📍 *Dirección:* ${address}${reference}
🗺️ *Ver en Mapa:* ${mapsUrl}
💰 *Pago:* ${paymentText}
📋 *Detalle del Pedido:*
${itemsText || '  • Ver comanda completa'}
━━━━━━━━━━━━━━━━━━━
_¡Buen viaje y conduce con cuidado!_ 🍨`;
};

export const buildWhatsAppHref = (phone, message) => {
  let cleanPhone = String(phone || '').replace(/\D/g, '');
  if (!cleanPhone) return '';
  if (cleanPhone.length === 9 && cleanPhone.startsWith('9')) {
    cleanPhone = `51${cleanPhone}`;
  }
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message || '')}`;
};

