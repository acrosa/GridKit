#!/usr/bin/env python3
"""GridKit grid spec: load, resolve and print grid geometry for a viewport.

The math is a port of Sources/GridKit/Geometry/GridGeometry.swift (and
web/src/geometry/GridGeometry.ts), so numbers match what the GridKit overlay
draws. Standard library only.

    gridspec.py presets [--platform ios|web]
    gridspec.py init --platform web --preset swiss-12-column [--out .gridkit/spec.json]
    gridspec.py resolve --spec .gridkit/spec.json --width 393 [--height 852]
                        [--safe-top 59 --safe-bottom 34] [--size-class compact]
    gridspec.py check-values --spec .gridkit/spec.json 12 13 20 24
"""
from __future__ import annotations

import argparse
import copy
import json
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
PRESETS_PATH = os.path.join(HERE, "..", "assets", "presets.json")

DEFAULT_COMPACT_BREAKPOINT_WEB = 768
# iOS has no width breakpoint — it uses the horizontal size class. Below this
# width we assume compact (all iPhones in portrait, iPad slide-over/split).
DEFAULT_COMPACT_WIDTH_IOS = 600

LAYER_KEYS = ("columns", "rows", "baseline", "keyLines", "modularScale", "respectsSafeArea", "maxContentWidth")


# MARK: - Loading


def load_presets() -> list[dict]:
    with open(PRESETS_PATH) as f:
        return json.load(f)["presets"]


def preset_by_id(preset_id: str) -> dict:
    for p in load_presets():
        if p["id"] == preset_id:
            return p
    ids = ", ".join(p["id"] for p in load_presets())
    raise SystemExit(f"Unknown preset '{preset_id}'. Known presets: {ids}")


def _preset_variants(preset: dict, platform: str) -> tuple[dict, dict | None]:
    override = preset.get(platform, {})
    regular = override.get("regular", preset.get("regular", {}))
    compact = override.get("compact", preset.get("compact") if "regular" not in override else None)
    return copy.deepcopy(regular), copy.deepcopy(compact)


def _merge(base: dict | None, override: dict | None) -> dict:
    """Layer-wise merge: dict layers merge key-by-key, everything else replaces;
    an explicit null removes the layer."""
    out = copy.deepcopy(base or {})
    for key, value in (override or {}).items():
        if value is None:
            out.pop(key, None)
        elif isinstance(value, dict) and isinstance(out.get(key), dict):
            out[key] = {**out[key], **value}
        else:
            out[key] = copy.deepcopy(value)
    return out


def _normalize_config(cfg: dict) -> dict:
    """Applies the same decoding defaults as GridConfiguration(from:)."""
    cfg = copy.deepcopy(cfg)
    cols = cfg.get("columns")
    if cols:
        margin = cols.pop("margin", None)
        cols.setdefault("gutter", 16)
        cols.setdefault("leadingMargin", 16 if margin is None else margin)
        cols.setdefault("trailingMargin", cols["leadingMargin"])
    rows = cfg.get("rows")
    if rows:
        margin = rows.pop("margin", None)
        rows.setdefault("gutter", 16)
        rows.setdefault("topMargin", 16 if margin is None else margin)
        rows.setdefault("bottomMargin", rows["topMargin"])
    base = cfg.get("baseline")
    if base:
        base.setdefault("offset", 0)
    for line in cfg.get("keyLines", []) or []:
        line.setdefault("name", "Guide")
        line.setdefault("anchor", "start")
        line.setdefault("unit", "points")
    cfg.setdefault("keyLines", [])
    cfg.setdefault("respectsSafeArea", True)
    return cfg


def load_spec(path: str) -> dict:
    """Loads a .gridkit/spec.json — or a bare GridKit configuration JSON such
    as Examples/brand-grid.json — into a normalized spec dict."""
    with open(path) as f:
        raw = json.load(f)
    return normalize_spec(raw)


