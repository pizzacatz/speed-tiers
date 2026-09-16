const {test} = require('node:test');
const assert = require('node:assert/strict');
const E = require('../src/engine');
const State = require('../src/state');
const data = require('../data/roster.json');
const vectors = require('./mcp-vectors.json');
const entities = new Map(data.entities.map(e => [e.id, e]));
const field = {weather:null, eterrain:false, tailwind:{A:false,B:false}};
function fixture() {
  return {v:2, name:'Rain team 🌧', catalogue:data.entities.map(e => e.id), dataRevision:data.meta.dataRevision,
    field:{...field, trickRoom:false}, global:{}, columns:[{id:'max',label:'Max',spec:{sp:32,align:1},visible:true}],
    sortCol:'max', tags:[{id:'team',name:'My Team',color:'#123456',defaults:{side:'A'}}],
    rows:[{id:'one',ent:'garchomp',tags:['team'],ov:{sp:12}}],
    anchors:[{id:'anchor',rowId:'one',spec:{sp:12},color:'#123456',collapsed:false}],
    targets:[{id:'target',ent:'lucariomegaz',rowId:null,colId:null,label:'Target',spec:{sp:32,align:1,abil:'off',tailwind:false}}],
    filters:{search:'',tags:[],mode:'any',onlyTagged:false,megas:true},theme:'auto',colWidths:{},guideDismissed:false};
}
for (const c of vectors.cases) test('MCP conformance: ' + c.name, () => {
  const calc = (set, app = {}) => {
    const align = data.alignments.find(a => a.alignment === (set.alignment || 'Serious'));
    let spec = E.merge({sp:set.sp?.spe || 0, align:align.raises==='spe' ? 1 : align.lowers==='spe' ? -1 : 0,
      stage:set.stage || 0, item:set.scarf ? 'scarf' : 'none', tailwind:!!set.tailwind, para:!!set.paralyzed, priority:set.priority || 0, abil:'off'}, app);
    if (set.speed_mult === 2) spec.abil = 'swift-swim';
    return E.compute(entities.get(set.species), spec, field, data.abilities);
  };
  const a = calc(c.a, c.appA), b = calc(c.b, c.appB);
  assert.equal(a.speed,c.expected.a_speed); assert.equal(b.speed,c.expected.b_speed);
  const r=E.relation(a,b,!!c.field.trick_room);
  assert.equal(r==='faster'?'a':r==='slower'?'b':'tie',c.expected.first);
});
test('solver cannot recommend Speed changes to beat higher priority', () => {
  for (const tr of [true,false]) {
    const s=E.solve(entities.get('garchomp'),E.merge({sp:32,align:1}),field,data.abilities,{speed:20,priority:1},tr);
    assert.equal(s.length,1); assert.equal(s[0].blocked,true); assert.doesNotMatch(s[0].label,/already/);
    assert.equal(E.solve(entities.get('garchomp'),E.merge({priority:1}),field,data.abilities,{speed:500,priority:0},tr)[0].ok,true);
  }
});
test('solver finds a strict one-point threshold in both orders', () => {
  assert.match(E.solve(entities.get('garchomp'),E.merge(),field,data.abilities,{speed:130,priority:0},false)[0].label,/SP ≥ 9 \(131\)/);
  assert.match(E.solve(entities.get('garchomp'),E.merge({sp:32}),field,data.abilities,{speed:130,priority:0},true)[0].label,/SP ≤ 7 \(129\)/);
  const labels=E.solve(entities.get('garchomp'),E.merge({stage:-3}),field,data.abilities,{speed:49,priority:0},false).map(x=>x.label);
  assert(labels.some(x=>x.startsWith('Stage -2'))); assert(!labels.some(x=>x.includes('+-')));
});
test('Mega Stones exclude Scarf and Iron Ball modifiers and suggestions', () => {
  const e=entities.get('garchompmegaz');
  assert.equal(E.compute(e,E.merge({sp:32,align:1,item:'scarf'}),field,data.abilities).speed,223);
  assert(!E.solve(e,E.merge(),field,data.abilities,{speed:180,priority:0},false).some(x=>x.label.includes('Choice Scarf')));
});
test('Quick Feet auto activates on paralysis and suppresses its penalty', () => {
  const e=entities.get('jolteon');
  assert.equal(E.compute(e,E.merge({para:true,sp:32,align:1}),field,data.abilities).speed,300);
  assert.equal(E.compute(e,E.merge({para:true,sp:32,align:1,abil:'off'}),field,data.abilities).speed,100);
});
test('legacy migration preserves customizations and adds only newly available forms', () => {
  const input=fixture(); input.v=1; delete input.catalogue; input.rows[0].ov.item='powder';
  const before=JSON.stringify(input), {state,warnings}=State.normalize(input,data);
  assert.equal(JSON.stringify(input),before);
  assert.equal(state.v,2); assert.equal(state.rows[0].ov.sp,12); assert.equal(state.rows[0].ov.item,'none');
  assert(state.rows.some(r=>r.ent==='garchompmegaz'));
  assert(!state.rows.some(r=>r.ent==='charizard')); // A deleted old row must stay deleted.
  assert(warnings.some(w=>w.includes('Quick Powder')));
  assert.deepEqual(State.normalize(state,data).state,state);
});
test('full old catalogue migrates from 311 to 346 rows', () => {
  const input=fixture();input.v=1;delete input.catalogue;input.anchors=[];
  input.rows=data.previousEntities.map((ent,i)=>({id:'r'+i,ent,tags:[],ov:{}}));
  const {state}=State.normalize(input,data);
  assert.equal(state.rows.length,346);
});
for (const [name,mutate] of [
  ['empty columns',s=>s.columns=[]], ['missing field',s=>delete s.field],
  ['SP out of range',s=>s.rows[0].ov.sp=999], ['stage out of range',s=>s.global.stage=7],
  ['invalid boolean',s=>s.field.trickRoom='false'], ['invalid item',s=>s.global.item='powder'],
  ['attribute injection',s=>s.rows[0].id='one" onclick="alert(1)'],
  ['style injection',s=>s.tags[0].color='red;position:fixed'],
  ['duplicate ids',s=>s.rows.push({...s.rows[0]})], ['dangling anchor',s=>s.anchors[0].rowId='missing'],
  ['unknown tag',s=>s.rows[0].tags=['missing']], ['prototype key',s=>s.columns[0].id='__proto__'],
  ['unbounded width',s=>s.colWidths.max=999999], ['unbounded anchors',s=>s.anchors=Array(33).fill(s.anchors[0])]
]) test('rejects ' + name + ' without mutating input', () => {
  const input=fixture();mutate(input);const before=JSON.stringify(input);
  assert.throws(()=>State.normalize(input,data));assert.equal(JSON.stringify(input),before);
});
test('hidden/missing sort and stale targets are repaired', () => {
  const input=fixture();input.sortCol='gone';input.columns[0].visible=false;input.targets[0].rowId='gone';
  const {state}=State.normalize(input,data);assert.equal(state.sortCol,'max');assert.equal(state.columns[0].visible,true);assert.equal(state.targets[0].rowId,null);
});
test('compressed link round-trip preserves every setting and Unicode', async () => {
  const original=State.normalize(fixture(),data).state;
  const code=await State.ShareCodec.encode(State.pack(original));
  const restored=State.unpack(await State.ShareCodec.decode(code),data).state;
  assert.deepEqual(restored,original);assert(code.startsWith('gz.'));
});
test('corrupt, oversized, and decompression-bomb links are rejected', async () => {
  for (const code of ['garbage','gz.%%%%','gz.abc','json.'+'a'.repeat(64001)]) await assert.rejects(()=>State.ShareCodec.decode(code));
  const zlib=require('node:zlib');
  const code='gz.'+zlib.gzipSync('x'.repeat(1100000)).toString('base64url');
  await assert.rejects(()=>State.ShareCodec.decode(code),/too large/);
});
test('data refresh is complete and aligns with MCP revision', () => {
  assert.equal(data.meta.dataRevision,vectors.dataRevision);assert.equal(data.meta.species,264);assert.equal(data.meta.megas,82);
  assert.equal(data.entities.length,346);assert.equal(entities.size,346);
  for(const e of data.entities){assert(Number.isInteger(e.spe));assert(e.allAbil.length);for(const a of e.abil)assert(data.abilities[a]);}
});
module.exports={fixture};
test('focused comparison settings are validated along with imports', () => {
  const input=fixture();input.compare=State.defaultCompare(data);
  input.compare.mine.spec={sp:13,align:-1,item:'ironball'};input.compare.opponent.ent='jolteon';
  assert.deepEqual(State.normalize(input,data).state.compare,input.compare);
  input.compare.mine.spec.sp=99;assert.throws(()=>State.normalize(input,data));
  input.compare.mine.spec.sp=13;input.compare.opponent.ent='unknown';assert.throws(()=>State.normalize(input,data));
});
