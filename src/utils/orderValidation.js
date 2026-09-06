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
  if (status === 'Cancelado') return { text: '🛑 Cancelado', color: '#c0392b', step: 'Cancelado' };
  if (status === 'Entregado') return { text: '🎉 Entregado', color: '#27ae60', step: 'Completado' };

  if (isDelivery) {
    switch (status) {
      case 'Por Corroborar': return { text: '⏳ 1/4 Validar Pago', color: '#e67e22', step: 'Paso 1' };
      case 'Pendiente': return { text: '📋 2/4 En Cola', color: '#2980b9', step: 'Paso 2' };
      case 'Preparando': return { text: '👨‍🍳 3/4 Preparando', color: '#8e44ad', step: 'Paso 3' };
      case 'En camino': return { text: '🛵 4/4 En Ruta', color: '#FF441F', step: 'Paso 4' };
      default: return { text: status, color: '#7f8c8d', step: '' };
    }
  } else {
    switch (status) {
      case 'Por Corroborar': return { text: '⏳ 1/3 Validar Pedido', color: '#e67e22', step: 'Paso 1' };
      case 'Pendiente': return { text: '📋 2/3 En Cola', color: '#2980b9', step: 'Paso 2' };
      case 'Preparando': return { text: '👨‍🍳 3/3 Preparando', color: '#8e44ad', step: 'Paso 3' };
      default: return { text: status, color: '#7f8c8d', step: '' };
    }
  }
};
