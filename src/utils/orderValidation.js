/**
 * Validador integral del ingreso de pedidos (Delivery, Mesa, Barra, Llevar).
 * Asegura que todos los datos requeridos por canal estén presentes y sean válidos.
 */
export const validateOrderInput = ({
  name = '',
  phone = '',
  address = '',
  orderType = 'Delivery',
  needsTable = false,
  tableNumber = null,
  cart = [],
  paymentMethod = '',
  occupiedTables = []
}) => {
  const errors = {};

  // 1. Validación del Carrito
  if (!Array.isArray(cart) || cart.length === 0) {
    errors.cart = 'El carrito no tiene productos.';
    return { isValid: false, errors };
  }

  // 2. Validación según Canal: Mesas / Consumo Local
  if (needsTable) {
    if (!tableNumber) {
      errors.table = 'Por favor, selecciona o vincula un número de mesa.';
    } else if (occupiedTables.includes(String(tableNumber))) {
      errors.table = `La Mesa ${tableNumber} ya cuenta con un pedido activo. Debe ser liberada antes de pedir.`;
    }
  }

  // 3. Validación de Nombre (Obligatorio en Delivery, Barra y Llevar)
  const cleanName = (name || '').replace(/<[^>]*>/g, '').trim();
  if (!needsTable) {
    if (!cleanName || cleanName.length < 2) {
      errors.name = 'Por favor ingresa tu nombre completo (mínimo 2 letras).';
    }
  }

  // 4. Validación de Celular / WhatsApp (al menos 9 dígitos numéricos)
  if (!needsTable) {
    const digitsOnly = (phone || '').replace(/\D/g, '');
    if (!digitsOnly || digitsOnly.length < 9) {
      errors.phone = 'Ingresa un número de celular o WhatsApp válido (mínimo 9 dígitos).';
    }
  }

  // 5. Validación de Dirección (Obligatoria para Delivery)
  if (orderType === 'Delivery') {
    const cleanAddress = (address || '').replace(/<[^>]*>/g, '').trim();
    if (!cleanAddress || cleanAddress.length < 5) {
      errors.address = 'Ingresa una dirección de entrega completa (calle, número y referencia).';
    }
  }

  // 6. Validación de Forma de Pago
  if (!paymentMethod) {
    errors.paymentMethod = 'Selecciona una forma de pago válida.';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};

/**
 * Devuelve la información de etapa según el estado actual y si es Delivery o Salón/Mesa
 */
export const getOrderStageInfo = (status, isDelivery = true) => {
  const stages = isDelivery ? ['Por Corroborar', 'Pendiente', 'Preparando', 'Listo', 'En camino', 'Entregado'] : ['Por Corroborar', 'Pendiente', 'Preparando', 'Listo', 'Entregado'];
  const labels = { 'Por Corroborar': 'Validar pedido y pago', Pendiente: 'En cola', Preparando: 'Preparando', Listo: 'Listo para entregar', 'En camino': 'En camino', Entregado: 'Entregado', Cancelado: 'Cancelado' };
  const colors = { 'Por Corroborar': '#b85e00', Pendiente: '#2980b9', Preparando: '#8e44ad', Listo: '#16846b', 'En camino': '#c43c1c', Entregado: '#218c4b', Cancelado: '#c0392b' };
  const index = stages.indexOf(status);
  return { text: index >= 0 ? `${index + 1}/${stages.length} ${labels[status]}` : labels[status] || status, color: colors[status] || '#7f8c8d', step: index >= 0 ? `Paso ${index + 1}` : '' };
};
