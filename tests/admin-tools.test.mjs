import test from 'node:test';
import assert from 'node:assert/strict';
import {replenishmentRows,priceForMargin,catalogCSV} from '../src/utils/adminTools.js';
test('replenishment excludes missing counts and retains paused items needing stock',()=>{
 const rows=[{id:'a',stock:null},{id:'b',stock:''},{id:'c',stock:3,lowStockThreshold:4,active:false},{id:'d',stock:15,lowStockThreshold:5}];
 const result=replenishmentRows(rows);assert.equal(result.length,1);assert.equal(result[0].id,'c');assert.equal(result[0].replenish,5);assert.equal(result[0].target,8);assert.equal(rows[2].stock,3);
});
test('margin calculator rounds up to cents and rejects missing or impossible input',()=>{
 assert.equal(priceForMargin(2,60),5);assert.equal(priceForMargin(1,65),2.86);assert.equal(priceForMargin(0,50),0);
 for(const [cost,margin] of [['',50],[null,50],[2,100],[-1,50],[2,-1],[2,''],[Infinity,50]])assert.equal(priceForMargin(cost,margin),null);
});
test('inventory exports distinguish unknown stock from zero and escape formulas',()=>{
 const csv=catalogCSV([{name:'=SUM(1)',category:'Sabores',price:2,cost:1,stock:0},{name:'Fresa',category:'Sabores',price:2}]);
 assert.ok(csv.includes('"\'=SUM(1)"'));assert.ok(csv.includes('"0"'));assert.ok(csv.includes('"Fresa";"Sabores";"Activo";"2";"";"";"";""'));
});
