import DessertPreview from './DessertPreview';
import { preferWebp } from '../utils/imageUrl';
import PackIllustration from './PackIllustration';

export default function CartItemPreview({ item, literConfig }) {
  if (item.type === 'custom') {
    return <div className="cart-product-preview"><DessertPreview compact base={item.base} scoops={item.scoops || []} toppings={item.toppings || []} syrup={item.syrup || null} /></div>;
  }
  const src = preferWebp(item.type === 'liter' ? item.image || literConfig?.image : item.image);
  if (src) return <div className="cart-product-preview"><img src={src} alt={item.name || 'Producto'} /></div>;
  // Packs without a photo use the same drawing as the catalog, so every pack in the order shows.
  if (item.type === 'pack') return <div className="cart-product-preview cart-product-preview-art"><PackIllustration pack={item} /></div>;
  return <div className="cart-product-preview"><span aria-hidden="true">{item.type === 'liter' ? '🏺' : item.type === 'popsicle' ? '🍭' : item.type === 'extra' ? (item.icon || '🧁') : '🎁'}</span></div>;
}
