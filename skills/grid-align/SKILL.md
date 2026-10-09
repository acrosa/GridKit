---
name: grid-align
description: Audit an app's UI against a layout grid (columns, gutters, margins, baseline rhythm, spacing scale, breakpoints) and optionally fix the code so the UI snaps to it. Works on SwiftUI/UIKit iOS apps and web apps (CSS, Tailwind, CSS-in-JS, React). Captures screenshots with the grid and numbered findings drawn on top, scans the source for off-grid spacing, writes an audit report, and on request rewrites paddings, stack spacings, column spans, breakpoints and type metrics. Use when the user wants to check or align their UI to a grid, apply a GridKit preset or brand grid, fix inconsistent spacing or margins, enforce an 4/8-pt spacing system, or "make the layout match the design grid".
---

# Grid Align

Bring an existing app's layout onto a chosen grid: **define the spec → audit (code + screenshots) → report → optionally apply fixes → re-audit**.

Everything is measured, not eyeballed. The bundled scripts resolve the grid to exact numbers per viewport, collect real element frames from the running app, and flag what is off and by how much. Your judgment goes into telling intentional deviations from mistakes, tracing findings to source, and choosing the idiomatic fix.

`$SKILL` below means this skill's directory (the folder holding this file). Scripts need only `python3`, plus `node` + Playwright for web screenshots and Xcode for iOS.

| Script | What it does |
|---|---|
| `scripts/gridspec.py` | List presets, write `.gridkit/spec.json`, resolve the grid for a viewport (column x-positions, span widths, rhythm, key lines), check values against the spacing scale |
| `scripts/scan_spacing.py` | Static scan for literal spacing off the scale: SwiftUI/UIKit, CSS/SCSS, JSX styles, Tailwind classes, spacing tokens |
| `scripts/web_capture.mjs` | Web: per route × width — collect frames, audit, save raw + annotated screenshots |
| `scripts/collect_frames.js` / `annotate_page.js` | The in-page halves of the above, usable from any browser tool |
| `assets/GridAuditFrames.swift` | iOS: XCUITest that dumps accessibility frames + screenshot per screen |
| `scripts/audit_frames.py` | Audits a frames JSON against the spec → numbered findings (md/json) |
| `scripts/annotate.swift` | Draws grid + numbered findings onto any screenshot (macOS) |

All output goes in `.gridkit/` in the user's project: `spec.json` (commit it) and `audit/` (suggest adding `.gridkit/audit/` to `.gitignore`).

## Phase 0: Orient

1. Find the platform(s): `Package.swift`/`*.xcodeproj` with SwiftUI or UIKit; `package.json` (React/Vue/Svelte/plain), Tailwind (`tailwindcss` dependency, `@theme`, `tailwind.config.*`), CSS modules, styled-components. A repo can hold both, so audit each separately with its own spec (`.gridkit/spec.ios.json`, `.gridkit/spec.web.json`).
2. Look for an existing grid definition before asking anything: `.gridkit/spec.json`, a GridKit JSON (`brand-grid.json`, `GridKit.shared.load`, `initialPreset=`, `.apply(preset:)`), spacing tokens (`enum Spacing`, `--space-*`, Tailwind `spacing`/`--spacing`), container widths, breakpoints. Existing tokens tell you the de-facto system even when nobody wrote it down.
3. Note whether GridKit is installed (`import GridKit`, `gridkit-react`). It isn't required, but with it the user can see the same grid live while you work.

## Phase 1: Define the grid spec

If a spec already exists, show its resolved numbers and confirm it's still the target. Otherwise, build one with the user:

```bash
python3 $SKILL/scripts/gridspec.py presets --platform web     # or ios
```

Ask (AskUserQuestion, one round, recommended option first, based on what Phase 0 found):

