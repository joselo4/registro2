import DessertPreview from './DessertPreview';

export default function CartItemPreview({ item, literConfig }) {
  if (item.type === 'custom') {
    return <div className="cart-product-preview"><DessertPreview compact base={item.base} scoops={item.scoops || []} toppings={item.toppings || []} syrup={item.syrup || null} /></div>;
  }
  const src = item.type === 'liter' ? item.image || literConfig?.image : item.image;
  return <div className="cart-product-preview">{src ? <img src={src} alt={item.name || 'Producto'} /> : <span aria-hidden="true">{item.type === 'liter' ? '🏺' : item.type === 'popsicle' ? '🍭' : '🎁'}</span>}</div>;
}
