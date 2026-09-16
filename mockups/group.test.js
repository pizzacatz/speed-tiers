const {test} = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const {JSDOM, VirtualConsole} = require('jsdom');
const html = readFileSync(`${__dirname}/speed-lab.html`, 'utf8');
function setup(t) {
  const errors = [];
  const console = new VirtualConsole();
  console.on('jsdomError', e => errors.push(e));
  const dom = new JSDOM(html, {runScripts:'dangerously', virtualConsole:console, beforeParse(w) {
    w.HTMLDialogElement.prototype.showModal = function() { this.open = true; };
    w.HTMLDialogElement.prototype.close = function() { this.open = false; };
  }});
  t.after(() => { dom.window.close(); assert.deepEqual(errors, []); });
  const w = dom.window;
  return {w, el:id => w.document.getElementById(id), run:s => w.eval(s), input(id,value,event='input') {
    const el = w.document.getElementById(id); el.value = value; el.dispatchEvent(new w.Event(event,{bubbles:true}));
  }};
}
test('initial group keeps separate maximum and Scarf sets', t => {
  const {run,el} = setup(t);
  assert.equal(run('countFirst(comparisons(base))'), 1);
  assert.equal(el('results').querySelectorAll('[data-select]').length,6);
  assert.equal(run('JSON.stringify(comparisons(base).filter(r=>r.record.ent === "garchomp").map(r=>r.result.speed))'),'[169,253]');
});
test('SP trial shows a real group gain, revert restores, keep commits', t => {
  const {run,el,input} = setup(t);
  input('sp',29);
  assert.equal(run('base.mine.sp'),12);
  assert.equal(el('yourSpeed').textContent,'151');
  assert.equal(run('countFirst(comparisons(current()))'),2);
  assert.match(el('results').textContent,/Newly first/);
  el('revertTrial').click();
  assert.equal(el('yourSpeed').textContent,'134');
  input('sp',29); el('keepTrial').click();
  assert.equal(run('base.mine.sp'),29);
  assert.equal(run('trial'),null);
});
test('revert restores accumulated set and field changes', t => {
  const {run,el,input} = setup(t);
  const before = run('JSON.stringify(base)');
  input('sp',32); input('weather','rain','change'); el('windMine').click(); el('trick').click();
  el('revertTrial').click();
  assert.equal(run('JSON.stringify(base)'),before);
  assert.equal(el('weather').value,'');
  assert.equal(el('windMine').getAttribute('aria-pressed'),'false');
});
test('group suggestion matches predicted coverage', t => {
  const {run,w} = setup(t);
  const predicted = run('proposals[0].first');
  w.document.querySelector('[data-proposal="0"]').click();
  assert.equal(run('countFirst(comparisons(current()))'),predicted);
  assert.equal(run('countFirst(comparisons(base))'),1);
});
test('duplicate editing is isolated and invalid investment is rejected', t => {
  const {run,el,input} = setup(t);
  const before = run('JSON.stringify(base.benchmarks[1])');
  el('duplicateSelected').click();
  assert.equal(run('base.benchmarks.length'),7);
  input('editSP',33); el('saveBenchmark').click();
  assert.equal(el('dialog').open,true);
  assert.match(el('validation').textContent,/0 to 32/);
  input('editSP',0); el('saveBenchmark').click();
  assert.equal(run('base.benchmarks[6].sp'),0);
  assert.equal(run('JSON.stringify(base.benchmarks[1])'),before);
});
test('priority outranks Speed even in Trick Room and reason explains it', t => {
  const {run} = setup(t);
  run('base.benchmarks[0].battle.priority = 1; base.field.trickRoom = true; render()');
  assert.equal(run('comparisons(base)[0].relation'),'slower');
  assert.match(run('reason(comparisons(base)[0],base,true)'),/Priority decides/);
});
test('only selected ability activates and shared weather affects both sides', t => {
  const {run} = setup(t);
  run(`base.mine = makeSet('jolteon'); base.mine.battle.para = true; base.mine.ability = 'Volt Absorb'`);
  const penalized = run('calculate(base.mine,base,"A").speed');
  run(`base.mine.ability = 'Quick Feet'`);
  assert.ok(run('calculate(base.mine,base,"A").speed') > penalized * 2);
  run(`const swimmer = DATA.entities.find(e => e.allAbil.includes('Swift Swim')); base.mine = makeSet(swimmer.id); base.mine.ability = 'Swift Swim'; base.benchmarks = [clone(base.mine)]`);
  const dry = run('calculate(base.mine,base,"A").speed');
  run(`base.field.weather = 'rain'`);
  assert.equal(run('calculate(base.mine,base,"A").speed'),dry*2);
  assert.equal(run('comparisons(base)[0].result.speed'),dry*2);
});
test('hover does not select or mutate, filtering and ladder retain group', t => {
  const {run,el,w} = setup(t);
  const before = run('JSON.stringify({base,trial,selected})');
  el('results').querySelector('[data-select]').dispatchEvent(new w.MouseEvent('mouseover',{bubbles:true}));
  assert.equal(run('JSON.stringify({base,trial,selected})'),before);
  el('needsWork').click();
  assert.equal(el('results').querySelectorAll('[data-select]').length,5);
  el('ladderView').click();
  assert.equal(el('ladder').hidden,false);
  assert.equal(el('ladder').querySelectorAll('[data-select]').length,5);
  run('base.benchmarks = []; render()');
  assert.match(el('ladder').textContent,/benchmark/i);
  assert.equal(el('selectedDetail').textContent,'');
});
