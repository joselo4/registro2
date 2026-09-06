export const PAYMENT_METHODS = ['Yape', 'Plin', 'Efectivo', 'Transferencia', 'Tarjeta'];

// Missing configuration preserves the methods offered by previous versions.
export const getEnabledPaymentMethods = config => PAYMENT_METHODS.filter(method => config?.paymentMethods?.[method] !== false);
export const selectPaymentMethod = (selected, methods) => methods.includes(selected) ? selected : methods[0] || '';

// Honor the payment agreed on an existing order, even after disabling it for new orders.
export const getCollectionPaymentMethods = (config, order) => {
  const enabled = getEnabledPaymentMethods(config);
  const agreed = order?.customer?.paymentMethod;
  return PAYMENT_METHODS.filter(method => enabled.includes(method) || method === agreed);
};
