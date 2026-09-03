export const generateOrderId = () => {
  // Caracteres alfanuméricos legibles (excluye 0, O, 1, I para evitar confusiones al leer o escribir)
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  const randomBytes = new Uint8Array(5);
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(randomBytes);
  } else {
    for (let i = 0; i < 5; i++) {
      randomBytes[i] = Math.floor(Math.random() * 256);
    }
  }
  let code = '';
  for (let i = 0; i < 5; i++) {
    code += chars[randomBytes[i] % chars.length];
  }
  return `PED-${code}`;
};

