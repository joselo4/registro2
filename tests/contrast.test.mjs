import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const css=fs.readFileSync(new URL('../src/artisan.css',import.meta.url),'utf8');
const light=css.match(/:root\s*\{([^}]+)\}/)[1];
const dark=css.match(/\[data-theme="dark"\]\s*\{([^}]+)\}/)[1];
const value=(body,name)=>body.match(new RegExp(`${name}:\\s*(#[0-9a-f]{6})`,'i'))?.[1];
const luminance=hex=>hex.slice(1).match(/../g).map(h=>parseInt(h,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
const contrast=(a,b)=>{const [hi,lo]=[luminance(a),luminance(b)].sort((a,b)=>b-a);return (hi+.05)/(lo+.05);};
test('primary, secondary and status text meet 4.5:1 on both theme surfaces',()=>{
  for(const theme of [light,dark]) for(const bg of ['--bg-primary','--bg-secondary']) for(const fg of ['--heading-color','--text-dark','--text-light','--primary-color','--success','--warning','--danger','--info']) {
    const ratio=contrast(value(theme,fg),value(theme,bg));
    assert.ok(ratio>=4.5,`${fg} on ${bg}: ${ratio.toFixed(2)}`);
  }
});
test('hero copy, preview captions and purchase buttons have readable contrast',()=>{
  for(const [fg,bg] of [[value(light,'--heading-color'),'#f1e8dc'],[value(light,'--text-light'),'#f1e8dc'],['#59483b','#eee3d5'],['#ffffff','#a7354b'],['#ffffff','#176b3d']]) assert.ok(contrast(fg,bg)>=4.5);
});
