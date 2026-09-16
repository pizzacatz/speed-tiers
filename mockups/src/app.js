'use strict';
const DATA = JSON.parse(document.getElementById('data').textContent);
const ENT = Object.fromEntries(DATA.entities.map(e => [e.id, e]));
const AB = DATA.abilities;
const $ = id => document.getElementById(id);
const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clone = value => JSON.parse(JSON.stringify(value));
let nextId = 10;
function makeSet(ent, label = 'Max Speed', preset = 'max') {
  const specs = {max:{sp:32,align:1,item:'none'}, base:{sp:0,align:0,item:'none'}, min:{sp:0,align:-1,item:'none'}, scarf:{sp:32,align:1,item:'scarf'}};
  return {id:'b'+nextId++,ent,label,...specs[preset],ability:ENT[ent].allAbil[0],battle:{stage:0,para:false,priority:0,active:false}};
}
function initialState() {
  const mine = makeSet('garchomp','Your set','base'); mine.sp = 12;
  return {mine,field:{weather:null,eterrain:false,trickRoom:false,tailwind:{A:false,B:false}},benchmarks:[
    makeSet('incineroar','Uninvested','base'), makeSet('rillaboom'), makeSet('garchomp'),
    makeSet('whimsicott'), makeSet('dragapult'), makeSet('garchomp','Choice Scarf','scarf')
  ]};
}
let base = initialState(), trial = null;
let selected = base.benchmarks[1].id, view = 'results', needsWork = false;
let proposals = [], modalReturn = null, noticeTimer;
const current = () => trial || base;
const abilitySlug = record => Object.keys(AB).find(k => AB[k].name === record.ability);
function engineEntity(record) {
  const slug = abilitySlug(record);
  return {...ENT[record.ent],abil:slug ? [slug] : []};
}
function engineSpec(record, side) {
  const slug = abilitySlug(record), manual = slug && (!AB[slug].cond || AB[slug].cond === 'status');
  return Engine.merge({sp:record.sp,align:record.align,item:record.item,stage:record.battle.stage,
    para:record.battle.para,priority:record.battle.priority,abil:manual && record.battle.active ? slug : 'auto',side});
}
function calculate(record, scenario, side = 'B') {
  return Engine.compute(engineEntity(record),engineSpec(record,side),scenario.field,AB);
}
function comparisons(scenario) {
  const mine = calculate(scenario.mine,scenario,'A');
  return base.benchmarks.map(record => {
    const result = calculate(record,scenario);
    return {record,mine,result,relation:Engine.relation(mine,result,scenario.field.trickRoom)};
  });
}
const countFirst = rows => rows.filter(row => row.relation === 'faster').length;
const sprite = record => DATA.sprites[ENT[record.ent].sprite] || '';
const alignName = value => value > 0 ? '+Speed' : value < 0 ? '−Speed' : 'Neutral';
const itemName = record => ENT[record.ent].mega ? 'Mega Stone' : record.item === 'none' ? 'No item' : Engine.ITEM_LABEL[record.item];
const sign = value => value > 0 ? '+'+value : String(value);
function ownEffectNames(record) {
  const b = record.battle, parts = [];
  if (b.stage) parts.push(`Stage ${sign(b.stage)}`);
  if (b.para) parts.push('Paralyzed');
  if (b.priority) parts.push(`Priority ${sign(b.priority)}`);
  if (b.active && abilitySlug(record) && (!AB[abilitySlug(record)].cond || AB[abilitySlug(record)].cond === 'status')) parts.push(`${record.ability} manually active`);
  return parts;
}
function effectNames(row, scenario) {
  const parts = ownEffectNames(row.record);
  if (row.result.ability && !parts.some(p => p.startsWith(row.record.ability))) parts.push(`${row.record.ability} active`);
  if (scenario.field.tailwind.B) parts.push('Opponent Tailwind');
  return parts;
}
function relationLabel(relation) { return relation === 'faster' ? 'First' : relation === 'tie' ? 'Tie' : 'After'; }
function relationClass(relation) { return relation === 'faster' ? 'first' : relation === 'tie' ? 'tie' : 'after'; }
function reason(row, scenario, long = false) {
  const {mine,result,relation} = row;
  if (mine.priority !== result.priority) return long ? `Your priority is ${sign(mine.priority)}; this benchmark uses ${sign(result.priority)}. Priority decides the order before Speed, including in Trick Room.` : `Priority ${sign(mine.priority)} vs ${sign(result.priority)}`;
  if (relation === 'tie') return long ? 'The same Speed and priority. Either Pokémon can move first; an exact tie is not a guaranteed win.' : 'Same Speed & priority';
  const gap = Math.abs(mine.speed-result.speed), higher = mine.speed > result.speed;
  return long ? `Your ${mine.speed} Speed is ${gap} ${higher ? 'above' : 'below'} this set’s ${result.speed}.${scenario.field.trickRoom ? ' Trick Room favors the lower Speed within this priority bracket.' : ' Both sets use the same priority, so higher Speed moves first.'}` : `${gap} Speed ${higher ? 'faster' : 'slower'}${scenario.field.trickRoom ? ' · Trick Room' : ''}`;
}
function notice(message) { $('notice').textContent = message; clearTimeout(noticeTimer); noticeTimer = setTimeout(() => $('notice').textContent = '', 4000); }
function changeTrial(edit) {
  if (!trial) trial = {mine:clone(base.mine),field:clone(base.field)};
  edit(trial);
  if (JSON.stringify(trial.mine) === JSON.stringify(base.mine) && JSON.stringify(trial.field) === JSON.stringify(base.field)) trial = null;
  render();
}
function changeDescriptions() {
  if (!trial) return [];
  const a = base.mine, b = trial.mine, changes = [];
  if (a.ent !== b.ent) changes.push(`${ENT[a.ent].name} → ${ENT[b.ent].name}`);
  if (a.sp !== b.sp) changes.push(`SP ${a.sp} → ${b.sp}`);
  if (a.align !== b.align) changes.push(`${alignName(a.align)} → ${alignName(b.align)}`);
  if (a.item !== b.item) changes.push(`${itemName(a)} → ${itemName(b)}`);
  if (a.ability !== b.ability) changes.push(`${a.ability} → ${b.ability}`);
  if (a.battle.stage !== b.battle.stage) changes.push(`Stage ${sign(a.battle.stage)} → ${sign(b.battle.stage)}`);
  if (a.battle.priority !== b.battle.priority) changes.push(`Priority ${sign(a.battle.priority)} → ${sign(b.battle.priority)}`);
  if (a.battle.para !== b.battle.para) changes.push(b.battle.para ? 'Paralyzed' : 'Paralysis removed');
  if (a.battle.active !== b.battle.active) changes.push(`${b.ability} ${b.battle.active ? 'manually active' : 'automatic activation'}`);
  if (base.field.weather !== trial.field.weather) changes.push(`Weather: ${base.field.weather || 'none'} → ${trial.field.weather || 'none'}`);
  for (const [key,label] of [['trickRoom','Trick Room'],['eterrain','Electric Terrain']]) if (base.field[key] !== trial.field[key]) changes.push(`${label} ${trial.field[key] ? 'on' : 'off'}`);
  for (const [key,label] of [['A','Your Tailwind'],['B','Opponent Tailwind']]) if (base.field.tailwind[key] !== trial.field.tailwind[key]) changes.push(`${label} ${trial.field.tailwind[key] ? 'on' : 'off'}`);
  return changes;
}
function renderControls() {
  const scenario = current(), mine = scenario.mine, entity = ENT[mine.ent];
  const identity = $('identity');
  if (identity.dataset.ent !== mine.ent) {
    identity.dataset.ent = mine.ent;
    identity.innerHTML = `<img class="portrait" src="${sprite(mine)}" alt=""><div><button class="species-button" id="chooseMine" aria-label="Change your Pokémon">${esc(entity.name)} <span class="chevron" aria-hidden="true">⌄</span></button><p>${entity.types.map(t => t[0].toUpperCase()+t.slice(1)).join(' / ')}</p></div>`;
    $('chooseMine').onclick = () => openPicker('mine');
    $('ability').innerHTML = entity.allAbil.map(name => `<option value="${esc(name)}">${esc(name)}</option>`).join('');
    $('item').innerHTML = entity.mega ? '<option value="none">Mega Stone</option>' : '<option value="none">None</option><option value="scarf">Choice Scarf</option><option value="ironball">Iron Ball</option>';
    $('item').disabled = !!entity.mega;
  }
  for (const [id,value] of [['sp',mine.sp],['spRange',mine.sp],['align',mine.align],['ability',mine.ability],['item',entity.mega ? 'none' : mine.item],['weather',scenario.field.weather || '']]) {
    if ($(id) !== document.activeElement || !['sp'].includes(id)) $(id).value = value;
  }
  for (const [id,on] of [['trick',scenario.field.trickRoom],['terrain',scenario.field.eterrain],['windMine',scenario.field.tailwind.A],['windOpp',scenario.field.tailwind.B]]) $(id).setAttribute('aria-pressed',String(on));
  const result = calculate(mine,scenario,'A');
  $('yourSpeed').textContent = result.speed;
  $('originalSpeed').innerHTML = trial ? `<b>${calculate(base.mine,base,'A').speed}</b>current set` : '';
  $('setMode').textContent = trial ? 'TRIAL' : 'CURRENT'; $('setMode').className = 'mode-label'+(trial ? ' trial' : '');
  const slug = abilitySlug(mine);
  $('abilityStatus').textContent = result.ability ? `${mine.ability} is active${mine.battle.active ? ' (manual)' : ''}` : slug ? `${mine.ability} is not active in these conditions` : 'No direct Speed multiplier';
  $('ownEffectsSummary').textContent = ownEffectNames(mine).join(' · ') || 'Stage 0 · no paralysis · priority 0';
}
function renderCoverage(before, after) {
  const total = after.length, first = countFirst(after), oldFirst = countFirst(before), ties = after.filter(r => r.relation === 'tie').length;
  $('coverage').innerHTML = `${trial ? `<div class="coverage-baseline"><b>${oldFirst} / ${total}</b>current</div><span class="coverage-arrow" aria-hidden="true">→</span>` : ''}<div class="coverage-main"><span class="large">${first}<small> / ${total}</small></span><p><strong>move first</strong>${trial ? 'with this trial' : 'with your current set'}</p></div><span class="coverage-divider"></span><div class="coverage-small"><b>${ties}</b>Speed ${ties === 1 ? 'tie' : 'ties'}</div><div class="coverage-small"><b>${total-first-ties}</b>move after</div>`;
  $('coverageTrack').innerHTML = total ? `<span class="first" style="width:${first/total*100}%"></span><span class="tie" style="width:${ties/total*100}%"></span><span class="after" style="width:${(total-first-ties)/total*100}%"></span>` : '';
}
function renderRows(before, after) {
  const scenario = current(), filtered = needsWork ? after.filter(row => row.relation !== 'faster') : after;
  const old = new Map(before.map(row => [row.record.id,row]));
  $('results').hidden = view !== 'results'; $('ladder').hidden = view !== 'ladder';
  $('resultsView').setAttribute('aria-pressed',String(view === 'results')); $('ladderView').setAttribute('aria-pressed',String(view === 'ladder'));
  const empty = !base.benchmarks.length ? '<div class="empty"><strong>Choose your first benchmark.</strong>Add the Pokémon and set you want to move before.</div>' : '<div class="empty"><strong>Every benchmark is covered.</strong>Turn off “Not yet first” to see the whole group.</div>';
  $('results').innerHTML = filtered.length ? `<div class="result-head" aria-hidden="true"><span>Benchmark · explicit set</span><span>Speed</span><span>You move ${trial ? '· trial' : ''}</span></div>`+filtered.map(row => {
    const r = row.record, previous = old.get(r.id), changed = trial && row.relation !== previous.relation;
    const effects = effectNames(row,scenario), gained = changed && row.relation === 'faster', lost = changed && previous.relation === 'faster';
    return `<button class="result-row" data-select="${r.id}" aria-pressed="${selected === r.id}" aria-label="${esc(ENT[r.ent].name)} ${esc(r.label)}: you move ${relationLabel(row.relation).toLowerCase()}"><span class="row-identity"><img src="${sprite(r)}" alt=""><span><span class="row-name">${esc(ENT[r.ent].name)} <em>${esc(r.label)}</em></span><span class="row-set">${r.sp} SP · ${alignName(r.align)} · ${esc(itemName(r))}<br>${esc(r.ability)}</span>${effects.length ? `<span class="row-effects">${effects.map(esc).join(' · ')}</span>` : ''}</span></span><span class="row-speed">${trial && row.result.speed !== previous.result.speed ? `<del>${previous.result.speed}</del>` : ''}${row.result.speed}</span><span class="row-result"><span class="result-pill ${relationClass(row.relation)}">${relationLabel(row.relation)}</span><span class="result-reason">${esc(reason(row,scenario))}</span>${changed ? `<span class="transition-label${lost ? ' loss' : ''}">${gained ? '↑ Newly first' : lost ? '↓ No longer first' : `${relationLabel(previous.relation)} → ${relationLabel(row.relation)}`}</span>` : ''}</span></button>`;
  }).join('') : empty;
  const mine = calculate(scenario.mine,scenario,'A'), original = calculate(base.mine,base,'A');
  const maxSpeed = Math.max(1,mine.speed,original.speed,...after.map(row => row.result.speed))*1.12;
  $('ladder').innerHTML = filtered.length ? `<div class="ladder-key"><b>│ Your ${trial ? 'trial' : 'set'}: ${mine.speed}</b>${trial ? `<span>┆ Current: ${original.speed}</span>` : ''}<span>● Opponent sets</span></div>`+filtered.slice().sort((a,b) => b.result.speed-a.result.speed).map(row => `<button class="ladder-row" data-select="${row.record.id}" aria-pressed="${selected === row.record.id}"><span class="ladder-label">${esc(ENT[row.record.ent].name)}<small>${esc(row.record.label)} · you move ${relationLabel(row.relation).toLowerCase()}</small></span><span class="ladder-track" aria-hidden="true">${trial ? `<span class="ladder-line original" style="left:${original.speed/maxSpeed*100}%"></span>` : ''}<span class="ladder-line" style="left:${mine.speed/maxSpeed*100}%"></span><span class="ladder-dot" style="left:${row.result.speed/maxSpeed*100}%"></span></span><span class="ladder-val">${row.result.speed}</span></button>`).join('')+`<div class="ladder-scale"><span>0</span><span>Speed → ${Math.ceil(maxSpeed)}</span></div>` : empty;
  $('boardNote').textContent = view === 'ladder' ? 'The scale shows Speed only. Priority and Trick Room still decide the result beside each set.' : 'Each row is a specific opponent set. Select one for the explanation; hover never changes your comparison.';
}
function renderDetail(after) {
  const row = after.find(row => row.record.id === selected), host = $('selectedDetail');
  host.hidden = !row; if (!row) { host.innerHTML = ''; return; }
  const wasOpen = !!host.querySelector('details[open]'), r = row.record, scenario = current();
  const solution = Engine.solve(engineEntity(scenario.mine),engineSpec(scenario.mine,'A'),scenario.field,AB,row.result,scenario.field.trickRoom);
  const heading = row.relation === 'faster' ? 'You move first.' : row.relation === 'tie' ? 'This is a tie, not a guaranteed first move.' : 'This benchmark moves before you.';
  host.innerHTML = `<div class="detail-heading"><h3>${esc(ENT[r.ent].name)} · ${esc(r.label)}</h3><div class="detail-actions"><button id="editSelected">Edit set</button><button id="duplicateSelected">Duplicate</button></div></div><p class="detail-answer">${heading}</p><p class="detail-text">${esc(reason(row,scenario,true))}</p><p class="detail-solve"><b>${row.relation === 'faster' ? 'Covered.' : 'To move first:'}</b> ${row.relation === 'faster' ? 'This explicit set is already covered by your '+(trial ? 'trial.' : 'current build.') : solution.map(s => esc(s.label)).join(' · ')}</p><details ${wasOpen ? 'open' : ''}><summary>Show assumptions & calculation</summary><p class="detail-text">Weather: ${scenario.field.weather || 'none'} · terrain: ${scenario.field.eterrain ? 'Electric' : 'none'} · Trick Room: ${scenario.field.trickRoom ? 'on' : 'off'} · Tailwind: you ${scenario.field.tailwind.A ? 'on' : 'off'}, opponents ${scenario.field.tailwind.B ? 'on' : 'off'}.</p><div class="breakdowns">${[['Your '+ENT[scenario.mine.ent].name,row.mine],['Opponent '+ENT[r.ent].name,row.result]].map(([name,value]) => `<div><strong>${esc(name)}</strong><ol>${value.steps.map(s => `<li>${esc(s.label)} → <b>${s.value}</b></li>`).join('')}</ol></div>`).join('')}</div></details>`;
  $('editSelected').onclick = () => editBenchmark(r.id);
  $('duplicateSelected').onclick = () => { if (base.benchmarks.length >= 24) return notice('This concept supports up to 24 benchmarks.'); const copy = clone(r); copy.id = 'b'+nextId++; copy.label = (copy.label+' copy').slice(0,40); base.benchmarks.push(copy); selected = copy.id; render(); editBenchmark(copy.id); };
}
function renderProposals(after) {
  const scenario = current(), record = scenario.mine, wins = countFirst(after);
  proposals = [];
  const add = (title, edit) => {
    const experiment = {mine:clone(scenario.mine),field:clone(scenario.field)}; edit(experiment);
    const outcomes = comparisons(experiment), first = countFirst(outcomes);
    if (first <= wins) return false;
    const gained = outcomes.filter((r,i) => r.relation === 'faster' && after[i].relation !== 'faster');
    proposals.push({title,edit,first,names:gained.map(r => ENT[r.record.ent].name+' · '+r.record.label),speed:calculate(experiment.mine,experiment,'A').speed});
    return true;
  };
  const direction = scenario.field.trickRoom ? -1 : 1;
  for (let sp = record.sp+direction; sp >= 0 && sp <= 32; sp += direction) if (add(`Speed investment → ${sp} SP`,d => d.mine.sp = sp)) break;
  const alignment = scenario.field.trickRoom ? -1 : 1;
  if (record.align !== alignment) add(`${alignName(alignment)} alignment`,d => d.mine.align = alignment);
  if (!ENT[record.ent].mega) {
    const item = scenario.field.trickRoom ? 'ironball' : 'scarf';
    if (record.item !== item) add(Engine.ITEM_LABEL[item],d => d.mine.item = item);
  }
  if (scenario.field.tailwind.A === scenario.field.trickRoom) add(`Your Tailwind ${scenario.field.trickRoom ? 'off' : 'on'}`,d => d.field.tailwind.A = !scenario.field.trickRoom);
  const stage = record.battle.stage + direction;
  if (stage >= -6 && stage <= 6) add(`Speed stage ${sign(stage)}`,d => d.mine.battle.stage = stage);
  proposals = proposals.slice(0,3);
  $('suggestions').innerHTML = proposals.map((p,i) => `<button class="suggestion" data-proposal="${i}" title="Newly first against: ${esc(p.names.join(', '))}"><span><strong>${esc(p.title)}</strong><small>${p.speed} Speed · adds ${p.names.length} ${p.names.length === 1 ? 'benchmark' : 'benchmarks'}</small></span><b>${p.first}/${base.benchmarks.length}<small>first</small></b></button>`).join('') || `<p class="no-suggestions">${!after.length ? 'Add a benchmark to explore useful changes.' : wins === after.length ? 'Every benchmark is covered. Add another set or change the battlefield to test further.' : 'No suggested single change improves coverage. Check priorities and individual effects.'}</p>`;
}
function renderTrial(before, after) {
  $('trialBar').hidden = !trial; document.body.classList.toggle('has-trial',!!trial);
  if (!trial) return;
  const first = countFirst(after), oldFirst = countFirst(before);
  const gains = after.filter((r,i) => r.relation === 'faster' && before[i].relation !== 'faster').length;
  const losses = after.filter((r,i) => r.relation !== 'faster' && before[i].relation === 'faster').length;
  $('trialDescription').textContent = changeDescriptions().join(' · ');
  $('trialImpact').innerHTML = `<b>${oldFirst} → ${first} / ${after.length} move first</b>${gains} gained · ${losses} lost`;
}
function render() {
  const focused = document.activeElement, focusedRow = focused?.dataset?.select;
  renderControls();
  const before = comparisons(base), after = comparisons(current());
  if (!base.benchmarks.some(row => row.id === selected)) selected = base.benchmarks[0]?.id || null;
  renderCoverage(before,after); renderRows(before,after); renderDetail(after); renderProposals(after); renderTrial(before,after);
  if (focusedRow) document.querySelector(`#${view} [data-select="${focusedRow}"]`)?.focus({preventScroll:true});
}
function openDialog(title, html) {
  if (!$('dialog').open) modalReturn = {element:document.activeElement,id:document.activeElement?.id};
  $('dialogTitle').textContent = title; $('dialogBody').innerHTML = html;
  if (!$('dialog').open) $('dialog').showModal();
}
function closeDialog() {
  $('dialog').close();
  const target = modalReturn?.element?.isConnected ? modalReturn.element : modalReturn?.id ? $(modalReturn.id) : $('addBenchmark');
  target?.focus({preventScroll:true}); modalReturn = null;
}
function openPicker(mode) {
  if (mode === 'benchmark' && base.benchmarks.length >= 24) return notice('This concept supports up to 24 benchmarks.');
  openDialog(mode === 'mine' ? 'Choose your Pokémon' : 'Add an explicit benchmark',`<p class="dialog-intro">${mode === 'mine' ? 'Changing species starts a trial against the same benchmark group.' : 'A preset fills in this new set once. Existing benchmarks never inherit changes from it.'}</p>${mode === 'benchmark' ? '<div class="picker-controls"><label>Starting set<select id="addPreset"><option value="max">Max Speed</option><option value="base">Uninvested</option><option value="min">Minimum Speed</option><option value="scarf">Choice Scarf</option></select></label></div>' : ''}<input class="dialog-search" id="pickerSearch" type="search" placeholder="Search Pokémon…" aria-label="Search all Pokémon"><div id="pickerList" class="picker-list"></div>`);
  const list = () => {
    const q = $('pickerSearch').value.trim().toLowerCase(), preset = $('addPreset')?.value || 'max';
    const matches = DATA.entities.filter(e => !q || e.name.toLowerCase().includes(q)).sort((a,b) => a.name.localeCompare(b.name)).slice(0,50);
    $('pickerList').innerHTML = matches.map(e => {
      const disabled = mode === 'benchmark' && preset === 'scarf' && e.mega;
      const spec = preset === 'base' ? {sp:0,align:0} : preset === 'min' ? {sp:0,align:-1} : {sp:32,align:1,item:preset === 'scarf' ? 'scarf' : 'none'};
      const nominal = Engine.compute({...e,abil:[]},Engine.merge(spec),{},AB).speed;
      return `<button class="pick-row" data-pick="${e.id}" ${disabled ? 'disabled' : ''}><img src="${DATA.sprites[e.sprite] || ''}" alt=""><span><strong>${esc(e.name)}</strong><small>${disabled ? 'Requires a Mega Stone; cannot hold a Scarf' : e.types.join(' / ')+(mode === 'benchmark' ? ' · before battle effects' : '')}</small></span>${mode === 'benchmark' && !disabled ? `<b>${nominal}</b>` : ''}</button>`;
    }).join('') || '<div class="empty">No Pokémon match that search.</div>';
  };
  $('pickerSearch').oninput = list; if ($('addPreset')) $('addPreset').onchange = list;
  $('pickerList').onclick = event => {
    const button = event.target.closest('[data-pick]'); if (!button || button.disabled) return;
    const ent = button.dataset.pick;
    if (mode === 'mine') {
      closeDialog(); changeTrial(d => { d.mine.ent = ent; d.mine.ability = ENT[ent].allAbil[0]; d.mine.battle.active = false; if (ENT[ent].mega) d.mine.item = 'none'; }); $('chooseMine').focus();
    } else {
      const preset = $('addPreset').value, labels = {max:'Max Speed',base:'Uninvested',min:'Minimum Speed',scarf:'Choice Scarf'};
      const record = makeSet(ent,labels[preset],preset); base.benchmarks.push(record); selected = record.id;
      closeDialog(); render(); notice(`${ENT[ent].name} added as a separate set.`);
    }
  };
  list(); $('pickerSearch').focus();
}
function selectOptions(values, value) { return values.map(([v,label]) => `<option value="${esc(v)}" ${String(value) === String(v) ? 'selected' : ''}>${esc(label)}</option>`).join(''); }
function battleFields(record) {
  const b = record.battle, slug = abilitySlug(record), manual = slug && (!AB[slug].cond || AB[slug].cond === 'status');
  return `<div class="form-grid"><label>Speed stage<select id="editStage">${selectOptions(Array.from({length:13},(_,i) => [i-6,sign(i-6)]),b.stage)}</select></label><label>Move priority<select id="editPriority">${selectOptions(Array.from({length:13},(_,i) => [i-7,sign(i-7)]),b.priority)}</select></label><label>Paralysis<select id="editPara">${selectOptions([[false,'No'],[true,'Paralyzed']],b.para)}</select></label><label ${manual ? '' : 'hidden'}>Manual ability activation<select id="editActive">${selectOptions([[false,'Automatic / inactive'],[true,'Active']],b.active)}</select></label></div>`;
}
function readBattle() { return {stage:Number($('editStage').value),priority:Number($('editPriority').value),para:$('editPara').value === 'true',active:$('editActive').value === 'true'}; }
function editOwnEffects() {
  const record = current().mine;
  openDialog('Your individual battle effects',`<p class="dialog-intro">These affect only ${esc(ENT[record.ent].name)}. Weather and side-wide Tailwind live in the battlefield bar.</p>${battleFields(record)}<p class="dialog-caption">Priority belongs to the move you choose. Unburden and non-paralysis Quick Feet activation can be modeled manually when available.</p><div class="dialog-actions"><button id="cancelEffects" class="secondary">Cancel</button><button id="tryEffects" class="primary">Try these effects</button></div>`);
  $('cancelEffects').onclick = closeDialog;
  $('tryEffects').onclick = () => { const battle = readBattle(); closeDialog(); changeTrial(d => d.mine.battle = battle); };
}
function editBenchmark(id) {
  const record = base.benchmarks.find(r => r.id === id); if (!record) return;
  const e = ENT[record.ent], draft = clone(record);
  openDialog(`${e.name} · benchmark set`,`<p class="dialog-intro">Edit only this opponent set. Other benchmarks, including other ${esc(e.name)} sets, stay as they are.</p><div class="form-grid"><label class="full">Set label<input id="editLabel" maxlength="40" value="${esc(record.label)}"></label><label>Speed SP<input id="editSP" type="number" min="0" max="32" value="${record.sp}"></label><label>Alignment<select id="editAlign">${selectOptions([[-1,'−Speed'],[0,'Neutral'],[1,'+Speed']],record.align)}</select></label><label>Held item<select id="editItem" ${e.mega ? 'disabled' : ''}>${e.mega ? '<option value="none">Mega Stone (required)</option>' : selectOptions([['none','None'],['scarf','Choice Scarf'],['ironball','Iron Ball']],record.item)}</select></label><label>Ability<select id="editAbility">${selectOptions(e.allAbil.map(a => [a,a]),record.ability)}</select></label></div><h3 class="dialog-section">Individual battle effects</h3><div id="benchmarkBattle">${battleFields(record)}</div><p class="dialog-caption">This opponent uses the shared battlefield and Opponent Tailwind. Active individual effects remain visible on its row.</p><div id="validation" class="dialog-validation" role="status"></div><div class="dialog-actions"><button id="removeBenchmark" class="secondary danger">Remove benchmark</button><button id="cancelEdit" class="secondary">Cancel</button><button id="saveBenchmark" class="primary">Save benchmark</button></div>`);
  $('editAbility').onchange = () => {
    draft.battle = readBattle(); draft.battle.active = false; draft.ability = $('editAbility').value;
    $('benchmarkBattle').innerHTML = battleFields(draft);
  };
  $('cancelEdit').onclick = closeDialog;
  $('saveBenchmark').onclick = () => {
    const raw = $('editSP').value, sp = Number(raw);
    if (!raw || !Number.isInteger(sp) || sp < 0 || sp > 32) { $('validation').textContent = 'Enter a whole number from 0 to 32 for Speed SP.'; $('editSP').focus(); return; }
    const label = $('editLabel').value.trim(); if (!label) { $('validation').textContent = 'Give this benchmark a short set label.'; $('editLabel').focus(); return; }
    Object.assign(record,{sp,label,align:Number($('editAlign').value),item:$('editItem').value,ability:$('editAbility').value,battle:readBattle()});
    closeDialog(); render(); notice('Benchmark updated. Both current and trial results use this explicit set.');
  };
  $('removeBenchmark').onclick = () => {
    const at = base.benchmarks.indexOf(record); base.benchmarks.splice(at,1); selected = base.benchmarks[Math.min(at,base.benchmarks.length-1)]?.id || null;
    closeDialog(); render(); notice('Benchmark removed from this comparison group.');
  };
}
$('closeDialog').onclick = closeDialog;
$('dialog').addEventListener('cancel',event => { event.preventDefault(); closeDialog(); });
$('addBenchmark').onclick = () => openPicker('benchmark');
$('ownEffects').onclick = editOwnEffects;
$('resultsView').onclick = () => { view = 'results'; render(); };
$('ladderView').onclick = () => { view = 'ladder'; render(); };
$('needsWork').onchange = event => { needsWork = event.target.checked; render(); };
for (const id of ['results','ladder']) $(id).onclick = event => { const row = event.target.closest('[data-select]'); if (!row) return; selected = row.dataset.select; render(); };
$('suggestions').onclick = event => { const button = event.target.closest('[data-proposal]'); if (!button) return; const proposal = proposals[Number(button.dataset.proposal)]; if (!proposal) return; changeTrial(proposal.edit); $('keepTrial').focus({preventScroll:true}); };
function editSP(event) {
  const value = event.target.value; if (value === '' || !Number.isInteger(Number(value))) return;
  const sp = Engine.clampSp(Number(value)); event.target.value = sp;
  changeTrial(d => d.mine.sp = sp);
  $('spRange').value = sp; $('sp').value = sp;
}
$('sp').oninput = editSP; $('spRange').oninput = editSP;
$('sp').onblur = () => $('sp').value = current().mine.sp;
$('align').onchange = event => changeTrial(d => d.mine.align = Number(event.target.value));
$('item').onchange = event => changeTrial(d => d.mine.item = event.target.value);
$('ability').onchange = event => changeTrial(d => { d.mine.ability = event.target.value; d.mine.battle.active = false; });
$('weather').onchange = event => changeTrial(d => d.field.weather = event.target.value || null);
$('trick').onclick = () => changeTrial(d => d.field.trickRoom = !d.field.trickRoom);
$('terrain').onclick = () => changeTrial(d => d.field.eterrain = !d.field.eterrain);
$('windMine').onclick = () => changeTrial(d => d.field.tailwind.A = !d.field.tailwind.A);
$('windOpp').onclick = () => changeTrial(d => d.field.tailwind.B = !d.field.tailwind.B);
$('keepTrial').onclick = () => {
  if (!trial) return; base.mine = clone(trial.mine); base.field = clone(trial.field); trial = null;
  render(); notice('Changes kept as your current set and battlefield.'); $('sp').focus({preventScroll:true});
};
$('revertTrial').onclick = () => { trial = null; render(); notice('Trial reverted. Your current set and battlefield are restored.'); $('sp').focus({preventScroll:true}); };
$('reset').onclick = () => { base = initialState(); trial = null; selected = base.benchmarks[1].id; view = 'results'; needsWork = false; $('needsWork').checked = false; render(); notice('Demo restored.'); };
$('modelNotes').onclick = () => openDialog('What this comparison holds constant',`<ul class="notes-list"><li><b>Explicit sets:</b> each row has its own investment, alignment, item, ability, and individual battle effects. There are no hidden tag defaults or column overrides.</li><li><b>Shared battlefield:</b> weather, terrain and Trick Room apply to both sides. Tailwind belongs to your side or the entire opponent group.</li><li><b>Trials:</b> edits to your set or battlefield are temporary until kept. Benchmark edits redefine the question and apply to both current and trial comparisons.</li><li><b>Move order:</b> priority comes first, then effective Speed. Trick Room reverses Speed within a priority bracket. Equal Speed and priority is a tie, not a guaranteed first move.</li><li><b>Abilities:</b> only the explicitly selected ability is considered. Weather abilities activate from the field. Quick Feet activates on paralysis and ignores its Speed penalty; use manual activation for other statuses. Unburden needs manual activation after item loss.</li><li><b>Scope:</b> no damage calculations, full-team SP-budget validation, Quick Claw, Stall or similar within-bracket ordering effects. Mega forms require their stone. This is a session-only interactive mockup.</li></ul>`);
$('regulation').textContent = DATA.meta.regulation;
$('revision').textContent = DATA.meta.dataRevision;
render();