- **Grid:** a preset (`swiss-12-column` for most web, `four-column-mobile` or `ios-standard` for phone apps, `asymmetric-editorial`/`modular-*` for content-heavy layouts), their existing GridKit JSON, or custom numbers.
- **Spacing scale:** 4-pt base (dense UI), 8-pt base (the common default), or an explicit list such as their existing tokens.
- **Vertical rhythm:** the baseline grid, i.e. the horizontal lines that text and stacked elements sit on. Offer the preset's rhythm (every preset except `hero-split` has one), 4 or 8, or the body line height for reading layouts. Don't drop it unless the user asks: without it, vertical gaps are only checked against the spacing scale, and line heights and text baselines aren't checked at all.
- **Breakpoints/targets:** which viewport widths or devices matter. Web defaults to 390 / 834 / 1440 with the compact variant below 768. iOS defaults to iPhone 16 and an 11" iPad.

Ask about margin, gutter or max-width overrides afterwards, and only if the preset doesn't fit (e.g. their site caps content at 1200px).

Then write and adjust the spec:

```bash
python3 $SKILL/scripts/gridspec.py init --platform web --preset swiss-12-column --spacing-base 8   # --rhythm 4 to override the preset's
python3 $SKILL/scripts/gridspec.py resolve            # every target in the spec
```

The full format is in [references/spec-format.md](references/spec-format.md). Show the user a small table of the resolved grid per target (variant, column count, column width, gutter, content span, rows, baseline rhythm), so you both agree on the numbers before anything gets flagged.

## Phase 2: Audit

Run all three passes. They catch different things.

### 2a. Static scan (both platforms)

```bash
python3 $SKILL/scripts/scan_spacing.py --spec .gridkit/spec.json src/     # or the app's Sources/
```

This lists every literal spacing value that's off the scale, with file:line and the nearest on-scale value. The histogram at the top matters most: one value used 40 times (say `12` → `16`) usually has a single root cause, such as a token, a shared component, or a Tailwind class pattern.

### 2b. Runtime capture

**Web.** The dev server must be running. Start it in the background if it isn't, then:

```bash
node $SKILL/scripts/web_capture.mjs --spec .gridkit/spec.json --url http://localhost:5173 --routes /,/pricing
```

Playwright comes from the project, or from `PLAYWRIGHT_DIR`. If neither has it, ask before installing anything. Either add it as a dev dependency, or install it outside the project: `npm i --prefix ~/.cache/gridkit-align playwright && npx --prefix ~/.cache/gridkit-align playwright install chromium`, then run with `PLAYWRIGHT_DIR=~/.cache/gridkit-align`. If a browser MCP (Claude in Chrome or the built-in browser) is available instead, do the same steps by hand. Resize to each target width. Evaluate `collect_frames.js` and save the result as `<name>.frames.json`. Run `audit_frames.py --format json`. Evaluate `(annotate_page.js source)(auditJson)`, then take a screenshot.

**iOS.** Choose the path that fits the project:

1. **Measured (preferred):** copy `assets/GridAuditFrames.swift` into the UI test target (create a UI test target if there is none, after asking). Edit `testCaptureScreens` to navigate to each screen under audit, then run it with `TEST_RUNNER_GRID_AUDIT_OUT="$PWD/.gridkit/audit" xcodebuild test … -only-testing:<UITests>/GridAuditFrames` (see the header of the file). Then for each capture:
   ```bash
   python3 $SKILL/scripts/audit_frames.py --spec .gridkit/spec.json .gridkit/audit/home@393.frames.json --format json > .gridkit/audit/home@393.audit.json
   swift $SKILL/scripts/annotate.swift .gridkit/audit/home@393.png .gridkit/audit/home@393.audit.json .gridkit/audit/home@393.annotated.png
   ```
2. **Visual (quick):** if GridKit is in the app, build and run it in the simulator with the matching preset applied, e.g. `GridKit.shared.apply(configuration:)` from a DEBUG launch argument, or `.gridKit(.enabled(activation: .manual))` + `show()`. Capture with `xcrun simctl io booted screenshot .gridkit/audit/home.png` and inspect it. Without GridKit, annotate a plain simulator screenshot with `annotate.swift` and a geometry-only audit JSON (`audit_frames.py` on a frames file with an empty `elements` list).
3. If the `device-interaction` skill is available, it can drive navigation and return the UI hierarchy with frames. Convert that into the frames format ([references/frames-format.md](references/frames-format.md)).

### 2c. Review the evidence

Open every `*.annotated.png` with the Read tool and compare it against its `*.audit.md`. For each finding:

