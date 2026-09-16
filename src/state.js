/* Validate untrusted imports/links before they reach HTML, calculations, or storage. */
const StateModel = (() => {
  const fail = message => { throw new Error(message); };
  const obj = (v, name) => { if (!v || typeof v !== 'object' || Array.isArray(v)) fail(`${name} must be an object.`); return v; };
  const arr = (v, name, max) => { if (!Array.isArray(v) || v.length > max) fail(`${name} must be a list of at most ${max}.`); return v; };
  const str = (v, name, max = 160) => { if (typeof v !== 'string' || v.length > max) fail(`${name} must be text (up to ${max} characters).`); return v; };
  const id = v => { if (typeof v !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(v) || ['__proto__', 'constructor', 'prototype'].includes(v)) fail('Invalid identifier.'); return v; };
  const bool = v => { if (typeof v !== 'boolean') fail('Expected true or false.'); return v; };
  const choice = (v, values) => values.includes(v) ? v : fail('Invalid setting value.');
  const integer = (v, min, max) => Number.isInteger(v) && v >= min && v <= max ? v : fail(`Expected an integer from ${min} to ${max}.`);
  const color = v => typeof v === 'string' && /^#[a-f0-9]{6}$/i.test(v) ? v : fail('Invalid color.');
  const unique = (list, name) => { if (new Set(list.map(x => x.id)).size !== list.length) fail(`Duplicate ${name} identifiers.`); return list; };
  const COLORS = ['#a78bfa', '#34d399', '#f59e0b', '#38bdf8'];

  function normalize(input, data) {
    obj(input, 'Setup');
    choice(input.v, [1, 2]);
    const legacy = input.v === 1;
    const warnings = [];
    const entities = new Map(data.entities.map(e => [e.id, e]));
    const spec = value => {
      obj(value, 'Speed settings');
      const out = {};
      for (const [k, v] of Object.entries(value)) {
        if (v === null || v === undefined) continue;
        switch (k) {
          case 'sp': out[k] = integer(v, 0, 32); break;
          case 'align': out[k] = integer(v, -1, 1); break;
          case 'stage': out[k] = integer(v, -6, 6); break;
          case 'priority': out[k] = integer(v, -7, 5); break;
          case 'item':
            if (legacy && v === 'powder') { out[k] = 'none'; warnings.push('Quick Powder was removed because it is not legal in the current regulation.'); }
            else out[k] = choice(v, ['none', 'scarf', 'ironball']);
            break;
          case 'abil': out[k] = choice(v, ['auto', 'on', 'off', ...Object.keys(data.abilities)]); break;
          case 'side': out[k] = choice(v, ['', 'A', 'B']); break;
          case 'tailwind': case 'para': out[k] = bool(v); break;
          default: fail(`Unknown Speed setting: ${k}.`);
        }
      }
      return out;
    };
    const field = obj(input.field, 'Field');
    const wind = obj(field.tailwind, 'Tailwind');
    const filters = obj(input.filters, 'Filters');
    const columns = unique(arr(input.columns, 'Columns', 32).map(c => ({id: id(c.id), label: str(c.label, 'Column name'), spec: spec(c.spec), visible: bool(c.visible)})), 'column');
    if (!columns.length) fail('Keep at least one column.');
    if (!columns.some(c => c.visible)) { columns[0].visible = true; warnings.push('The first column was shown because all columns were hidden.'); }
    const tags = unique(arr(input.tags, 'Tags', 64).map(t => ({id: id(t.id), name: str(t.name, 'Tag name'), color: color(t.color), defaults: spec(t.defaults)})), 'tag');
    const tagIds = new Set(tags.map(t => t.id));
    const tagList = value => [...new Set(arr(value, 'Tag references', 64).map(t => { id(t); if (!tagIds.has(t)) fail('A row or filter refers to an unknown tag.'); return t; }))];
    let rows = unique(arr(input.rows, 'Rows', 2000).map(r => ({id: id(r.id), ent: id(r.ent), tags: tagList(r.tags), ov: spec(r.ov)})), 'row');
    const oldRowIds = new Set(rows.map(r => r.id));
    const removed = rows.filter(r => !entities.has(r.ent)).length;
    rows = rows.filter(r => entities.has(r.ent));
    if (removed) warnings.push(`${removed} unavailable roster rows were removed.`);
    const oldCatalogue = new Set(arr(input.catalogue ?? (legacy ? data.previousEntities : []), 'Catalogue', 2000).map(id));
    if (!legacy && !input.catalogue) fail('Missing roster catalogue.');
    const present = new Set(rows.map(r => r.ent));
    let added = 0;
    for (const e of data.entities) if (!oldCatalogue.has(e.id) && !present.has(e.id)) {
      let rowId = `new_${e.id}`;
      while (rows.some(r => r.id === rowId)) rowId = `n_${rowId}`;
      rows.push({id: rowId, ent: e.id, tags: [], ov: {}}); added++;
    }
    if (rows.length > 2000) fail('This roster update would exceed 2,000 rows. Remove some duplicates before importing.');
    if (added) warnings.push(`${added} new species/forms added to your roster.`);
    const rowIds = new Set(rows.map(r => r.id));
    const anchors = unique(arr(input.anchors, 'Anchors', 32).map((a, i) => {
      if (!oldRowIds.has(id(a.rowId))) fail('An anchor refers to an unknown row.');
      return {id: id(a.id), rowId: a.rowId, spec: spec(a.spec), color: color(a.color ?? COLORS[i % COLORS.length]), collapsed: bool(a.collapsed ?? false)};
    }), 'anchor').filter(a => rowIds.has(a.rowId));
    const targets = unique(arr(input.targets ?? [], 'Targets', 64).map(t => ({
      id: id(t.id), ent: id(t.ent), rowId: t.rowId == null ? null : id(t.rowId), colId: t.colId == null ? null : id(t.colId),
      label: str(t.label, 'Target label', 300), spec: spec(t.spec)
    })), 'target').filter(t => entities.has(t.ent));
    for (const t of targets) {
      if (!rowIds.has(t.rowId)) t.rowId = null;
      if (!columns.some(c => c.id === t.colId)) t.colId = null;
    }
    const widths = {};
    for (const [k, v] of Object.entries(obj(input.colWidths ?? {}, 'Column widths'))) {
      id(k); widths[k] = integer(v, 40, 2000);
    }
    const sortCol = columns.find(c => c.id === input.sortCol && c.visible)?.id ?? columns.find(c => c.visible).id;
    const state = {
      v: 2, catalogue: data.entities.map(e => e.id), dataRevision: data.meta.dataRevision,
      name: str(input.name ?? 'Untitled setup', 'Setup name', 80),
      field: {weather: choice(field.weather, [null, 'sun', 'rain', 'sand', 'snow']), eterrain: bool(field.eterrain), trickRoom: bool(field.trickRoom), tailwind: {A: bool(wind.A), B: bool(wind.B)}},
      global: spec(input.global), columns, sortCol, tags, rows, anchors, targets,
      filters: {search: str(filters.search, 'Search', 160), tags: tagList(filters.tags), mode: choice(filters.mode, ['any', 'all']), onlyTagged: bool(filters.onlyTagged), megas: bool(filters.megas)},
      theme: choice(input.theme, ['auto', 'dark', 'light']), colWidths: widths,
      guideDismissed: bool(input.guideDismissed ?? false)
    };
    return {state, warnings: [...new Set(warnings)]};
  }

  // Compact tuples keep a full roster share link much smaller than the JSON backup.
  function pack(s) {
    return {format: 'speed-tiers-link', version: 1, state: {...s, rows: s.rows.map(r => [r.id, r.ent, r.tags, r.ov])}};
  }
  function unpack(payload, data) {
    obj(payload, 'Shared setup');
    if (payload.format !== 'speed-tiers-link' || payload.version !== 1) fail('Unsupported share link.');
    const state = obj(payload.state, 'Shared state');
    return normalize({...state, rows: arr(state.rows, 'Rows', 2000).map(r => {
      if (!Array.isArray(r) || r.length !== 4) fail('Invalid shared row.');
      return {id: r[0], ent: r[1], tags: r[2], ov: r[3]};
    })}, data);
  }
  return {normalize, pack, unpack};
})();
if (typeof module !== 'undefined') module.exports = StateModel;

