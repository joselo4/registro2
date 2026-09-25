import { quickScoopItem } from './dessert.js';

const activePriced = list => (Array.isArray(list) ? list : [])
  .filter(item => item && item.active !== false && Number.isFinite(Number(item.price)) && Number(item.price) > 0);

/**
 * Picks the pack to suggest in the cart. While delivery is not free yet it
 * prefers the cheapest pack that unlocks free delivery; otherwise it rotates
 * through the packs so the suggestion varies with the cart.
 */
export function suggestPack({ packs = [], cart = [], missingForFreeDelivery = 0, preferredId = null }) {
  const inCart = new Set(cart.map(item => String(item.id)));
  const candidates = activePriced(packs).filter(pack => !inCart.has(String(pack.id)));
  if (!candidates.length) return null;
  if (missingForFreeDelivery > 0) {
    const unlocking = candidates.filter(pack => Number(pack.price) >= missingForFreeDelivery)
      .sort((a, b) => Number(a.price) - Number(b.price));
    if (unlocking.length) return { pack: unlocking[0], unlocksFreeDelivery: true };
    const biggest = [...candidates].sort((a, b) => Number(b.price) - Number(a.price))[0];
    return { pack: biggest, unlocksFreeDelivery: false };
  }
  const units = cart.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
  const preferred = candidates.find(pack => String(pack.id) === String(preferredId));
  const ordered = preferred ? [preferred, ...candidates.filter(pack => pack !== preferred)] : candidates;
  return { pack: ordered[units % ordered.length], unlocksFreeDelivery: false };
}

/**
 * The smallest single product that completes the free-delivery minimum:
 * a one-scoop helado or a popsicle.
 */
export function suggestFreeDeliveryCloser({ flavors = [], bases = [], popsicles = [], missingForFreeDelivery = 0 }) {
  if (!(missingForFreeDelivery > 0)) return null;
  const options = [
    ...activePriced(flavors).map(flavor => ({ item: quickScoopItem(flavor, bases), label: flavor.name })),
    ...activePriced(popsicles).map(popsicle => ({ item: { type: 'popsicle', id: popsicle.id, name: popsicle.name, price: Number(popsicle.price), image: popsicle.image || '', quantity: 1 }, label: `Paleta ${popsicle.name}` })),
  ].filter(option => option.item.price >= missingForFreeDelivery - 0.001)
    .sort((a, b) => a.item.price - b.item.price);
  return options[0] || null;
}
