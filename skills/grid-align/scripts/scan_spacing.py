#!/usr/bin/env python3
"""Static scan for hard-coded spacing that is off the grid's spacing scale.

Finds literal paddings, margins, gaps, stack spacings, insets, offsets and
line heights in SwiftUI/UIKit, CSS/SCSS, JSX inline styles and Tailwind
classes, and reports which ones are off-scale with the nearest allowed value.

    scan_spacing.py --spec .gridkit/spec.json [paths...] [--format md|json] [--all]

Values that reference tokens/variables are not literals and are skipped —
except token *definitions* (`static let spacingM: CGFloat = 13`,
`--space-3: 13px`), which are checked like any other value.
"""
from __future__ import annotations

import argparse
import collections
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gridspec import load_spec, spacing_verdict  # noqa: E402

SKIP_DIRS = {
    ".git", "node_modules", "build", "dist", ".build", "DerivedData", "Pods", "Carthage", ".next", ".nuxt",
    ".svelte-kit", "out", "coverage", "vendor", ".gridkit", ".turbo", ".cache", "storybook-static",
}
SWIFT_EXT = {".swift"}
CSS_EXT = {".css", ".scss", ".sass", ".less", ".pcss"}
MARKUP_EXT = {".tsx", ".jsx", ".ts", ".js", ".mjs", ".vue", ".svelte", ".astro", ".html"}

NUM = r"-?\d+(?:\.\d+)?"

# MARK: - Swift

SWIFT_PATTERNS = [
    # .padding(12) / .safeAreaPadding(12)
    ("padding", re.compile(rf"\.(padding|safeAreaPadding|scenePadding)\(\s*({NUM})\s*\)")),
    # .padding(.horizontal, 12) / .padding([.top, .bottom], 12) / .contentMargins(.horizontal, 20, for: .scrollContent)
    ("padding", re.compile(rf"\.(padding|safeAreaPadding|contentMargins)\(\s*(?:\.\w+|\[[^\]]*\])\s*,\s*({NUM})\b")),
    # EdgeInsets(top: 8, leading: 13, ...) and UIKit insets
    ("insets", re.compile(rf"\b(top|leading|bottom|trailing|left|right)\s*:\s*({NUM})\b(?=[^()]*\))")),
    # VStack(spacing: 10) / GridItem(.flexible(), spacing: 10) / LazyVGrid(..., spacing: 10)
    ("spacing", re.compile(rf"\b(spacing|horizontalSpacing|verticalSpacing)\s*:\s*({NUM})\b")),
    # .offset(x: 3, y: -2)
    ("offset", re.compile(rf"\.offset\([^)]*?\b([xy])\s*:\s*({NUM})\b")),
    ("lineSpacing", re.compile(rf"\.(lineSpacing)\(\s*({NUM})\s*\)")),
    # Auto Layout / collection views
    ("constraint", re.compile(rf"\b(constant)\s*:\s*({NUM})\b")),
    ("constraint", re.compile(rf"\b(minimumLineSpacing|minimumInteritemSpacing|interGroupSpacing|interItemSpacing)\s*=\s*({NUM})\b")),
    ("constraint", re.compile(rf"\.(fixed|flexible)\(\s*({NUM})\s*\)")),
    # token definitions: static let spacingM: CGFloat = 13
    ("token", re.compile(rf"\b(?:let|var)\s+(\w*(?:[Ss]pacing|[Pp]adding|[Mm]argin|[Gg]utter|[Ii]nset|[Gg]ap|[Rr]hythm)\w*)\s*(?::\s*(?:CGFloat|Double|Float|Int))?\s*=\s*({NUM})\b")),
]

# MARK: - CSS

