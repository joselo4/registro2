import test from 'node:test';
import assert from 'node:assert/strict';
import {renderToStaticMarkup} from 'react-dom/server';
import DessertPreview from '../src/components/DessertPreview.jsx';
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