- **Confirm or dismiss it.** Full-bleed media, intentionally overhanging elements, and centered hero text are legitimate. Record deliberate exceptions in the spec's `ignore` list, so re-audits stay clean.
- **Trace it to source.** Web: grep the selector's classes, the React component name (dev builds report it), or the text label. iOS: grep the accessibility label or identifier string, then find the view that pads it.
- **Group by root cause.** Ten cards off by 4 is one finding about the card component, not ten.

Severity: **error** (overflow, content inside the margins) > **warn** (near-miss column edges, off-scale spacing, off-rhythm gaps and line heights, text baselines that drifted off the baseline grid, near-miss key and row lines) > **info** (font sizes off the type scale). Each web audit also states how many text blocks sit on the baseline grid. Quote it in the report, since it's the clearest measure of vertical rhythm. Checks and tuning are explained in [references/frames-format.md](references/frames-format.md).

## Phase 3: Report

Write `.gridkit/audit/REPORT.md` with these sections:

1. **Grid spec:** a summary plus the resolved numbers per target.
2. **Scorecard:** errors, warnings and off-scale literal values per screen/target.
3. **Findings by root cause:** most impactful first. Each has: what's wrong (measured vs expected), where (file:line), annotated screenshot reference(s) with finding numbers, and the proposed change (before → after).
4. **Proposed plan,** in this order, since each step removes findings the next would otherwise chase:
   1. Grid tokens: a single source of truth for margin, gutter, columns and the spacing scale.
   2. Page/screen containers: outer margins, max width, safe areas, breakpoints.
   3. Column layout: spans, gutters, and grid instead of hand-sized widths.
   4. Component spacing: paddings, stack spacing, gaps.
   5. Vertical rhythm and type: line heights as rhythm multiples, paragraph and section spacing, drifted baselines, font sizes.
   6. One-off nudges: offsets and stray margins. Delete them rather than tune them.
5. **Exceptions:** intentional deviations being kept.

Summarize the report in chat (scorecard + top root causes) and link the annotated screenshots. If the user may share it, offer to publish the report as an artifact. Then ask how to proceed: **apply everything**, **apply selected groups**, or **stop at the report**. Never modify code before this answer.

## Phase 4: Apply fixes

Platform playbooks with idiomatic fixes for each finding type: [references/swiftui-fixes.md](references/swiftui-fixes.md) and [references/css-fixes.md](references/css-fixes.md). Rules:

- **Tokens first.** Add or extend the project's existing spacing/grid tokens (e.g. `enum GridSpec` / `Spacing` in Swift; CSS custom properties or the Tailwind theme on the web) with values generated from the spec, then point code at them. Don't scatter new literals, even on-scale ones.
- **Prefer layout primitives over arithmetic.** Use `containerRelativeFrame(count:span:spacing:)`, `Grid`/`LazyVGrid`, and a custom `Layout` on iOS. Use CSS Grid with `grid-column: span n`, `subgrid`, and `gap` on the web. Avoid hard-coded widths and `.offset`/`position: relative` nudges.
- **Snap to the nearest grid value unless it changes the design's intent.** If snapping changes a size by more than one spacing step, or changes structure (e.g. flex → grid, a new breakpoint), list it and confirm before applying.
- **Respect the codebase:** existing token names, component patterns, the Tailwind version, the minimum iOS deployment target (check before using iOS 17+ APIs; the playbook lists fallbacks). Keep each change scoped to grid alignment.
- **Work one root-cause group at a time.** Build/typecheck after each group (`swift build` / `xcodebuild build`, `npm run build` / `tsc --noEmit`), so a regression points at one group.

## Phase 5: Verify

Re-run Phase 2 with the same spec, targets and routes. Then report:

- A before → after scorecard per target (errors, warnings, off-scale literals).
- Before/after annotated screenshots for the screens that changed most (Read them yourself first, to make sure nothing regressed visually, e.g. text truncation, clipped content, broken wrapping at compact widths).
- What's left, and why: intentional exceptions (now in `ignore`), or items the user chose not to fix.

Remaining real findings mean the work isn't done. Say so plainly rather than rounding the result up.