CSS_PROPS = (
    r"padding(?:-(?:top|right|bottom|left|inline|block|inline-start|inline-end|block-start|block-end))?"
    r"|margin(?:-(?:top|right|bottom|left|inline|block|inline-start|inline-end|block-start|block-end))?"
    r"|gap|row-gap|column-gap|grid-gap|grid-row-gap|grid-column-gap"
    r"|inset(?:-(?:inline|block))?(?:-(?:start|end))?|top|right|bottom|left"
    r"|scroll-padding(?:-\w+)?|scroll-margin(?:-\w+)?|line-height"
)
CSS_DECL = re.compile(rf"(?<![\w-])({CSS_PROPS})\s*:\s*([^;{{}}]+)")
CSS_DECL_STRICT = re.compile(rf"(?<![\w-])({CSS_PROPS})\s*:\s*([^;{{}}'\"`,]+);")
CSS_VAR_DECL = re.compile(r"(--[\w-]*(?:space|spacing|gap|gutter|margin|padding|inset|rhythm|size)[\w-]*)\s*:\s*([^;{}]+)", re.I)
CSS_LENGTH = re.compile(rf"(?<![\w.(-])({NUM})(px|rem)\b")

# MARK: - JSX inline styles

JSX_PROPS = (
    r"padding(?:Top|Right|Bottom|Left|Inline|Block|InlineStart|InlineEnd|BlockStart|BlockEnd)?"
    r"|margin(?:Top|Right|Bottom|Left|Inline|Block|InlineStart|InlineEnd|BlockStart|BlockEnd)?"
    r"|gap|rowGap|columnGap|inset|top|right|bottom|left"
)
JSX_NUMERIC = re.compile(rf"\b({JSX_PROPS})\s*:\s*({NUM})\s*[,}}\n]")
JSX_STRING = re.compile(rf"\b({JSX_PROPS}|lineHeight)\s*:\s*['\"`]([^'\"`]+)['\"`]")

# MARK: - Tailwind

TW_PREFIX = (
    r"p|px|py|pt|pr|pb|pl|ps|pe|m|mx|my|mt|mr|mb|ml|ms|me|gap|gap-x|gap-y|space-x|space-y"
    r"|inset|inset-x|inset-y|top|right|bottom|left|start|end|scroll-p[xytrblse]?|scroll-m[xytrblse]?|leading"
)
TW_CLASS = re.compile(
    rf"(?<![\w/\[.-])((?:[\w-]+:)*)(-?)({TW_PREFIX})-(\d+(?:\.\d+)?|\[[^\]\s]+\]|px)(?![\w\[/-])"
)
CLASS_CONTEXT = re.compile(r"class(?:Name)?\s*[=:]|\b(?:cn|clsx|cva|twMerge|classNames|tw)\s*[(`]|@apply\b")


def _strip_comment(line: str, ext: str) -> str:
    if ext in SWIFT_EXT or ext in MARKUP_EXT or ext in {".scss", ".less"}:
        # crude: drop // comments not inside a URL
        idx = line.find("//")
        while idx != -1:
            if idx > 0 and line[idx - 1] == ":":
                idx = line.find("//", idx + 2)
                continue
            return line[:idx]
    return line


def _to_px(value: float, unit: str, rem: float) -> float:
    return value * rem if unit == "rem" else value


