import test from 'node:test';
import assert from 'node:assert/strict';
import {scoopLayout,baseVisual,creationTotal,resolveRecommendation,flavorColor} from '../src/utils/dessert.js';
import {peruDay,operationsSummary,catalogHealth,ordersCSV} from '../src/utils/operations.js';

test('compositions stay inside the stage and connect to each real container opening',()=>{
  for(const id of ['cono','cono-artesanal','vaso','waffle']) {
    const base=baseVisual({id});
    for(let count=1;count<=5;count++) {
      const coords=scoopLayout(count,base.shift);
      assert.equal(coords.length,count);
      for(const c of coords) { assert.ok(c.x-c.r>0 && c.x+c.r<320); assert.ok(c.y-c.r>0 && c.y+c.r<470); }
      assert.ok(coords[0].y+coords[0].r>=base.y);
      assert.ok(coords[0].y<base.lip);
      for(let i=1;i<coords.length;i++) assert.ok(coords.slice(0,i).some(p=>Math.hypot(coords[i].x-p.x,coords[i].y-p.y)<coords[i].r+p.r),'each scoop touches another');
    }
  }
  assert.deepEqual(scoopLayout(0),[]);
});
test('prices use current catalog numbers and never concatenate string prices',()=>{
  assert.equal(creationTotal({price:'1.5'},[{price:'2'},{price:2}],[{price:'.5'}],{price:'.5'}),6.5);
  assert.equal(creationTotal(null,[],[],null),0);
});
test('presets preserve repeated scoops and resolve the old strawberry syrup alias',()=>{
  const rec={baseId:'cono',flavorIds:['fresa','fresa'],toppingIds:['oreo'],syrupId:'fresa'};
  const bases=[{id:'cono',price:0}], flavors=[{id:'fresa',price:2}], toppings=[{id:'oreo',category:'solido',price:1},{id:'fresa_sauce',category:'liquido',price:.75}];
  const resolved=resolveRecommendation(rec,bases,flavors,toppings);
  assert.equal(resolved.scoops.length,2); assert.equal(resolved.price,5.75);
  assert.equal(resolveRecommendation(rec,bases,[{...flavors[0],active:false}],toppings),null);
  assert.equal(resolveRecommendation({...rec,flavorIds:Array(6).fill('fresa')},bases,flavors,toppings),null);
  assert.equal(resolveRecommendation(rec,bases,flavors,[]),null);
});
test('chocolate is brown even when the old catalog color was purple',()=>{
  assert.equal(flavorColor({id:'chocolate',color:'#574b90'}),'#80503b');
});
test('today boundaries use Lima, independent of the server timezone',()=>{
  assert.equal(peruDay('2026-09-05T03:00:00Z'),'2026-09-04');
  assert.equal(peruDay('invalid'),'');
});
test('sales exclude cancelled and pending orders; demand respects quantity and duplicate scoops',()=>{
  const now=Date.parse('2026-09-04T18:00:00Z');
  const orders=[
    {id:'delivered',status:'Entregado',date:'2026-09-04T14:00:00Z',grandTotal:20},
    {id:'yesterday',status:'Entregado',date:'2026-09-03T14:00:00Z',grandTotal:10},
    {id:'cancelled',status:'Cancelado',date:'2026-09-04T16:00:00Z',grandTotal:1000},
    {id:'pending',status:'Pendiente',date:'2026-09-04T17:00:00Z',grandTotal:30,items:[{type:'custom',quantity:3,scoops:[{name:'Fresa'},{name:'Fresa'}]}]},
    {id:'travel',status:'En camino',date:'2026-09-04T17:55:00Z',items:[{type:'custom',quantity:2,scoops:[{name:'Fresa'}]}]}
  ];
  const s=operationsSummary(orders,now);
  assert.equal(s.revenue,20);assert.equal(s.yesterday,10);assert.equal(s.average,20);assert.equal(s.change,100);
  assert.equal(s.queue.length,2);assert.equal(s.overdue.length,1);assert.deepEqual(s.production,[['Fresa',6]]);
});
test('unrecorded stock or cost never becomes zero; depleted stock is flagged',()=>{
  const health=catalogHealth([{key:'flavors',name:'Sabores',items:[{id:'a',active:true,price:5},{id:'b',active:true,price:5,cost:4,stock:0,lowStockThreshold:3},{id:'c',active:false,price:5,cost:5,stock:15}]}]);
  assert.equal(health.measured.length,2);assert.equal(health.lowStock.length,1);assert.equal(health.missingCost.length,1);assert.equal(health.lowMargin.length,1);assert.equal(health.lowMargin[0].margin,20);
});
test('CSV exports quote commas, line breaks and formula-like customer input',()=>{
  const csv=ordersCSV([{id:'A-1',date:'2026-09-04T18:00:00Z',status:'Pendiente',customer:{name:'=HYPERLINK("bad")\nnext'},grandTotal:3}]);
  assert.ok(csv.startsWith('\uFEFF'));assert.ok(csv.includes('"\'=HYPERLINK(""bad"")\nnext"'));assert.ok(csv.includes('"3"'));
});