def normalize_spec(raw: dict) -> dict:
    is_bare_config = "regular" not in raw and "preset" not in raw and any(k in raw for k in ("columns", "rows", "baseline", "keyLines"))
    if is_bare_config:
        raw = {"regular": {k: v for k, v in raw.items() if k in LAYER_KEYS}}

    platform = raw.get("platform", "web")
    regular: dict = {}
    compact: dict | None = None
    if raw.get("preset"):
        regular, compact = _preset_variants(preset_by_id(raw["preset"]), platform)

    regular = _merge(regular, raw.get("regular"))
    if "compact" in raw:
        compact = None if raw["compact"] is None else _merge(compact or regular, raw["compact"])
    elif compact is not None and raw.get("regular"):
        # Spec tweaked the regular variant (e.g. gutter); carry the same tweak
        # into the preset's compact variant except for column count.
        tweak = copy.deepcopy(raw["regular"])
        if isinstance(tweak.get("columns"), dict):
            tweak["columns"].pop("count", None)
        compact = _merge(compact, tweak)

    spacing = raw.get("spacing") or {}
    spec = {
        "platform": platform,
        "preset": raw.get("preset"),
        "regular": _normalize_config(regular),
        "compact": _normalize_config(compact) if compact is not None else None,
        "compactBreakpoint": raw.get("compactBreakpoint", DEFAULT_COMPACT_BREAKPOINT_WEB if platform == "web" else DEFAULT_COMPACT_WIDTH_IOS),
        "spacing": {
            "base": spacing.get("base"),
            "scale": spacing.get("scale"),
            "allow": spacing.get("allow", [0, 1]),
        },
        "tolerance": raw.get("tolerance", 1),
        "rem": raw.get("rem", 16),
        "typeScale": raw.get("typeScale"),
        "targets": raw.get("targets", []),
        "raw": raw,
    }
    if spec["spacing"]["base"] is None and not spec["spacing"]["scale"]:
        spec["spacing"]["base"] = 4
    # The grid's own gutters and margins are always legitimate spacing values.
    grid_values = set(spec["spacing"]["allow"])
    for cfg in (spec["regular"], spec["compact"]):
        for layer, keys in (("columns", ("gutter", "leadingMargin", "trailingMargin")), ("rows", ("gutter", "topMargin", "bottomMargin"))):
            for k in keys:
                if cfg and cfg.get(layer):
                    grid_values.add(cfg[layer][k])
    spec["spacing"]["allow"] = sorted(grid_values)
    return spec


# MARK: - Geometry (port of GridGeometry)


def content_span(total, start_margin, end_margin, safe_start, safe_end, respects_safe_area):
    start = start_margin + (safe_start if respects_safe_area else 0)
    end = total - end_margin - (safe_end if respects_safe_area else 0)
    return (start, end) if end > start else None


def track_frames(total, count, gutter, start_margin, end_margin, safe_start, safe_end, respects, max_extent=None):
    if count <= 0:
        return None
    span = content_span(total, start_margin, end_margin, safe_start, safe_end, respects)
    if span is None:
        return None
    start, end = span
    if max_extent and end - start > max_extent:
        inset = (end - start - max_extent) / 2
        start, end = start + inset, end - inset
    size = (end - start - gutter * (count - 1)) / count
    if size <= 0:
        return None
    frames = [(start + i * (size + gutter), size) for i in range(count)]
    return {"start": start, "end": end, "size": size, "frames": frames}


def baselines(height, rhythm, offset, top_inset=0.0):
    if rhythm <= 0.5:
        return []
    out, y = [], top_inset + offset
    while y <= height + 0.001:
        out.append(y)
        y += rhythm
    return out


def key_line_position(line, width, height, safe, respects):
    horizontal = line["axis"] == "horizontal"
    extent = height if horizontal else width
    if respects:
        start_inset = safe["top"] if horizontal else safe["leading"]
        end_inset = safe["bottom"] if horizontal else safe["trailing"]
    else:
        start_inset = end_inset = 0
    available = extent - start_inset - end_inset
    distance = line["offset"] * available if line["unit"] == "fraction" else line["offset"]
    return start_inset + distance if line["anchor"] == "start" else extent - end_inset - distance


def pick_variant(spec: dict, width: float, size_class: str | None = None) -> str:
    if spec["compact"] is None:
        return "regular"
    if size_class in ("compact", "regular"):
        return size_class
    return "compact" if width < spec["compactBreakpoint"] else "regular"


