/* ===== Speed engine (pure) — Pokémon Champions Regulation M-B =====
 * Speed = floor((Base + 20 + SP) × alignMult), SP 0..32, align ∈ {-1,0,+1} → ×0.9/×1.0/×1.1
 * Modifiers, flooring after each: stage → ability → item → tailwind → paralysis
 */
const Engine = (() => {
  const DEFAULT_SPEC = Object.freeze({
    sp: 0, align: 0, stage: 0, item: 'none', abil: 'auto', tailwind: false, para: false, priority: 0, side: null
  });
  const ITEMS = { none: 1, scarf: 1.5, ironball: 0.5, powder: 2 };
  const ITEM_LABEL = { none: '—', scarf: 'Choice Scarf', ironball: 'Iron Ball', powder: 'Quick Powder' };
  const STAGE_MULT = s => (s >= 0 ? (2 + s) / 2 : 2 / (2 - s));
  const ALIGN_MULT = a => (a > 0 ? 1.1 : a < 0 ? 0.9 : 1);
  const clampSp = v => Math.max(0, Math.min(32, v | 0));

  function merge(...layers) {
    const out = { ...DEFAULT_SPEC };
    for (const l of layers) if (l) for (const k in l) if (l[k] !== undefined && l[k] !== null && k in DEFAULT_SPEC) out[k] = l[k];
    return out;
  }
  function baseSpeed(base, sp, align) {
    return Math.floor((base + 20 + clampSp(sp)) * ALIGN_MULT(align) + 1e-9);
  }
  /** Which speed ability (if any) is active for this entity/spec/field. Returns {slug,mult}|null */
  function activeAbility(entity, spec, field, ABILITIES) {
    if (spec.abil === 'off') return null;
    for (const slug of entity.abil || []) {
      const a = ABILITIES[slug]; if (!a) continue;
      if (spec.abil === 'on') return { slug, mult: a.mult };
      if (a.cond && field && condMet(a.cond, field)) return { slug, mult: a.mult };
    }
    return null;
  }
  function condMet(cond, field) {
    if (cond === 'eterrain') return !!field.eterrain;
    return field.weather === cond;
  }
  function tailwindOn(spec, field) {
    if (spec.tailwind) return true;
    return !!(spec.side && field && field.tailwind && field.tailwind[spec.side]);
  }
  /** Full breakdown for a resolved spec */
  function compute(entity, spec, field, ABILITIES) {
    const steps = [];
    let v = baseSpeed(entity.spe, spec.sp, spec.align);
    steps.push({ label: `Base ${entity.spe}+20+${clampSp(spec.sp)} SP ×${ALIGN_MULT(spec.align)}`, value: v });
    if (spec.stage) { v = Math.floor(v * STAGE_MULT(spec.stage) + 1e-9); steps.push({ label: `Stage ${spec.stage > 0 ? '+' : ''}${spec.stage}`, value: v }); }
    const ab = activeAbility(entity, spec, field, ABILITIES);
    if (ab) { v = Math.floor(v * ab.mult + 1e-9); steps.push({ label: `${ABILITIES[ab.slug].name} ×${ab.mult}`, value: v }); }
    const im = ITEMS[spec.item] ?? 1;
    if (im !== 1) { v = Math.floor(v * im + 1e-9); steps.push({ label: `${ITEM_LABEL[spec.item]} ×${im}`, value: v }); }
    if (tailwindOn(spec, field)) { v = Math.floor(v * 2 + 1e-9); steps.push({ label: 'Tailwind ×2', value: v }); }
    if (spec.para) { v = Math.floor(v * 0.5 + 1e-9); steps.push({ label: 'Paralysis ×0.5', value: v }); }
    return { speed: v, steps, priority: spec.priority | 0, ability: ab };
  }
  /** Sort key: priority desc, then speed (desc normally, asc under Trick Room). Returns comparator. */
  function comparator(trickRoom) {
    return (a, b) => (b.priority - a.priority) || (trickRoom ? a.speed - b.speed : b.speed - a.speed);
  }
  /** Relationship of A vs B on a given field: 'faster' | 'tie' | 'slower' from A's perspective */
  function relation(a, b, trickRoom) {
    if (a.priority !== b.priority) return a.priority > b.priority ? 'faster' : 'slower';
    if (a.speed === b.speed) return 'tie';
    const aFirst = trickRoom ? a.speed < b.speed : a.speed > b.speed;
    return aFirst ? 'faster' : 'slower';
  }
  /** Reverse-solve: minimal tweaks for `entity` (spec) to strictly beat `target` speed. */
  function solve(entity, spec, field, ABILITIES, target, trickRoom) {
    const beats = s => (trickRoom ? s < target : s > target);
    const out = [];
    const cur = compute(entity, spec, field, ABILITIES).speed;
    if (beats(cur)) return [{ label: 'already outspeeds', ok: true }];
    if (!trickRoom) {
      for (let sp = spec.sp + 1; sp <= 32; sp++) { if (beats(compute(entity, { ...spec, sp }, field, ABILITIES).speed)) { out.push({ label: `SP ≥ ${sp}` }); break; } }
      if (spec.align < 1) for (let sp = 0; sp <= 32; sp++) { if (beats(compute(entity, { ...spec, sp, align: 1 }, field, ABILITIES).speed)) { out.push({ label: `+Spe alignment, SP ≥ ${sp}` }); break; } }
      if (spec.item !== 'scarf') { const s = compute(entity, { ...spec, item: 'scarf' }, field, ABILITIES).speed; if (beats(s)) out.push({ label: `Choice Scarf (${s})` }); }
      for (let st = spec.stage + 1; st <= 6; st++) { const s = compute(entity, { ...spec, stage: st }, field, ABILITIES).speed; if (beats(s)) { out.push({ label: `Stage +${st} (${s})` }); break; } }
      if (!tailwindOn(spec, field)) { const s = compute(entity, { ...spec, tailwind: true }, field, ABILITIES).speed; if (beats(s)) out.push({ label: `Tailwind (${s})` }); }
    } else {
      for (let sp = spec.sp - 1; sp >= 0; sp--) { if (beats(compute(entity, { ...spec, sp }, field, ABILITIES).speed)) { out.push({ label: `SP ≤ ${sp}` }); break; } }
      if (spec.align > -1) for (let sp = 32; sp >= 0; sp--) { if (beats(compute(entity, { ...spec, sp, align: -1 }, field, ABILITIES).speed)) { out.push({ label: `−Spe alignment, SP ≤ ${sp}` }); break; } }
      if (spec.item !== 'ironball') { const s = compute(entity, { ...spec, item: 'ironball' }, field, ABILITIES).speed; if (beats(s)) out.push({ label: `Iron Ball (${s})` }); }
      for (let st = spec.stage - 1; st >= -6; st--) { const s = compute(entity, { ...spec, stage: st }, field, ABILITIES).speed; if (beats(s)) { out.push({ label: `Stage ${st} (${s})` }); break; } }
    }
    if (!out.length) out.push({ label: 'cannot outspeed with speed tweaks alone (needs priority)' });
    return out;
  }
  return { DEFAULT_SPEC, ITEMS, ITEM_LABEL, merge, baseSpeed, compute, comparator, relation, solve, activeAbility, tailwindOn, clampSp };
})();
if (typeof module !== 'undefined') module.exports = Engine;
