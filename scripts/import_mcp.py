#!/usr/bin/env python3
"""Convert a captured champions-logic typed-tool export to the offline roster.
Input: {meta, species:[species_info results], alignments, abilities:[ability_info], items:[item_info], assetsRoot}.
Sprite paths are supplied by MCP; only sprite files are read from its assets root.
"""
import base64
import io
import json
import pathlib
import sys
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parent.parent
source = json.loads(pathlib.Path(sys.argv[1]).read_text())
assets = pathlib.Path(source['assetsRoot'])
conditions = {'chlorophyll': 'sun', 'swift-swim': 'rain', 'sand-rush': 'sand',
              'slush-rush': 'snow', 'surge-surfer': 'eterrain', 'unburden': None, 'quick-feet': 'status'}
abilities = {a['slug']: {'name': a['name'], 'description': a['short_desc'],
             'mult': 1.5 if a['slug'] == 'quick-feet' else 2, 'cond': conditions[a['slug']]}
             for a in source['abilities'] if a['slug'] in conditions}
ability_slugs = {a['name']: a['slug'] for a in source['abilities']}
sprites, sprite_indices = [], {}

def sprite(paths, fallback=None):
    path = next((paths[k] for k in ('menu', 'shiny_menu', 'front') if paths.get(k) and (assets / paths[k]).is_file()), None)
    if not path:
        return fallback if fallback is not None else -1
    if path not in sprite_indices:
        im = Image.open(assets / path).convert('RGBA')
        if im.getbbox():
            im = im.crop(im.getbbox())
        im.thumbnail((56, 56), Image.Resampling.LANCZOS)
        canvas = Image.new('RGBA', (56, 56), (0, 0, 0, 0))
        canvas.paste(im, ((56 - im.width) // 2, (56 - im.height) // 2))
        output = io.BytesIO()
        canvas.save(output, 'WEBP', quality=85, method=6)
        sprite_indices[path] = len(sprites)
        sprites.append('data:image/webp;base64,' + base64.b64encode(output.getvalue()).decode())
    return sprite_indices[path]

entities = []
for s in source['species']:
    assert s['found'], s
    base_sprite = sprite(s['sprites'])
    entities.append({'id': s['slug'], 'name': s['name'], 'dex': s['national_dex'], 'types': s['types'],
        'spe': s['base_stats']['spe'], 'abil': [a['slug'] for a in s['abilities'] if a['slug'] in abilities],
        'allAbil': [a['name'] for a in s['abilities']], 'mega': None, 'sprite': base_sprite})
    for m in s['mega_evolutions']:
        a = ability_slugs.get(m['ability_name'])
        entities.append({'id': m['slug'], 'name': m['name'], 'dex': s['national_dex'], 'types': m['types'],
            'spe': m['base_stats']['spe'], 'abil': [a] if a in abilities else [],
            'allAbil': [m['ability_name']], 'mega': s['slug'], 'stone': m['mega_stone'],
            'sprite': sprite(m['sprites'], base_sprite)})
assert len({e['id'] for e in entities}) == len(entities)
# Retain the original catalogue so migration adds new species without restoring deliberately removed rows.
previous_file = ROOT / 'data/roster.json'
if previous_file.exists():
    previous = json.loads(previous_file.read_text())['previousEntities']
else:
    import re
    old = json.loads(re.search(r'<script type="application/json" id="data">(.*?)</script>', (ROOT / 'speed-tiers.html').read_text(), re.S)[1])
    previous = [e['id'] for e in old['entities']]
meta = {**source['meta'], 'species': len(source['species']), 'megas': sum(bool(e['mega']) for e in entities)}
result = {'meta': meta, 'abilities': abilities, 'alignments': source['alignments'], 'entities': entities,
          'sprites': sprites, 'previousEntities': previous}
previous_file.write_text(json.dumps(result, separators=(',', ':'), ensure_ascii=False) + '\n')
print(f"MCP {meta['dataRevision']}: {meta['species']} species + {meta['megas']} Megas; {len(sprites)} sprites")
missing = [e['name'] for e in entities if e['sprite'] < 0]
if missing: print('Missing sprites:', ', '.join(missing))