/* URL fragments stay in the browser; no server or account is needed to share a setup. */
const ShareCodec = (() => {
  const MAX_BYTES = 1000000;
  async function transform(bytes, stream) {
    const reader = new Blob([bytes]).stream().pipeThrough(stream).getReader();
    const chunks = []; let length = 0;
    try {
      while (true) {
        const {value, done} = await reader.read(); if (done) break;
        length += value.length;
        if (length > MAX_BYTES) { await reader.cancel(); throw new Error('Shared setup is too large.'); }
        chunks.push(value);
      }
    } finally { reader.releaseLock(); }
    const result = new Uint8Array(length); let offset = 0;
    for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length; }
    return result;
  }
  async function encode(payload) {
    let bytes = new TextEncoder().encode(JSON.stringify(payload));
    if (bytes.length > MAX_BYTES) throw new Error('This setup is too large for a link. Use Export instead.');
    const compressed = typeof CompressionStream !== 'undefined';
    if (compressed) bytes = await transform(bytes, new CompressionStream('gzip'));
    let binary = ''; for (const b of bytes) binary += String.fromCharCode(b);
    const code = (compressed ? 'gz.' : 'json.') + btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    if (code.length > 64000) throw new Error('This setup is too large for a link. Use Export instead.');
    return code;
  }
  async function decode(code) {
    if (typeof code !== 'string' || code.length > 64000 || !/^(gz|json)\.[A-Za-z0-9_-]+$/.test(code)) throw new Error('Invalid share link.');
    const [format, encoded] = code.split('.');
    let bytes = Uint8Array.from(atob(encoded.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
    if (format === 'gz') {
      if (typeof DecompressionStream === 'undefined') throw new Error('This browser cannot open compressed links. Use a recent browser or import a JSON export.');
      bytes = await transform(bytes, new DecompressionStream('gzip'));
    }
    if (bytes.length > MAX_BYTES) throw new Error('Shared setup is too large.');
    return JSON.parse(new TextDecoder('utf-8', {fatal: true}).decode(bytes));
  }
  return {encode, decode};
})();
if (typeof module !== 'undefined') module.exports.ShareCodec = ShareCodec;
