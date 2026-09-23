export const enabledOrderChannels = (config = {}) => ({
  Mesa: config?.tableOrdersEnabled !== false,
  Barra: config?.barOrdersEnabled !== false,
  Delivery: config?.deliveryOrdersEnabled !== false,
});

export const isOrderTypeEnabled = (config, orderType) => {
  const channels = enabledOrderChannels(config);
  if (orderType === 'Mesa' || orderType === 'Mesa_Llevar') return channels.Mesa;
  if (orderType === 'Barra' || orderType === 'Llevar') return channels.Barra;
  if (orderType === 'Delivery') return channels.Delivery;
  return false;
};

export const preferredOrderType = (config, tableNumber) => {
  const channels = enabledOrderChannels(config);
  if (tableNumber && channels.Mesa) return 'Mesa';
  if (channels.Delivery) return 'Delivery';
  if (channels.Barra) return 'Barra';
  if (channels.Mesa) return 'Mesa';
  return null;
};
