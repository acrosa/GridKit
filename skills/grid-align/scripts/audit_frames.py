#!/usr/bin/env python3
"""Audit measured element frames against a GridKit spec.

Input is a frames JSON produced by collect_frames.js (web) or the
GridAuditFrames UI test (iOS) — see references/frames-format.md. Output is a
numbered list of findings (markdown or JSON) that annotate_page.js /
annotate.swift can draw onto the screenshot.

    audit_frames.py --spec .gridkit/spec.json frames.json [--format md|json] [--near-miss 8]
"""
from __future__ import annotations

import argparse
import collections
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gridspec import load_spec, resolve, rhythm_deviation, spacing_verdict  # noqa: E402

SEVERITY_ORDER = {"error": 0, "warn": 1, "info": 2}
SYSTEM_CHROME = {"navigationBar", "tabBar", "toolbar", "statusBar", "keyboard"}


def describe(el: dict) -> str:
    bits = []
    if el.get("component"):
        bits.append(el["component"])
    if el.get("selector"):
        bits.append(f"`{el['selector']}`")
    elif el.get("type"):
        bits.append(el["type"])
    if el.get("label"):
        bits.append(f"“{el['label']}”")
    return " ".join(bits) or f"element #{el['id']}"


def nearest(value: float, candidates: list[float]):
    if not candidates:
        return None, None
    best = min(candidates, key=lambda c: abs(value - c))
    return best, value - best


