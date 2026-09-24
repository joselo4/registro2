export const generateOrderId = () => {
  // Caracteres alfanuméricos legibles (excluye 0, O, 1, I para evitar confusiones al leer o escribir)
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  const randomBytes = new Uint8Array(10);
  if (!globalThis.crypto?.getRandomValues) throw new Error('Este navegador no permite crear pedidos seguros. Actualízalo e intenta de nuevo.');
  globalThis.crypto.getRandomValues(randomBytes);
  let code = '';
  for (let i = 0; i < randomBytes.length; i++) {
    code += chars[randomBytes[i] % chars.length];
  }
  return `PED-${code}`;
};

