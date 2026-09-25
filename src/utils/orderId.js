// Short, easy to say and remember: three letters and three digits, e.g.
// PED-KMR-482. Letters that look like digits (I, L, O) are left out.
const LETTERS = 'ABCDEFGHJKMNPQRSTUVWXYZ';
const DIGITS = '0123456789';

function randomIndex(size) {
  if (!globalThis.crypto?.getRandomValues) throw new Error('Este navegador no permite crear pedidos seguros. Actualízalo e intenta de nuevo.');
  // Rejection sampling keeps every character equally likely.
  const limit = 256 - (256 % size);
  const byte = new Uint8Array(1);
  do globalThis.crypto.getRandomValues(byte); while (byte[0] >= limit);
  return byte[0] % size;
}

export const generateOrderId = () => {
  let letters = '';
  let digits = '';
  for (let i = 0; i < 3; i++) letters += LETTERS[randomIndex(LETTERS.length)];
  for (let i = 0; i < 3; i++) digits += DIGITS[randomIndex(DIGITS.length)];
  return `PED-${letters}-${digits}`;
};

// Accepts what a customer types: "kmr482", "KMR-482", "ped kmr 482" or an
// older long code, and returns the stored order ID.
export const normalizeOrderCode = value => {
  const clean = String(value || '').toUpperCase().replace(/\s+/g, '');
  if (/^(PED|ORD|FIS)-/.test(clean)) return clean;
  const short = clean.replace(/-/g, '');
  if (/^[A-Z]{3}\d{3}$/.test(short)) return `PED-${short.slice(0, 3)}-${short.slice(3)}`;
  return clean.length >= 3 ? `PED-${clean}` : clean;
};
