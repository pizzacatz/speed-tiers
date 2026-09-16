// Focused comparison UI shares the engine and field, without changing the full-tier workspace.
function compareSpec(side) {
  return Engine.merge(S.compare[side].spec, {side:side === 'mine' ? 'A' : 'B'});
}
function compareCalc(side, entity) {
  return Engine.compute(entity || ENT[S.compare[side].ent], compareSpec(side), S.field, AB);
}
function changeView(view) {
  S.compare.view = view; save(); renderCompare();
}
function renderCompare() {
  S.compare ||= StateModel.defaultCompare(DATA);
  const compare = S.compare.view === 'compare';
  $('compareView').hidden = !compare; $('tiersView').hidden = compare;
  $('viewCompare').setAttribute('aria-pressed',String(compare)); $('viewTiers').setAttribute('aria-pressed',String(!compare));
  if (!compare) return;
  $('cmpSearch').value = S.compare.search; $('cmpPreset').value = S.compare.preset;
  renderSetCard('mine'); renderSetCard('opponent'); renderMatchup(); renderCompareRoster();
}
function renderSetCard(side) {
  const set = S.compare[side], e = ENT[set.ent], sp = compareSpec(side);
  const host = $(side === 'mine' ? 'cmpMine' : 'cmpOpponent');
  const wasOpen = !!host.querySelector('details[open]');
  const option = (k, values) => `<select data-cmp-k="${k}" aria-label="${side === 'mine' ? 'Your' : 'Opponent'} ${k}">${values.map(([v,label])=>`<option value="${v}" ${String(sp[k])===String(v)?'selected':''}>${esc(label)}</option>`).join('')}</select>`;
  host.dataset.cmpSide = side;
  host.innerHTML = `<div class="setHeading">${sprite(e)}<div class="setName"><span>${side === 'mine' ? 'Your Pokémon' : 'Selected opponent'}</span><button data-choose="${side}" aria-label="Change ${side === 'mine' ? 'your Pokémon' : 'opponent'}: ${esc(e.name)}">${esc(e.name)}</button></div><div class="speedNumber"><span data-cmp-speed>${compareCalc(side).speed}</span><small>Speed</small></div></div>
    <div class="setFields"><label>Speed SP<input type="number" min="0" max="32" value="${sp.sp}" data-cmp-k="sp" aria-label="${side === 'mine' ? 'Your' : 'Opponent'} Speed Stat Points"></label>
    <label>Alignment${option('align',[[1,'+Speed'],[0,'Neutral'],[-1,'−Speed']])}</label>
    <label>Held item${e.mega ? '<select disabled aria-label="Required Mega Stone"><option>Mega Stone</option></select>' : option('item',Object.keys(Engine.ITEMS).map(k=>[k,k==='none'?'None':Engine.ITEM_LABEL[k]]))}</label></div>
    <details class="setAdvanced" ${wasOpen?'open':''}><summary>More set options</summary><div class="frow">
      <label class="ctl">Speed stage${option('stage',Array.from({length:13},(_,i)=>[i-6,(i-6>0?'+':'')+(i-6)]))}</label>
      <label class="ctl">Move priority${option('priority',Array.from({length:13},(_,i)=>[i-7,(i-7>0?'+':'')+(i-7)]))}</label>
      <label class="ctl">Ability${option('abil',[['auto','Auto (field/status)'],['off','Off'],['on','Active (first available)'],...e.abil.map(a=>[a,AB[a].name+' (active)'])])}</label>
      <label class="ctl">Paralysis${option('para',[[false,'No'],[true,'Yes']])}</label>
    </div><p class="muted" style="font-size:12px;margin:6px 0">Auto uses available Speed abilities. Select the ability active on your set. Tailwind follows ${side==='mine'?'Your':'Opponent'} Tailwind above.</p></details>`;
}
function renderMatchup() {
  const mine=compareCalc('mine'), opponent=compareCalc('opponent');
  const relation=Engine.relation(mine,opponent,S.field.trickRoom), diff=mine.speed-opponent.speed;
  const result=$('cmpResult'); result.dataset.relation=relation;
  let reason = mine.priority !== opponent.priority ? `Priority ${mine.priority > 0 ? '+' : ''}${mine.priority} vs ${opponent.priority > 0 ? '+' : ''}${opponent.priority}. Priority decides this matchup.` :
    relation==='tie' ? 'Same Speed and priority. Either Pokémon can move first.' :
    `${Math.abs(diff)} Speed ${diff>0?'above':'below'} your opponent.${S.field.trickRoom ? ' Trick Room favors lower Speed.' : ''}`;
  result.innerHTML = `<span class="resultKicker">${S.field.trickRoom?'Trick Room active':'Move order'}</span><h3>${relation==='faster'?'You move first':relation==='tie'?'It’s a Speed tie':'Your opponent moves first'}</h3><p>${reason}</p>`;
  for(const side of ['mine','opponent']) $(side==='mine'?'cmpMine':'cmpOpponent').querySelector('[data-cmp-speed]').textContent=side==='mine'?mine.speed:opponent.speed;
  const solutions=Engine.solve(ENT[S.compare.mine.ent],compareSpec('mine'),S.field,AB,opponent,S.field.trickRoom);
  $('cmpSuggestions').innerHTML=`<h3>${relation==='faster'?'This benchmark is covered':'What would move you first?'}</h3>${relation==='faster'?'<p>Your current set already wins this comparison.</p>':`<ul>${solutions.map(s=>`<li>${esc(s.label)}</li>`).join('')}</ul>${solutions.some(s=>s.blocked)?'':'<p>Each suggestion is an alternative change to your current set.</p>'}`}
    <details><summary>Show calculation breakdown</summary><div class="breakdowns">${[[ENT[S.compare.mine.ent].name,mine],[ENT[S.compare.opponent.ent].name,opponent]].map(([name,c])=>`<div><b>${esc(name)}</b><ol>${c.steps.map(step=>`<li>${esc(step.label)} → <b>${step.value}</b></li>`).join('')}</ol></div>`).join('')}</div></details>`;
}
function renderCompareRoster() {
  const q=S.compare.search.trim().toLowerCase(), mine=compareCalc('mine');
  const rows=DATA.entities.filter(e=>!q||e.name.toLowerCase().includes(q)).map(e=>({e,c:compareCalc('opponent',e)}));
  rows.sort((a,b)=>Engine.comparator(S.field.trickRoom)(a.c,b.c)||a.e.name.localeCompare(b.e.name));
  $('cmpCount').textContent=`${rows.length} species & forms · ${S.field.trickRoom?'lower Speed first':'higher Speed first'}`;
  const host=$('cmpRoster'), scroll=host.scrollTop;
  host.innerHTML=rows.map(({e,c})=>{
    const delta=c.speed-mine.speed, r=Engine.relation(c,mine,S.field.trickRoom);
    return `<button class="rosterRow" data-rival="${e.id}" aria-pressed="${S.compare.opponent.ent===e.id}" aria-label="Compare ${esc(e.name)}, Speed ${c.speed}"><span class="rosterIdentity">${sprite(e)}<span><strong>${esc(e.name)}</strong><small>${e.types.map(x=>x[0].toUpperCase()+x.slice(1)).join(' / ')}${e.mega?' · Mega':''}</small></span></span><span class="rosterSpeed">${c.speed}</span><span class="rosterDelta">${delta>0?'+':''}${delta}<small>${r==='tie'?'tie':r==='faster'?'before you':'after you'}</small></span></button>`;
  }).join('')||'<p class="emptyRoster">No Pokémon match your search. Try another name.</p>';
  host.scrollTop=scroll;
}
function chooseCompareSpecies(side) {
  modal(`<h2><span>Choose ${side==='mine'?'your Pokémon':'an opponent'}</span><button data-close>Close</button></h2><label class="ctl">Search species<input id="chooseSearch" type="search" placeholder="Start typing a name…" autofocus></label><div id="chooseList" class="list" style="margin-top:12px"></div>`,m=>{
    const input=m.querySelector('#chooseSearch');
    const list=()=>{
      const q=input.value.toLowerCase().trim();
      m.querySelector('#chooseList').innerHTML=DATA.entities.filter(e=>!q||e.name.toLowerCase().includes(q)).sort((a,b)=>a.name.localeCompare(b.name)).slice(0,60).map(e=>`<button class="it" data-pick="${e.id}">${sprite(e)}<span>${esc(e.name)}</span></button>`).join('')||'<p>No matching Pokémon.</p>';
    };
    input.oninput=list;
    m.querySelector('#chooseList').onclick=ev=>{const button=ev.target.closest('[data-pick]');if(!button)return;S.compare[side].ent=button.dataset.pick;S.compare[side].spec.abil='auto';if(side==='mine'&&ENT[button.dataset.pick].mega)S.compare[side].spec.item='none';closeModal();save();renderCompare();$(side==='mine'?'cmpMine':'cmpOpponent').querySelector('[data-choose]').focus();};
    list();input.focus();
  });
}
$('viewCompare').onclick=()=>changeView('compare');
$('viewTiers').onclick=()=>changeView('tiers');
$('cmpSearch').oninput=ev=>{S.compare.search=ev.target.value;save();$('cmpRoster').scrollTop=0;renderCompareRoster();};
$('cmpPreset').onchange=ev=>{
  const presets={max:{sp:32,align:1},base:{sp:0,align:0},min:{sp:0,align:-1},scarf:{sp:32,align:1,item:'scarf'}};
  const preset=presets[ev.target.value];if(!preset)return;
  S.compare.preset=ev.target.value;S.compare.opponent.spec={...preset};save();renderCompare();
};
$('cmpRoster').onclick=ev=>{
  const row=ev.target.closest('[data-rival]');if(!row)return;
  S.compare.opponent.ent=row.dataset.rival;save();renderSetCard('opponent');renderMatchup();
  // Only change selection styling; leave all roster buttons and keyboard focus in place.
  $('cmpRoster').querySelectorAll('[data-rival]').forEach(b=>b.setAttribute('aria-pressed',String(b===row)));
};
for(const id of ['cmpMine','cmpOpponent']) {
  $(id).onclick=ev=>{const button=ev.target.closest('[data-choose]');if(button)chooseCompareSpecies(button.dataset.choose);};
  $(id).oninput=ev=>{
    const key=ev.target.dataset.cmpK;if(!key)return;
    const side=$(id).dataset.cmpSide;let value=ev.target.value;
    if(['sp','align','stage','priority'].includes(key)){if(value==='')return;value=Number(value);if(!Number.isInteger(value))return;if(key==='sp'){value=Engine.clampSp(value);ev.target.value=String(value);}}
    if(key==='para')value=value==='true';
    S.compare[side].spec[key]=value;
    if(side==='opponent'){S.compare.preset='custom';$('cmpPreset').value='custom';}
    save();renderMatchup();renderCompareRoster();
  };
}
