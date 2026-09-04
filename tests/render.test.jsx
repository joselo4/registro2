import test from 'node:test';
import assert from 'node:assert/strict';
import {renderToStaticMarkup} from 'react-dom/server';
import DessertPreview, {BasePhoto} from '../src/components/DessertPreview.jsx';
import CartItemPreview from '../src/components/CartItemPreview.jsx';
import IceCreamCustomizer from '../src/components/IceCreamCustomizer.jsx';
import OperationsCenter from '../src/components/admin/OperationsCenter.jsx';
test('all 20 container and scoop combinations render with toppings',()=>{
  for(const id of ['cono','cono-artesanal','vaso','waffle']) for(let count=1;count<=5;count++) {
    const html=renderToStaticMarkup(<DessertPreview base={{id,name:id}} scoops={Array.from({length:count},(_,i)=>({id:`fresa${i}`,name:'Fresa'}))} toppings={[{id:'chispas'},{id:'oreo'},{id:'mani'},{id:'gomitas'}]} syrup={{id:'fudge'}} />);
    assert.ok(!html.includes('NaN'));assert.ok(!html.includes('undefined'));
    assert.ok(html.includes('toppings-artisan.png'));assert.ok(html.includes('role="img"'));
  }
});
test('multiple previews do not share SVG filter IDs',()=>{
  const html=renderToStaticMarkup(<><DessertPreview scoops={[{id:'fresa'}]}/><DessertPreview scoops={[{id:'fresa'}]}/></>);
  const ids=[...html.matchAll(/ id="([^"]+)"/g)].map(m=>m[1]);assert.equal(ids.length,new Set(ids).size);
});
test('empty catalog and empty admin queue render useful states',()=>{
  const custom=renderToStaticMarkup(<IceCreamCustomizer onAddToCart={()=>{}} setView={()=>{}} />);
  assert.ok(custom.includes('No hay envases disponibles'));assert.ok(custom.includes('disabled=""'));
  const admin=renderToStaticMarkup(<OperationsCenter onNavigate={()=>{}} />);
  assert.ok(admin.includes('Todo está al día'));assert.ok(admin.includes('Sin base de comparación ayer'));assert.ok(!admin.includes('NaN'));
});
test('cart renders the full saved creation, even when the base has its own uploaded image',()=>{
  const item={type:'custom',base:{id:'waffle',name:'Copa waffle',image:'/old-container-only.png'},scoops:Array.from({length:5},(_,i)=>({id:`flavor-${i}`,name:`Sabor ${i+1}`})),toppings:[{id:'oreo',name:'Oreo'}],syrup:null};
  item.syrup={id:'fudge',name:'Fudge'};
  const html=renderToStaticMarkup(<CartItemPreview item={item}/>);
  assert.equal([...html.matchAll(/href="\/customizer\/gelato-scoop-neutral.png"/g)].length,5);
  assert.ok(html.includes('Oreo'));assert.ok(html.includes('Fudge'));assert.ok(!html.includes('old-container-only'));
  const source=renderToStaticMarkup(<DessertPreview compact {...item}/>);
  assert.equal(html,`<div class="cart-product-preview">${source}</div>`);
});
test('admin and customer container thumbnails use the same photographed asset',()=>{
  for(const id of ['cono','cono-artesanal','vaso','waffle']) {
    const admin=renderToStaticMarkup(<BasePhoto base={{id}} className="admin-base-photo"/>);
    const customer=renderToStaticMarkup(<BasePhoto base={{id}}/>);
    assert.equal(admin.match(/href="([^"]+)"/)[1],customer.match(/href="([^"]+)"/)[1]);
    const creation=renderToStaticMarkup(<DessertPreview base={{id}} scoops={[{id:'fresa'}]}/>);
    assert.ok(creation.includes(admin.match(/href="([^"]+)"/)[1]));
  }
});
