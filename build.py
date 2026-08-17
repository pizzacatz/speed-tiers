#!/usr/bin/env python3
"""Build speed-tiers.html: pull legal M-B species/Megas + speed-relevant abilities from the
champions_logic SQLite DB, embed downscaled menu sprites as data URIs, inline engine.js, and
inject everything into src/app.html -> speed-tiers.html (single offline file)."""
import base64, io, json, os, sqlite3, sys, datetime
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
CL_ROOT = os.environ.get("CHAMPIONS_LOGIC_ROOT",
          os.path.join(os.path.dirname(HERE), "champions_logic"))
DB = os.path.join(CL_ROOT, "data", "champions_logic.db")
SPRITE_PX = 56
REG = "M-B"

# Speed-modifying abilities the engine understands. cond = field condition that auto-activates it.
SPEED_ABILITIES = {
    "chlorophyll":  {"mult": 2,   "cond": "sun"},
    "swift-swim":   {"mult": 2,   "cond": "rain"},
    "sand-rush":    {"mult": 2,   "cond": "sand"},
    "slush-rush":   {"mult": 2,   "cond": "snow"},
    "surge-surfer": {"mult": 2,   "cond": "eterrain"},
    "unburden":     {"mult": 2,   "cond": None},
    "quick-feet":   {"mult": 1.5, "cond": None},
    "slow-start":   {"mult": 0.5, "cond": None},
    "protosynthesis": {"mult": 1.5, "cond": None},
    "quark-drive":  {"mult": 1.5, "cond": None},
}

def sprite_uri(path):
    if not path: return None
    full = os.path.join(CL_ROOT, path)
    if not os.path.exists(full): return None
    im = Image.open(full).convert("RGBA")
    bbox = im.getbbox()
    if bbox: im = im.crop(bbox)
    im.thumbnail((SPRITE_PX, SPRITE_PX), Image.LANCZOS)
    canvas = Image.new("RGBA", (SPRITE_PX, SPRITE_PX), (0, 0, 0, 0))
    canvas.paste(im, ((SPRITE_PX - im.width) // 2, (SPRITE_PX - im.height) // 2))
    b = io.BytesIO(); canvas.save(b, "WEBP", quality=85, method=6)
    return "data:image/webp;base64," + base64.b64encode(b.getvalue()).decode()

def main():
    con = sqlite3.connect(DB); con.row_factory = sqlite3.Row
    meta = {r["key"]: r["value"] for r in con.execute("select * from meta")}
    align = [dict(r) for r in con.execute("select alignment, raises, lowers from stat_alignment order by alignment")]
    sprites = {}
    for r in con.execute("select entity_kind, entity_slug, variant, path from sprite where variant in ('menu','shiny_menu','front')"):
        sprites.setdefault((r["entity_kind"], r["entity_slug"]), {})[r["variant"]] = r["path"]
    abil = {}
    for r in con.execute("select species_slug, ability_slug, slot from species_ability order by slot"):
        abil.setdefault(r["species_slug"], []).append(r["ability_slug"])
    ab_names = {r["slug"]: r["name"] for r in con.execute("select slug,name from ability")}

    entities, uris, uri_index = [], [], {}
    def add_sprite(kind, slug, fallbacks=()):
        s = sprites.get((kind, slug), {})
        path = s.get("menu") or s.get("shiny_menu") or s.get("front")
        for fk, fs in fallbacks:
            if path: break
            if isinstance(fs, str) and fs.startswith("sprites/"):   # direct repo-relative path guess
                if os.path.exists(os.path.join(CL_ROOT, fs)): path = fs
                continue
            f = sprites.get((fk, fs), {}); path = f.get("menu") or f.get("shiny_menu") or f.get("front")
        if path is None: return -1
        if path not in uri_index:
            u = sprite_uri(path)
            if u is None: return -1
            uri_index[path] = len(uris); uris.append(u)
        return uri_index[path]

    for r in con.execute("select * from species where regulation=? order by national_dex, slug", (REG,)):
        entities.append({
            "id": r["slug"], "name": r["name"], "dex": r["national_dex"],
            "types": [t for t in (r["type1"], r["type2"]) if t],
            "spe": r["spe"], "abil": [a for a in abil.get(r["slug"], []) if a in SPEED_ABILITIES],
            "allAbil": [ab_names.get(a, a) for a in abil.get(r["slug"], [])],
            "mega": None, "sprite": add_sprite("species", r["slug"], [
                # female formes (e.g. meowsticf/basculegionf) exist on disk as <dex>-female.png but are not in the sprite table
                ("path", f"sprites/menu/{r['national_dex']}-female.png"), ("path", f"sprites/species/{r['national_dex']}-female.png"),
                ("species", r["slug"][:-1] if r["slug"].endswith("f") else r["slug"])] if r["slug"].endswith("f") else []),
        })
    for r in con.execute("select * from mega_evolution where regulation=? order by base_slug, slug", (REG,)):
        entities.append({
            "id": r["slug"], "name": r["name"], "dex": None,
            "types": [t for t in (r["type1"], r["type2"]) if t],
            "spe": r["spe"], "abil": [r["ability_slug"]] if r["ability_slug"] in SPEED_ABILITIES else [],
            "allAbil": [r["ability_name"]] if r["ability_name"] else [],
            "mega": r["base_slug"], "stone": r["mega_stone"], "sprite": add_sprite("mega", r["slug"], [("species", r["base_slug"])]),
        })
    # dex for megas = base dex (for sorting)
    dex_of = {e["id"]: e["dex"] for e in entities if e["mega"] is None}
    for e in entities:
        if e["mega"]: e["dex"] = dex_of.get(e["mega"])

    data = {
        "meta": {"regulation": REG, "dataVersion": meta.get("data_version"),
                 "dataRevision": meta.get("data_revision"),
                 "built": datetime.date.today().isoformat(),
                 "species": sum(1 for e in entities if not e["mega"]),
                 "megas": sum(1 for e in entities if e["mega"])},
        "abilities": {k: {**v, "name": ab_names.get(k, k.replace("-", " ").title())} for k, v in SPEED_ABILITIES.items()},
        "alignments": align,
        "entities": entities, "sprites": uris,
    }
    with open(os.path.join(HERE, "src", "engine.js")) as f: engine = f.read()
    with open(os.path.join(HERE, "src", "app.html")) as f: tpl = f.read()
    blob = json.dumps(data, separators=(",", ":")).replace("</", "<\\/")
    out = tpl.replace("/*__ENGINE__*/", engine).replace("/*__DATA__*/", blob)
    dest = os.path.join(HERE, "speed-tiers.html")
    with open(dest, "w") as f: f.write(out)
    missing = [e["name"] for e in entities if e["sprite"] < 0]
    print(f"wrote {dest} ({os.path.getsize(dest)//1024} KB) — {data['meta']['species']} species, "
          f"{data['meta']['megas']} megas, {len(uris)} sprites, rev {data['meta']['dataRevision']}")
    if missing: print("no sprite:", missing)

if __name__ == "__main__": main()