class Auditor:
    def __init__(self, spec: dict, frames: dict, near_miss: float):
        self.spec = spec
        self.frames = frames
        vp = frames["viewport"]
        self.vw, self.vh = vp["width"], vp["height"]
        self.ios = frames.get("platform") == "ios"
        safe = frames.get("safeArea")
        if safe is None:
            # XCUITest can't read safe areas; take them from the matching spec target.
            target = next((t for t in spec["targets"] if abs(t["width"] - self.vw) < 1 and abs(t.get("height", self.vh) - self.vh) < 1), None)
            safe = (target or {}).get("safeArea", {})
        self.geo = resolve(spec, self.vw, self.vh, safe, frames.get("sizeClass"))
        self.tol = spec["tolerance"] + (0.34 if self.ios else 0)
        self.near = near_miss
        els = [e for e in frames["elements"] if e["w"] > 0 and e["h"] > 0]
        # System chrome (nav/tab/tool bars, keyboard) is laid out by UIKit, not the app.
        chrome = {e["id"] for e in els if e.get("type") in SYSTEM_CHROME}
        by_id = {e["id"]: e for e in els}

        def under_chrome(e):
            p = e.get("id")
            while p is not None:
                if p in chrome:
                    return True
                p = by_id.get(p, {}).get("parent")
            return False

        self.els = [e for e in els if not under_chrome(e)]
        self.by_id = {e["id"]: e for e in self.els}
        self.children = collections.defaultdict(list)
        for e in self.els:
            if e.get("parent") is not None:
                self.children[e["parent"]].append(e)
        self.findings: list[dict] = []
        self.flagged_intrusion: set[int] = set()

    # MARK: helpers

    def add(self, severity, check, message, el=None, fix=None, rect=None, count=1, extra=None):
        f = {"severity": severity, "check": check, "message": message, "fix": fix, "count": count}
        if el is not None:
            f["element"] = {k: el.get(k) for k in ("id", "kind", "tag", "type", "selector", "label", "component")}
            f["rect"] = rect or {k: el[k] for k in ("x", "y", "w", "h")}
        elif rect:
            f["rect"] = rect
        if extra:
            f.update(extra)
        self.findings.append(f)

    def ancestors(self, el):
        p = el.get("parent")
        while p is not None and p in self.by_id:
            yield self.by_id[p]
            p = self.by_id[p].get("parent")

    def full_bleed(self, el):
        return el["x"] <= self.tol and el["x"] + el["w"] >= self.vw - self.tol

    def on_screen_x(self, el):
        return el["x"] < self.vw - 1 and el["x"] + el["w"] > 1

    def is_layout_level(self, el, cols):
        """Children of a box that spans the whole content area (sections, page
        containers) are the ones the column grid governs; content nested in a
        narrower box (a card's text) follows that box's padding instead."""
        parent = self.by_id.get(el.get("parent"))
        if parent is None:
            return True
        return parent["x"] <= cols["contentStart"] + self.tol and parent["x"] + parent["w"] >= cols["contentEnd"] - self.tol

    # MARK: checks

    def check_overflow(self):
        page = self.frames.get("page") or {}
        sw = page.get("scrollWidth")
        if sw and sw > self.vw + 1:
            culprits = [e for e in self.els if e["x"] + e["w"] > self.vw + 1 and not any(a["x"] + a["w"] > self.vw + 1 for a in self.ancestors(e))]
            names = ", ".join(describe(e) for e in culprits[:4]) or "unknown element"
            self.add("error", "overflow", f"Page scrolls horizontally: content is {sw:g} wide in a {self.vw:g} viewport. Widest offenders: {names}.",
                     el=culprits[0] if culprits else None, fix="Constrain the offending boxes to the content area (max-width: 100%, min-width: 0 on flex/grid children, overflow-wrap: anywhere for long strings).")

    def check_margins(self, cols):
        start, end = cols["contentStart"], cols["contentEnd"]
        for el in self.els:
            if el["kind"] == "container" or not self.on_screen_x(el) or self.full_bleed(el):
                continue
            if any(a["id"] in self.flagged_intrusion for a in self.ancestors(el)):
                continue
            left_in = start - el["x"]
            right_in = el["x"] + el["w"] - end
            if left_in > self.tol and el["x"] > self.tol:
                side, amount = "leading", left_in
            elif right_in > self.tol and el["x"] + el["w"] < self.vw - self.tol:
                side, amount = "trailing", right_in
            else:
                continue
            self.flagged_intrusion.add(el["id"])
            self.add("error", "margin", f"{el['kind'].capitalize()} sits {amount:g} inside the {side} margin (content area is {start:g}–{end:g}).",
                     el=el, fix=f"Inset it to the content area: {side} edge at {start if side == 'leading' else end:g}.")

    def check_content_edges(self, cols):
        """Catches content that is consistently inset — typically a doubled
        margin (page margin + wrapper padding) — which no near-miss check sees
        because every edge is off by the same, larger amount."""
        start, end = cols["contentStart"], cols["contentEnd"]
        if self.ios:
            # No style info: compare the leftmost content against the content edge.
            lefts = [e for e in self.els if e["kind"] != "container" and self.on_screen_x(e) and not self.full_bleed(e)
                     and e["x"] >= start - self.tol]
            if lefts:
                el = min(lefts, key=lambda e: e["x"])
                inset = el["x"] - start
                if inset > self.tol:
                    self.add("warn", "content-edge", f"Nothing reaches the leading content edge ({start:g}); the leftmost content starts at {el['x']:g}.",
                             el=el, fix=f"Remove {inset:g} of nested horizontal padding so content starts at {start:g}.", extra={"expected": start, "delta": round(inset, 2)})
            return
        flagged = set()
        for p in self.els:
            st = p.get("style") or {}
            if p["kind"] != "container" or st.get("visual") or not self.on_screen_x(p):
                continue
            if not (p["x"] <= start + self.tol and p["x"] + p["w"] >= end - self.tol):
                continue  # only wrappers that span the whole content area
            if any(a["id"] in flagged for a in self.ancestors(p)):
                continue
            kids = [k for k in self.children.get(p["id"], []) if self.on_screen_x(k) and not self.full_bleed(k)]
            if not kids:
                continue
            left = min(k["x"] for k in kids)
            right = max(k["x"] + k["w"] for k in kids)
            inset_l, inset_r = left - start, end - right
            if inset_l > self.tol and (inset_r > self.tol or len(kids) == 1):
                flagged.add(p["id"])
                self.add("warn", "content-edge",
                         f"Everything inside this wrapper starts at {left:g}, {inset_l:g} inside the content edge ({start:g}) — likely a doubled margin (page margin + wrapper padding).",
                         el=p, fix=f"Drop {inset_l:g} of horizontal padding on this wrapper (or its parent) so its content starts at {start:g}.",
                         extra={"expected": start, "delta": round(inset_l, 2)})

    def check_column_edges(self, cols):
        starts, ends = cols["starts"], cols["ends"]
        groups = collections.OrderedDict()
        for el in self.els:
            if not self.on_screen_x(el) or self.full_bleed(el) or not self.is_layout_level(el, cols):
                continue
            if el["id"] in self.flagged_intrusion:
                continue
            for edge, value, lines in (("leading", el["x"], starts), ("trailing", el["x"] + el["w"], ends)):
                line, delta = nearest(value, lines)
                if line is None or abs(delta) <= self.tol or abs(delta) > self.near:
                    continue
                key = (edge, round(value, 1))
                groups.setdefault(key, []).append((el, line, delta))
        for (edge, value), hits in groups.items():
            # report the outermost element for each misaligned edge
            hits.sort(key=lambda h: -(h[0]["w"] * h[0]["h"]))
            el, line, delta = hits[0]
            col = (starts if edge == "leading" else ends).index(line) + 1
            self.add("warn", "column-edge",
                     f"{edge.capitalize()} edge at {value:g} is {abs(delta):g} {'right' if delta > 0 else 'left'} of column {col}'s {'start' if edge == 'leading' else 'end'} ({line:g})."
                     + (f" {len(hits)} elements share this edge." if len(hits) > 1 else ""),
                     el=el, fix=f"Align the {edge} edge to column {col} ({line:g}): move it by {-delta:+g}.", count=len(hits),
                     extra={"expected": line, "delta": round(delta, 2)})

    def check_spans(self, cols):
        spans = {int(k): v for k, v in cols["spans"].items()}
        starts = cols["starts"]
        for el in self.els:
            if not self.on_screen_x(el) or self.full_bleed(el) or not self.is_layout_level(el, cols) or el["kind"] == "text":
                continue
            _, d_start = nearest(el["x"], starts)
            if d_start is None or abs(d_start) > self.tol:
                continue
            n, width = min(spans.items(), key=lambda kv: abs(el["w"] - kv[1]))
            delta = el["w"] - width
            if self.tol < abs(delta) <= self.near:
                self.add("warn", "span", f"Width {el['w']:g} is {abs(delta):g} {'wider' if delta > 0 else 'narrower'} than a {n}-column span ({width:g}).",
                         el=el, fix=f"Size it to span {n} column{'s' if n > 1 else ''} ({width:g}) instead of a fixed width.",
                         extra={"expected": width, "delta": round(delta, 2)})

    def check_vertical_rhythm(self):
        base = self.geo.get("baseline")
        unit = base["rhythm"] if base else None
        seen = set()
        for pid, kids in self.children.items():
            stack = sorted((k for k in kids if self.on_screen_x(k)), key=lambda k: k["y"])
            for a, b in zip(stack, stack[1:]):
                overlap_x = min(a["x"] + a["w"], b["x"] + b["w"]) - max(a["x"], b["x"])
                gap = b["y"] - (a["y"] + a["h"])
                if overlap_x <= 0 or gap <= self.tol:
                    continue
                if self.ios and a["kind"] == "text" and b["kind"] == "text":
                    continue  # accessibility text frames include font leading, so text-to-text gaps are unreliable
                if unit:
                    dev = rhythm_deviation(gap, unit)
                    if dev is None or dev <= self.tol:
                        continue
                    target = max(round(gap / unit), 1) * unit  # same rounding as the spacing scale
                    rule = f"the {unit:g} rhythm"
                else:
                    ok, target = spacing_verdict(gap, self.spec["spacing"], self.tol)
                    if ok:
                        continue
                    rule = "the spacing scale"
                key = (round(gap, 1), describe(self.by_id.get(pid, {"id": pid})))
                if key in seen:
                    continue
                seen.add(key)
                self.add("warn", "rhythm", f"Vertical gap of {gap:g} between {describe(a)} and {describe(b)} is off {rule}.",
                         el=b, fix=f"Use {target:g} (change the stack spacing / margin by {target - gap:+g}).",
                         rect={"x": min(a["x"], b["x"]), "y": a["y"] + a["h"], "w": max(a["w"], b["w"]), "h": gap},
                         extra={"expected": target, "delta": round(gap - target, 2)})

    SPACING_PROPS = ("paddingTop", "paddingRight", "paddingBottom", "paddingLeft", "marginTop", "marginRight",
                     "marginBottom", "marginLeft", "rowGap", "columnGap")

    def check_computed_spacing(self):
        # (who, value) → props on the first element, plus how many elements repeat it
        groups: dict = collections.OrderedDict()
        for el in self.els:
            st = el.get("style") or {}
            for prop in self.SPACING_PROPS:
                v = st.get(prop)
                if v is None or abs(v) < 0.5:
                    continue
                if prop in ("marginLeft", "marginRight") and abs(v) > 64:
                    continue  # most likely margin: auto centering
                ok, target = spacing_verdict(v, self.spec["spacing"], 0.05)
                if ok:
                    continue
                g = groups.setdefault((el.get("component") or el.get("selector"), v), {"target": target, "props": [], "els": []})
                if prop not in g["props"]:
                    g["props"].append(prop)
                if el not in g["els"]:
                    g["els"].append(el)
        base = self.spec["spacing"].get("base") or 4
        for (who, v), g in groups.items():
            els, props, target = g["els"], g["props"], g["target"]
            hint = f"Use {target:g}" + (" (or remove it — likely a nudge)" if abs(v) < base / 2 else "") + "."
            self.add("warn", "spacing", f"{', '.join(props)} {v:g} is off-scale on {describe(els[0])}" + (f" and {len(els) - 1} similar" if len(els) > 1 else "") + ".",
                     el=els[0], fix=hint, count=len(els), extra={"property": props, "value": v, "expected": target})

    def check_type(self):
        base = self.geo.get("baseline")
        steps = None
        if self.spec.get("typeScale"):
            steps = self.spec["typeScale"]
        elif self.geo.get("modularScale"):
            steps = self.geo["modularScale"]["steps"]
        groups = collections.defaultdict(list)
        for el in self.els:
            st = el.get("style") or {}
            lh, fs = st.get("lineHeight"), st.get("fontSize")
            if base and lh:
                dev = rhythm_deviation(lh, base["rhythm"])
                if dev is not None and dev > 0.05:
                    target = max(round(lh / base["rhythm"]), 1) * base["rhythm"]
                    groups[("line-height", lh, target, fs)].append(el)
            if steps and fs and min(abs(fs - s) for s in steps) > 0.5:
                target = min(steps, key=lambda s: abs(fs - s))
                groups[("font-size", fs, round(target, 2), None)].append(el)
        for (prop, v, target, fs), els in groups.items():
            sev = "warn" if prop == "line-height" else "info"
            ctx = f" at font-size {fs:g}" if fs else ""
            self.add(sev, "type", f"{prop} {v:g}{ctx} is off the {'baseline rhythm' if prop == 'line-height' else 'type scale'} ({len(els)} element{'s' if len(els) > 1 else ''}, e.g. {describe(els[0])}).",
                     el=els[0], fix=f"Use {prop} {target:g}.", count=len(els), extra={"property": prop, "value": v, "expected": target})

    def check_horizontal_lines(self):
        lines = []
        for k in self.geo.get("keyLines", []):
            if k["axis"] == "horizontal":
                lines.append((k["position"], f"key line “{k['name']}”"))
        rows = self.geo.get("rows")
        if rows:
            lines += [(y, f"row {i + 1} top") for i, y in enumerate(rows["starts"])]
            lines += [(y, f"row {i + 1} bottom") for i, y in enumerate(rows["ends"])]
        if not lines:
            return
        reported = set()
        for el in self.els:
            if el["y"] > self.vh or el["kind"] == "text" and el.get("parent") is not None and self.by_id.get(el["parent"], {}).get("kind") == "text":
                continue
            for edge, value in (("top", el["y"]), ("bottom", el["y"] + el["h"])):
                pos, name = min(lines, key=lambda l: abs(value - l[0]))
                delta = value - pos
                if self.tol < abs(delta) <= self.near and (name, round(value)) not in reported:
                    reported.add((name, round(value)))
                    self.add("warn", "key-line", f"{edge.capitalize()} edge at {value:g} is {abs(delta):g} off the {name} ({pos:g}).",
                             el=el, fix=f"Move the {edge} edge by {-delta:+g} to sit on the {name}.", extra={"expected": pos, "delta": round(delta, 2)})

    def check_vertical_key_lines(self):
        for k in self.geo.get("keyLines", []):
            if k["axis"] != "vertical":
                continue
            for el in self.els:
                for edge, value in (("leading", el["x"]), ("trailing", el["x"] + el["w"])):
                    delta = value - k["position"]
                    if self.tol < abs(delta) <= self.near:
                        self.add("warn", "key-line", f"{edge.capitalize()} edge at {value:g} is {abs(delta):g} off key line “{k['name']}” ({k['position']:g}).",
                                 el=el, fix=f"Move it by {-delta:+g}.", extra={"expected": k["position"], "delta": round(delta, 2)})
                        break

    def run(self):
        cols = self.geo.get("columns")
        self.check_overflow()
        if cols:
            self.check_margins(cols)
            self.check_content_edges(cols)
            self.check_column_edges(cols)
            self.check_spans(cols)
        self.check_vertical_rhythm()
        self.check_computed_spacing()
        self.check_type()
        self.check_horizontal_lines()
        self.check_vertical_key_lines()
        ignore = self.spec["raw"].get("ignore") or []
        if ignore:
            def ignored(f):
                el = f.get("element") or {}
                hay = " ".join(str(el.get(k) or "") for k in ("selector", "label", "component"))
                return any(token in hay for token in ignore)
            self.findings = [f for f in self.findings if not ignored(f)]
        self.findings.sort(key=lambda f: (SEVERITY_ORDER[f["severity"]], f.get("rect", {}).get("y", 0)))
        for i, f in enumerate(self.findings, 1):
            f["n"] = i
        return self.findings


