#!/usr/bin/env python3
"""Generate the offline multi-benchmark mockup without changing the production app."""
import json
from pathlib import Path
ROOT = Path(__file__).resolve().parent
REPO = ROOT.parent

def build():
    data = json.loads((REPO / 'data/roster.json').read_text())
    blob = json.dumps({k: data[k] for k in ('meta', 'entities', 'abilities', 'sprites')}, ensure_ascii=False, separators=(',', ':')).replace('</', '<\\/')
    content = (ROOT / 'src/index.html').read_text()
    parts = {'STYLE': (ROOT / 'src/app.css').read_text(), 'APP': (ROOT / 'src/app.js').read_text(),
             'ENGINE': (REPO / 'src/engine.js').read_text(), 'DATA': blob}
    for key, value in parts.items():
        content = content.replace('/*__' + key + '__*/', value)
    return content

if __name__ == '__main__':
    output = build()
    (ROOT / 'speed-lab.html').write_text(output)
    print(f'Built multi-benchmark mockup ({len(output.encode()) // 1024} KB)')
