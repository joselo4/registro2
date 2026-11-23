import DessertPreview from './DessertPreview';
import { preferWebp } from '../utils/imageUrl';
import PackPhoto, { LiterPhoto } from './PackPhoto';
import Icon from './Icon';

export default function CartItemPreview({ item, literConfig }) {
  if (item.type === 'custom') {
    return <div className="cart-product-preview"><DessertPreview compact base={item.base} scoops={item.scoops || []} toppings={item.toppings || []} syrup={item.syrup || null} /></div>;
  }
  const src = preferWebp(item.type === 'liter' ? item.image || literConfig?.image : item.image);
  if (src) return <div className="cart-product-preview"><img src={src} alt={item.name || 'Producto'} /></div>;
  // Packs without a photo use the same photographed composition as the catalog.
  if (item.type === 'liter') return <div className="cart-product-preview cart-product-preview-art"><LiterPhoto /></div>;
  if (item.type === 'pack') return <div className="cart-product-preview cart-product-preview-art"><PackPhoto pack={item} /></div>;
  return <div className="cart-product-preview cart-product-preview-icon"><Icon name={item.type === 'popsicle' ? 'popsicle' : item.type === 'extra' ? 'sparkle' : 'gift'} size={30} /></div>;
}