def resolve(spec: dict, width: float, height: float = 0, safe: dict | None = None, size_class: str | None = None) -> dict:
    """Resolved grid geometry for one viewport. All values in pt (iOS) / px (web)."""
    safe = {"top": 0, "leading": 0, "bottom": 0, "trailing": 0, **(safe or {})}
    variant = pick_variant(spec, width, size_class)
    cfg = spec[variant]
    respects = cfg.get("respectsSafeArea", True)
    out: dict = {
        "viewport": {"width": width, "height": height},
        "safeArea": safe,
        "variant": variant,
        "respectsSafeArea": respects,
        "tolerance": spec["tolerance"],
        "spacing": spec["spacing"],
    }

    cols = cfg.get("columns")
    if cols:
        t = track_frames(width, cols["count"], cols["gutter"], cols["leadingMargin"], cols["trailingMargin"],
                         safe["leading"], safe["trailing"], respects, cfg.get("maxContentWidth"))
        if t:
            starts = [round(x, 2) for x, _ in t["frames"]]
            ends = [round(x + w, 2) for x, w in t["frames"]]
            out["columns"] = {
                "count": cols["count"],
                "gutter": cols["gutter"],
                "leadingMargin": cols["leadingMargin"],
                "trailingMargin": cols["trailingMargin"],
                "contentStart": round(t["start"], 2),
                "contentEnd": round(t["end"], 2),
                "contentWidth": round(t["end"] - t["start"], 2),
                "columnWidth": round(t["size"], 2),
                "starts": starts,
                "ends": ends,
                # width of an element spanning n columns (n columns + n-1 gutters)
                "spans": {str(n): round(n * t["size"] + (n - 1) * cols["gutter"], 2) for n in range(1, cols["count"] + 1)},
            }
            if cols.get("highlightedColumns"):
                out["columns"]["highlightedColumns"] = cols["highlightedColumns"]

    rows = cfg.get("rows")
    if rows and height:
        t = track_frames(height, rows["count"], rows["gutter"], rows["topMargin"], rows["bottomMargin"],
                         safe["top"], safe["bottom"], respects)
        if t:
            out["rows"] = {
                "count": rows["count"],
                "gutter": rows["gutter"],
                "rowHeight": round(t["size"], 2),
                "starts": [round(y, 2) for y, _ in t["frames"]],
                "ends": [round(y + h, 2) for y, h in t["frames"]],
            }

    base = cfg.get("baseline")
    if base:
        top = safe["top"] if respects else 0
        out["baseline"] = {
            "rhythm": base["rhythm"],
            "offset": base.get("offset", 0),
            "firstLine": top + base.get("offset", 0),
            "emphasisEvery": base.get("emphasisEvery"),
        }

    if cfg.get("keyLines") and height:
        out["keyLines"] = [
            {"name": k["name"], "axis": k["axis"], "position": round(key_line_position(k, width, height, safe, respects), 2)}
            for k in cfg["keyLines"]
        ]
    if cfg.get("modularScale"):
        ms = cfg["modularScale"]
        out["modularScale"] = {**ms, "steps": [round(ms["baseSize"] * ms["ratio"] ** i, 2) for i in range(-2, 6)]}
    return out


# MARK: - Spacing scale


def spacing_verdict(value: float, spacing: dict, tol: float = 0.01) -> tuple[bool, float]:
    """(is_on_scale, nearest_allowed) for a spacing value in pt/px."""
    v = abs(value)
    allow = spacing.get("allow") or []
    if any(abs(v - a) <= tol for a in allow):
        return True, v
    scale = spacing.get("scale")
    if scale:
        nearest = min(scale, key=lambda s: abs(v - s))
        return abs(v - nearest) <= tol, nearest
    base = spacing.get("base") or 4
    nearest = max(round(v / base), 1) * base  # never suggest collapsing a spacing to 0
    return abs(v - nearest) <= tol, nearest


def rhythm_deviation(distance: float, rhythm: float | None) -> float | None:
    if not rhythm or rhythm <= 0:
        return None
    r = math.fmod(abs(distance), rhythm)
    return min(r, rhythm - r)


# MARK: - CLI


def _cmd_presets(args):
    for p in load_presets():
        if args.platform and args.platform not in p["platforms"]:
            continue
        reg, comp = _preset_variants(p, args.platform or "ios")
        def describe(c):
            parts = []
            if c.get("columns"):
                k = c["columns"]
                parts.append(f"{k['count']} col / gutter {k['gutter']} / margin {k['leadingMargin']}")
            if c.get("rows"):
                parts.append(f"{c['rows']['count']} rows")
            if c.get("baseline"):
                parts.append(f"rhythm {c['baseline']['rhythm']}")
            if c.get("keyLines"):
                parts.append("key lines: " + ", ".join(k["name"] for k in c["keyLines"]))
            return "; ".join(parts) or "—"
        line = f"{p['id']:<24} {describe(reg)}"
        if comp:
            line += f"   [compact: {describe(comp)}]"
        print(line)


