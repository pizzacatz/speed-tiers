#!/usr/bin/env python3
"""Build the standalone app from the committed champions-logic MCP snapshot (no dependencies)."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent

def build():
    data = json.loads((ROOT / 'data/roster.json').read_text())
    data['meta']['built'] = data['meta']['dataBuiltAt'][:10]
    blob = json.dumps(data, separators=(',', ':'), ensure_ascii=False).replace('</', '<\\/')
    output = (ROOT / 'src/app.html').read_text()
    for marker, content in [('DATA', blob), ('ENGINE', (ROOT / 'src/engine.js').read_text()),
                            ('STATE', (ROOT / 'src/state.js').read_text())]:
        output = output.replace('/*__' + marker + '__*/', content)
    return output

if __name__ == '__main__':
    output = build()
    (ROOT / 'speed-tiers.html').write_text(output)
    print(f'Built speed-tiers.html ({len(output.encode()) // 1024} KB)')