class Scanner:
    def __init__(self, spec: dict, tailwind_unit: float | None):
        self.spec = spec
        self.spacing = spec["spacing"]
        self.rem = spec["rem"]
        self.tw_unit = tailwind_unit
        self.findings: list[dict] = []

    def add(self, path, lineno, kind, prop, raw, px, snippet, context=""):
        ok, nearest = spacing_verdict(px, self.spacing)
        sign = -1 if px < 0 else 1
        self.findings.append({
            "file": path, "line": lineno, "kind": kind, "property": prop, "raw": raw, "value": px,
            "onScale": ok, "suggest": None if ok else sign * nearest, "context": context,
            "snippet": snippet.strip()[:160],
        })

    def scan_swift(self, path, lineno, line):
        for kind, rx in SWIFT_PATTERNS:
            for m in rx.finditer(line):
                prop, raw = m.group(1), m.group(2)
                if kind == "insets" and not re.search(r"(EdgeInsets|Insets)\s*\(|\.padding\(", line):
                    continue
                if kind == "constraint" and prop in ("fixed", "flexible") and "GridItem" not in line:
                    continue
                v = float(raw)
                if v == 0 and kind != "token":
                    continue
                self.add(path, lineno, kind, prop, raw, v, line)

    def scan_css_value(self, path, lineno, prop, value, line, kind="css"):
        if prop == "line-height" and not CSS_LENGTH.search(value):
            return  # unitless / normal — a ratio, not a length
        for m in CSS_LENGTH.finditer(value):
            v = _to_px(float(m.group(1)), m.group(2), self.rem)
            if v == 0:
                continue
            self.add(path, lineno, kind, prop, m.group(0), v, line)

    def scan_css(self, path, lineno, line):
        for m in CSS_VAR_DECL.finditer(line):
            self.scan_css_value(path, lineno, m.group(1), m.group(2), line, kind="token")
        for m in CSS_DECL.finditer(line):
            self.scan_css_value(path, lineno, m.group(1), m.group(2), line)

    def scan_markup(self, path, lineno, line, ext):
        # <style> blocks and styled-components / CSS-in-JS templates: only
        # semicolon-terminated declarations, so JS object literals don't match.
        for m in CSS_VAR_DECL.finditer(line):
            if ";" in m.group(0) or line.rstrip().endswith(";"):
                self.scan_css_value(path, lineno, m.group(1), m.group(2), line, kind="token")
        for m in CSS_DECL_STRICT.finditer(line):
            self.scan_css_value(path, lineno, m.group(1), m.group(2), line)
        for m in JSX_NUMERIC.finditer(line):
            v = float(m.group(2))
            if v != 0:
                self.add(path, lineno, "inline-style", m.group(1), m.group(2), v, line)
        for m in JSX_STRING.finditer(line):
            prop = re.sub(r"([A-Z])", lambda c: "-" + c.group(1).lower(), m.group(1))
            self.scan_css_value(path, lineno, prop, m.group(2), line, kind="inline-style")
        if self.tw_unit and CLASS_CONTEXT.search(line):
            for m in TW_CLASS.finditer(line):
                variants, neg, prefix, val = m.groups()
                if val == "px":
                    px = 1.0
                elif val.startswith("["):
                    inner = val[1:-1]
                    lm = re.fullmatch(rf"({NUM})(px|rem)?", inner)
                    if not lm:
                        continue
                    px = _to_px(float(lm.group(1)), lm.group(2) or "px", self.rem)
                elif prefix == "leading" and float(val) < 3:
                    continue  # leading-none/tight… are ratios; numeric leading-N starts at 3
                else:
                    px = float(val) * self.tw_unit
                if px == 0:
                    continue
                px = -px if neg else px
                self.add(path, lineno, "tailwind", prefix, m.group(0).lstrip(), px, line, context=variants.rstrip(":"))

    def scan_file(self, path):
        ext = os.path.splitext(path)[1].lower()
        try:
            with open(path, encoding="utf-8", errors="ignore") as f:
                lines = f.readlines()
        except OSError:
            return
        in_block_comment = False
        for i, line in enumerate(lines, 1):
            if in_block_comment:
                if "*/" in line:
                    in_block_comment = False
                    line = line.split("*/", 1)[1]
                else:
                    continue
            if "/*" in line and "*/" not in line.split("/*", 1)[1]:
                in_block_comment = True
                line = line.split("/*", 1)[0]
            line = re.sub(r"/\*.*?\*/", "", line)
            line = _strip_comment(line, ext)
            if not line.strip():
                continue
            if ext in SWIFT_EXT:
                self.scan_swift(path, i, line)
            elif ext in CSS_EXT:
                self.scan_css(path, i, line)
            elif ext in MARKUP_EXT:
                self.scan_markup(path, i, line, ext)


