#!/usr/bin/env python3
"""Cheap release guard; full topological reproduction lives in audit_tiles.py/tests."""
from pathlib import Path
import json
root=Path(__file__).resolve().parents[1]
m=json.loads((root/'public/maps/district/manifest.json').read_text());a=json.loads((root/'data/NETWORK_CONNECTIVITY.json').read_text())
assert m['selection']['mode']=='all-eligible-source-roads'
assert a['sourceSha256']==m['source']['sha256']
assert a['tiles']==len(m['tiles']) and a['uniqueMotorWays']==m['stats']['integratedWays']
assert a['roadFragments']==sum(t['roads'] for t in m['tiles'].values())
assert a['sharedNodeCoordinateConflicts']==0 and a['weakComponents']==a['sourceWeakComponents']
print(f"Full uploaded road coverage: {a['uniqueMotorWays']} ways, {a['weakComponents']} preserved source components.")
