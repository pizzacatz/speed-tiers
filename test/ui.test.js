const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {JSDOM, VirtualConsole} = require('jsdom');
const data = require('../data/roster.json');
const {ShareCodec} = require('../src/state');
const html = fs.readFileSync(require.resolve('../speed-tiers.html'),'utf8');
const LS='speedtiers.v1';
async function app(options={}) {
  const errors=[];
  const vc = new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));
  const dom=new JSDOM(html,{url:'https://pizzacatz.github.io/speed-tiers/'+(options.hash||''),runScripts:'dangerously',virtualConsole:vc,beforeParse(w){
    w.ResizeObserver=class{observe(){}};
    w.CSS={escape:globalThis.CSS?.escape || (x=>String(x).replace(/[^a-z0-9_-]/gi,'\\$&'))};
    w.TextEncoder=TextEncoder;w.TextDecoder=TextDecoder;w.CompressionStream=CompressionStream;w.DecompressionStream=DecompressionStream;w.Blob=Blob;
    // jsdom does not implement dialog top-layer behavior; test app event/state wiring here.
    w.HTMLDialogElement.prototype.showModal=function(){this.open=true;this.querySelector('button,input,select')?.focus();};
    w.HTMLDialogElement.prototype.close=function(){this.open=false;};
    w.confirm=()=>true;
    if(options.saved)w.localStorage.setItem(LS,JSON.stringify(options.saved));
    if(options.raw)w.localStorage.setItem(LS,options.raw);
    if(options.blockStorage)w.Storage.prototype.setItem=()=>{throw new Error('quota');};
  }});
  const w=dom.window,d=w.document;
  const q=s=>d.querySelector(s);
  const click=s=>{assert(q(s),s);q(s).click();};
  const input=(s,v)=>{const e=q(s);assert(e,s);e.value=v;e.dispatchEvent(new w.Event('input',{bubbles:true}));};
  const flush=()=>w.dispatchEvent(new w.Event('pagehide'));
  const state=()=>{flush();return JSON.parse(w.localStorage.getItem(LS));};
  return {w,d,q,click,input,flush,state,errors,close:()=>w.close()};
}
test('fresh app renders current roster, pins anchors and targets, and keeps targets fixed',async t=>{
  const a=await app();t.after(a.close);
  assert.equal(a.d.querySelectorAll('tr[data-row]').length,346);assert.equal(a.q('#regulation').textContent,'M-C');
  a.input('#search','Garchomp');
  const row=[...a.d.querySelectorAll('tr[data-row]')].find(r=>r.querySelector('.name').textContent==='Garchomp');
  row.querySelector('[data-act=pin]').click();
  assert(a.q('.acard'));assert.match(a.q('#guide').textContent,/✓/);
  a.input('#search','Swampert-Mega');a.click('[data-w=rain]');a.click('td[data-col=max] button');
  const before=a.q('.tchip b').textContent;
  a.click('[data-w=""]');assert.equal(a.q('.tchip b').textContent,before);
  a.input('.acard [data-k=priority]','-1');assert.match(a.q('[data-tline]').textContent,/higher priority/);
  assert.equal(a.state().targets.length,1);assert.deepEqual(a.errors,[]);
});
test('named setup save, load preview, cancel, restore and share round-trip',async t=>{
  const a=await app();t.after(a.close);
  a.input('#search','Jolteon');a.click('tr[data-row] [data-act=pin]');
  a.click('#btnSetups');a.input('#saveName','Rain team 🌧');a.click('#saveNamed');
  assert.equal(JSON.parse(a.w.localStorage.getItem('speedtiers.setups.v1')).length,1);
  a.click('[data-close]');a.click('#btnTR');
  a.click('#btnSetups');a.click('[data-load]');assert.equal(a.state().field.trickRoom,true);
  a.click('#applySetup');assert.equal(a.state().field.trickRoom,false);
  a.click('#btnSetups');a.click('#restorePrevious');a.click('#applySetup');assert.equal(a.state().field.trickRoom,true);
  a.click('#btnShare');
  for(let i=0;i<50&&!a.q('#shareURL');i++)await new Promise(r=>setTimeout(r,10));
  assert(a.q('#shareURL'),a.q('#notice').textContent);
  const hash=new URL(a.q('#shareURL').value).hash;
  const b=await app({hash});t.after(b.close);
  for(let i=0;i<50&&!b.q('#applySetup');i++)await new Promise(r=>setTimeout(r,10));
  assert(b.q('#applySetup'));assert.equal(b.state().anchors.length,0); // preview never mutates state
  b.click('#applySetup');assert.equal(b.state().name,'Rain team 🌧');assert.equal(b.state().anchors.length,1);assert.equal(b.state().field.trickRoom,true);
  assert.deepEqual(a.errors,[]);assert.deepEqual(b.errors,[]);
});
test('keyboard focus survives row updates and returns after dialog closes',async t=>{
  const a=await app();t.after(a.close);a.input('#search','Garchomp');
  const pin=a.q('tr[data-row] [data-act=pin]');pin.focus();pin.click();assert.equal(a.d.activeElement.dataset.act,'pin');
  const name=a.q('tr[data-row] .name');name.focus();name.click();assert(a.q('dialog[open]'));
  a.input('#ovCtl input[type=number]','10');a.click('[data-close]');assert.equal(a.d.activeElement.dataset.act,'edit');
  assert.deepEqual(a.errors,[]);
});
test('last column remains visible and cannot be deleted',async t=>{
  const a=await app();t.after(a.close);
  for(const id of ['min','base','scarf','tw'])a.click(`.colchip[data-col=${id}] [data-act=eye]`);
  a.click('.colchip[data-col=max] [data-act=eye]');assert.match(a.q('#notice').textContent,/at least one/);
  assert.equal(a.state().columns.filter(c=>c.visible).length,1);
  assert.deepEqual(a.errors,[]);
});
test('malformed shared state and storage failures preserve a usable app',async t=>{
  const code=await ShareCodec.encode({format:'speed-tiers-link',version:1,state:{v:2,rows:[]}});
  const a=await app({hash:'#setup='+code});t.after(a.close);
  for(let i=0;i<50&&!a.q('#notice').textContent;i++)await new Promise(r=>setTimeout(r,10));
  assert.match(a.q('#notice').textContent,/has not changed/);assert.equal(a.state().rows.length,346);
  const b=await app({blockStorage:true});t.after(b.close);b.click('#btnTR');b.flush();assert.match(b.q('#notice').textContent,/storage is unavailable/);assert.equal(b.q('#btnTR').getAttribute('aria-pressed'),'true');
  const c=await app({raw:'{broken'});t.after(c.close);c.flush();assert.equal(c.w.localStorage.getItem(LS+'.recovery'),'{broken');
  assert.deepEqual(a.errors,[]);assert.deepEqual(b.errors,[]);assert.deepEqual(c.errors,[]);
});
test('JSON file import validates first, previews valid files, and permits cancel',async t=>{
  const a=await app();t.after(a.close);a.click('#btnTR');const before=a.state();
  const native=a.d.createElement.bind(a.d);let fileInput;
  a.d.createElement=(tag,...args)=>{const el=native(tag,...args);if(tag==='input'){fileInput=el;el.click=()=>{};}return el;};
  a.click('#btnImport');Object.defineProperty(fileInput,'files',{value:[{size:50,text:async()=>JSON.stringify({v:2,rows:[]})}]});await fileInput.onchange();
  assert.match(a.q('#notice').textContent,/Import rejected/);assert.deepEqual(a.state(),before);
  const incoming=structuredClone(before);incoming.name='Imported setup';incoming.field.trickRoom=false;
  a.click('#btnImport');Object.defineProperty(fileInput,'files',{value:[{size:5000,text:async()=>JSON.stringify(incoming)}]});await fileInput.onchange();
  assert(a.q('#applySetup'));assert.equal(a.state().field.trickRoom,true);a.click('[data-close]');assert.deepEqual(a.state(),before);
  a.click('#btnImport');Object.defineProperty(fileInput,'files',{value:[{size:5000,text:async()=>JSON.stringify(incoming)}]});await fileInput.onchange();a.click('#applySetup');
  assert.equal(a.state().name,'Imported setup');assert.equal(a.state().field.trickRoom,false);
  assert.deepEqual(JSON.parse(a.w.localStorage.getItem(LS+'.previous')),before);assert.deepEqual(a.errors,[]);
});
test('hover comparisons reserve space and remain readable after leaving the table',async t=>{
  const a=await app();t.after(a.close);
  a.input('#search','Garchomp');a.click('tr[data-row] [data-act=pin]');
  const pane=a.q('[data-hov]');
  const height=a.w.getComputedStyle(pane).height;
  assert.notEqual(height,'auto');assert.notEqual(height,'');
  assert.equal(a.w.getComputedStyle(pane).overflow,'auto');
  assert.equal(a.w.getComputedStyle(a.q('.acard')).flexShrink,'0');
  assert.match(pane.textContent,/Hover or focus/);
  a.input('#search','Jolteon');
  a.q('tr[data-row] .name').dispatchEvent(new a.w.MouseEvent('mouseover',{bubbles:true}));
  const result=pane.textContent;
  assert.match(result,/Jolteon/);assert.match(result,/compare/);
  assert.equal(a.w.getComputedStyle(pane).height,height);
  pane.scrollTop=20;
  a.q('tr[data-row] td.cell').dispatchEvent(new a.w.MouseEvent('mouseover',{bubbles:true}));
  assert.equal(pane.scrollTop,20); // moving within one row does not redraw the comparison
  a.q('#tbl').dispatchEvent(new a.w.MouseEvent('mouseleave'));
  a.q('th').dispatchEvent(new a.w.MouseEvent('mouseover',{bubbles:true}));
  pane.focus();
  assert.equal(pane.textContent,result);assert.equal(pane.scrollTop,20);
  a.input('#search','Lucario');a.q('tr[data-row] .name').focus();
  assert.match(pane.textContent,/Lucario/);assert.equal(pane.scrollTop,0);
  assert.equal(a.w.getComputedStyle(pane).height,height);
  assert.deepEqual(a.errors,[]);
});
