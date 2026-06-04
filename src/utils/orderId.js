export const generateOrderId = () => {
  const timePart = Date.now().toString(36).toUpperCase();
  const randomPart = Math.random().toString(36).slice(2, 5).toUpperCase();
  return `PED-${timePart}-${randomPart}`;
};
