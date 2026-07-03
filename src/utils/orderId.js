export const generateOrderId = () => {
  const timePart = Date.now().toString(36).toUpperCase();
  const randomBytes = new Uint8Array(3);
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(randomBytes);
  } else {
    randomBytes.forEach((_, index) => {
      randomBytes[index] = Math.floor(Math.random() * 256);
    });
  }
  const randomPart = Array.from(randomBytes, byte => byte.toString(36).padStart(2, '0')).join('').toUpperCase();
  return `PED-${timePart}-${randomPart}`;
};