def iter_files(paths):
    exts = SWIFT_EXT | CSS_EXT | MARKUP_EXT
    for root in paths:
        if os.path.isfile(root):
            yield root
            continue
        for dirpath, dirnames, filenames in os.walk(root):
            dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS and not d.endswith((".xcassets", ".xcodeproj", ".xcworkspace"))]
            for name in filenames:
                if os.path.splitext(name)[1].lower() in exts and not name.endswith((".min.js", ".d.ts", ".test.ts", ".test.tsx", ".spec.ts", ".spec.tsx")):
                    yield os.path.join(dirpath, name)


def detect_tailwind(paths) -> float | None:
    """Tailwind spacing unit in px (v3 and v4 default: 0.25rem = 4px), or None."""
    for root in paths:
        d = root if os.path.isdir(root) else os.path.dirname(root)
        while True:
            pkg = os.path.join(d, "package.json")
            if os.path.exists(pkg):
                try:
                    with open(pkg) as f:
                        text = f.read()
                    if "tailwindcss" in text:
                        return 4.0
                except OSError:
                    pass
            parent = os.path.dirname(d)
            if parent == d:
                break
            d = parent
    return None


def render_markdown(findings, all_findings, show_all):
    out = []
    total = len(all_findings)
    off = [f for f in all_findings if not f["onScale"]]
    out.append(f"**{len(off)} off-scale of {total} literal spacing values.**\n")
    if off:
        hist = collections.Counter((f["value"], f["suggest"]) for f in off)
        out.append("Most common off-scale values (value → nearest on-scale):\n")
        out.append(", ".join(f"`{v:g}` → `{s:g}` ×{n}" for (v, s), n in hist.most_common(12)) + "\n")
        per_file = collections.Counter(f["file"] for f in off)
        out.append("Files with the most off-scale values: " + ", ".join(f"`{p}` ({n})" for p, n in per_file.most_common(8)) + "\n")
    rows = findings if show_all else off
    if rows:
        out.append("| Location | Kind | Property | Value | Suggest | Snippet |")
        out.append("|---|---|---|---|---|---|")
        for f in rows:
            loc = f"{f['file']}:{f['line']}"
            prop = f["property"] + (f" ({f['context']})" if f["context"] else "")
            sugg = "✓" if f["onScale"] else f"{f['suggest']:g}"
            snippet = f["snippet"].replace("|", "\\|")
            out.append(f"| `{loc}` | {f['kind']} | {prop} | `{f['raw']}` ({f['value']:g}) | {sugg} | `{snippet}` |")
    return "\n".join(out)


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("paths", nargs="*", default=["."])
    ap.add_argument("--spec", default=".gridkit/spec.json")
    ap.add_argument("--format", choices=["md", "json"], default="md")
    ap.add_argument("--all", action="store_true", help="also list on-scale values")
    ap.add_argument("--tailwind-unit", type=float, help="px per Tailwind spacing step (auto-detected: 4)")
    ap.add_argument("--no-tailwind", action="store_true")
    args = ap.parse_args(argv)

    spec = load_spec(args.spec)
    tw = None if args.no_tailwind else (args.tailwind_unit or detect_tailwind(args.paths))
    scanner = Scanner(spec, tw)
    for path in iter_files(args.paths):
        scanner.scan_file(os.path.relpath(path))

    findings = scanner.findings
    if args.format == "json":
        print(json.dumps({
            "spacing": spec["spacing"],
            "tailwindUnit": tw,
            "total": len(findings),
            "offScale": sum(1 for f in findings if not f["onScale"]),
            "findings": findings if args.all else [f for f in findings if not f["onScale"]],
        }, indent=2))
    else:
        print(render_markdown(findings, findings, args.all))


if __name__ == "__main__":
    main()