def _cmd_init(args):
    spec = {
        "platform": args.platform,
        "preset": args.preset,
        "regular": {},
        "spacing": {"base": args.spacing_base},
        "tolerance": 1,
        "targets": (
            [
                {"name": "iPhone 16", "width": 393, "height": 852, "scale": 3, "safeArea": {"top": 59, "bottom": 34}},
                {"name": "iPad Pro 11\"", "width": 834, "height": 1210, "scale": 2, "safeArea": {"top": 24, "bottom": 20}},
            ]
            if args.platform == "ios"
            else [
                {"name": "mobile", "width": 390, "height": 844},
                {"name": "tablet", "width": 834, "height": 1112},
                {"name": "desktop", "width": 1440, "height": 900},
            ]
        ),
    }
    if args.platform == "web":
        spec["compactBreakpoint"] = DEFAULT_COMPACT_BREAKPOINT_WEB
        spec["web"] = {"url": "http://localhost:5173", "routes": ["/"]}
    preset_base = None
    if args.preset:
        regular, _ = _preset_variants(preset_by_id(args.preset), args.platform)
        preset_base = regular.get("baseline")
    # Horizontal baseline lines drive the vertical-rhythm checks. Give every
    # spec one: an explicit --rhythm, else the preset's, else the spacing base.
    rhythm = args.rhythm or (None if preset_base else args.spacing_base)
    if rhythm and not args.no_rhythm:
        spec["regular"]["baseline"] = {"rhythm": rhythm, "offset": 0, "emphasisEvery": args.emphasis_every or (4 if rhythm <= 4 else 3)}
    elif args.no_rhythm and preset_base:
        spec["regular"]["baseline"] = None
    os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
    if os.path.exists(args.out) and not args.force:
        raise SystemExit(f"{args.out} exists; pass --force to overwrite")
    with open(args.out, "w") as f:
        json.dump(spec, f, indent=2)
        f.write("\n")
    base = spec["regular"].get("baseline", preset_base) if "baseline" in spec["regular"] else preset_base
    print(f"Wrote {args.out}" + (f" (baseline rhythm {base['rhythm']:g})" if base else " (no baseline rhythm: vertical-rhythm checks are limited to the spacing scale)"))


def _cmd_resolve(args):
    spec = load_spec(args.spec)
    widths = args.width or [t["width"] for t in spec["targets"]]
    results = []
    for w in widths:
        target = next((t for t in spec["targets"] if t["width"] == w), {})
        sa = target.get("safeArea", {})
        safe = {
            "top": args.safe_top if args.safe_top is not None else sa.get("top", 0),
            "bottom": args.safe_bottom if args.safe_bottom is not None else sa.get("bottom", 0),
            "leading": args.safe_leading if args.safe_leading is not None else sa.get("leading", 0),
            "trailing": args.safe_trailing if args.safe_trailing is not None else sa.get("trailing", 0),
        }
        r = resolve(spec, w, args.height or target.get("height", 0), safe, args.size_class)
        if target.get("name"):
            r["target"] = target["name"]
        results.append(r)
    print(json.dumps(results if len(results) != 1 else results[0], indent=2))


def _cmd_check_values(args):
    spec = load_spec(args.spec)
    for v in args.values:
        ok, nearest = spacing_verdict(v, spec["spacing"])
        print(f"{v:g}\t{'ok' if ok else 'OFF-SCALE'}\t{'' if ok else f'→ {nearest:g}'}")


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)

    p = sub.add_parser("presets", help="list built-in presets")
    p.add_argument("--platform", choices=["ios", "web"])
    p.set_defaults(fn=_cmd_presets)

    p = sub.add_parser("init", help="write a starter .gridkit/spec.json")
    p.add_argument("--platform", choices=["ios", "web"], required=True)
    p.add_argument("--preset")
    p.add_argument("--spacing-base", type=float, default=4)
    p.add_argument("--rhythm", type=float, help="baseline rhythm (default: the preset's, else the spacing base)")
    p.add_argument("--emphasis-every", type=int, help="emphasize every Nth baseline (default: 4 for a 4-pt rhythm, else 3)")
    p.add_argument("--no-rhythm", action="store_true", help="no baseline grid (horizontal lines)")
    p.add_argument("--out", default=".gridkit/spec.json")
    p.add_argument("--force", action="store_true")
    p.set_defaults(fn=_cmd_init)

    p = sub.add_parser("resolve", help="print resolved geometry (defaults to every target in the spec)")
    p.add_argument("--spec", default=".gridkit/spec.json")
    p.add_argument("--width", type=float, action="append")
    p.add_argument("--height", type=float)
    p.add_argument("--safe-top", type=float)
    p.add_argument("--safe-bottom", type=float)
    p.add_argument("--safe-leading", type=float)
    p.add_argument("--safe-trailing", type=float)
    p.add_argument("--size-class", choices=["compact", "regular"])
    p.set_defaults(fn=_cmd_resolve)

    p = sub.add_parser("check-values", help="check spacing values against the spec's spacing scale")
    p.add_argument("--spec", default=".gridkit/spec.json")
    p.add_argument("values", type=float, nargs="+")
    p.set_defaults(fn=_cmd_check_values)

    args = ap.parse_args(argv)
    args.fn(args)


if __name__ == "__main__":
    main()