def render_md(name, geo, findings):
    out = [f"### {name} — {geo['viewport']['width']:g}×{geo['viewport']['height']:g} ({geo['variant']} grid)\n"]
    cols = geo.get("columns")
    if cols:
        out.append(f"Grid: {cols['count']} columns × {cols['columnWidth']:g}, gutter {cols['gutter']:g}, content {cols['contentStart']:g}–{cols['contentEnd']:g}"
                   + (f", rhythm {geo['baseline']['rhythm']:g}" if geo.get("baseline") else "") + "\n")
    counts = collections.Counter(f["severity"] for f in findings)
    out.append(f"**{counts['error']} errors, {counts['warn']} warnings, {counts['info']} info**\n")
    if findings:
        out.append("| # | Sev | Check | Finding | Element | Fix |")
        out.append("|---|---|---|---|---|---|")
        for f in findings:
            el = describe(f["element"]) if f.get("element") else ""
            out.append(f"| {f['n']} | {f['severity']} | {f['check']} | {f['message']} | {el.replace('|', '/')} | {f.get('fix') or ''} |")
    return "\n".join(out)


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("frames")
    ap.add_argument("--spec", default=".gridkit/spec.json")
    ap.add_argument("--format", choices=["md", "json"], default="md")
    ap.add_argument("--near-miss", type=float, help="max distance (pt/px) treated as an accidental misalignment (default: spec nearMiss or 8)")
    ap.add_argument("--name")
    args = ap.parse_args(argv)

    spec = load_spec(args.spec)
    with open(args.frames) as f:
        frames = json.load(f)
    near = args.near_miss or spec["raw"].get("nearMiss", 8)
    auditor = Auditor(spec, frames, near)
    findings = auditor.run()
    name = args.name or frames.get("name") or os.path.splitext(os.path.basename(args.frames))[0]
    if args.format == "json":
        print(json.dumps({"name": name, "geometry": auditor.geo, "findings": findings}, indent=2))
    else:
        print(render_md(name, auditor.geo, findings))


if __name__ == "__main__":
    main()
