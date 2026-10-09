# Frames format and audit checks

## Frames JSON

Produced by `collect_frames.js` (web) and `assets/GridAuditFrames.swift` (iOS). Anything else that can produce it can be audited too, e.g. the `device-interaction` skill's UI hierarchy, a Figma export, or a Storybook story.

```json
{
  "platform": "web",
  "name": "home@390",
  "viewport": { "width": 390, "height": 844, "scale": 3 },
  "safeArea": { "top": 0, "leading": 0, "bottom": 0, "trailing": 0 },
  "sizeClass": "compact",
  "page": { "scrollWidth": 390, "scrollHeight": 2400 },
  "elements": [
    {
      "id": 7, "parent": 3, "kind": "text", "tag": "h2", "type": "staticText",
      "selector": "section.features > h2.title", "label": "Features", "component": "FeatureGrid",
      "x": 16, "y": 412, "w": 358, "h": 32,
      "style": { "paddingLeft": 0, "marginTop": 24, "rowGap": null, "lineHeight": 32, "fontSize": 28, "visual": false },
      "baseline": 437
    }
  ]
}
```

- Coordinates are points (iOS) or CSS px (web). `x` is measured from the leading edge of the screen or page, `y` from the top of the page (web, full document) or the screen (iOS).
- `kind` is one of `text`, `media`, `control`, `container`. `parent` is the nearest *collected* ancestor. Web wrappers whose box matches their parent's exactly are skipped.
- `style` is web only. `visual` means the box paints something (background, border, shadow). Its padding is then a design choice, not a stray inset.
- `baseline` (web, text elements) is the document y of the first line's alphabetic baseline. `collect_frames.js` measures it by briefly inserting a zero-size inline-block probe, only in block/inline-block/list-item/table-cell layouts, where the probe can't move anything. It's `null` elsewhere and absent on iOS.
- `safeArea` and `sizeClass` are optional. iOS files omit `safeArea`, and the audit takes it from the spec target with the same width × height.
- iOS: SwiftUI stacks have no accessibility element, so most leaves have the window as parent. To give a group its own frame, add `.accessibilityElement(children: .contain)` and an identifier (debug builds only, if preferred).

## Checks

| Check | Severity | Fires when | Typical root cause |
|---|---|---|---|
| `overflow` | error | page `scrollWidth` > viewport width | fixed widths, `100vw` + padding, unbreakable strings, flex children without `min-width: 0` |
| `margin` | error | a non-container element crosses into the outer margins, and isn't full-bleed | negative margins, missing container, an `.offset` |
| `content-edge` | warn | a content-wide wrapper with no visible box insets all of its children (web), or nothing reaches the leading content edge (iOS) | doubled margins: page padding + section padding, `List` inset + extra `.padding` |
| `column-edge` | warn | a layout-level edge is `tolerance` < Δ ≤ `nearMiss` from the nearest column start/end | off-scale padding (18 vs 16), hand-sized widths, border widths not in `box-sizing` |
| `span` | warn | a layout-level box starts on a column but is slightly wider/narrower than an n-column span | fixed `width`/`.frame(width:)`, wrong gutter |
| `rhythm` | warn | the vertical gap between stacked siblings isn't a multiple of the rhythm (or on the spacing scale) | stack spacing, default `<h1>` margins, line-height leakage |
| `spacing` | warn | computed padding/margin/gap is off the spacing scale (web) | literal values, `em` margins, browser defaults |
| `type` | warn / info | line-height is not a rhythm multiple (warn), or a font size is off the type scale (info) | unitless line-heights, default `normal` |
| `baseline` | warn | (web) a text block's baseline is off the baseline grid. See below. | an off-rhythm gap or height above it; half-leading in strict mode |
| `key-line` | warn | a top/bottom edge (or left/right edge, for vertical key lines) is a near miss of a key line or row edge | header height, hero split, module heights in modular grids |

"Layout-level" means a child of a box that spans the whole content area. Those are the boxes the column grid governs. Content inside a narrower box, such as a card's text, follows that box's padding and is checked only for spacing and rhythm.

## Baseline grid

The spec's `baseline` layer is the horizontal line grid. Three checks use it: `rhythm` (gaps between stacked siblings), `type` (line heights), and `baseline` (where text actually sits). The screenshots draw it in cyan from `firstLine` (the safe-area top plus `offset`), with every `emphasisEvery`-th line stronger. Rows of modular grids are drawn as magenta bands labeled R1, R2, and so on.

In CSS a line box sits on the rhythm, but its glyph baseline sits inside it, at an offset set by the font and the line-height. A 16/24 paragraph on a perfect 8 px rhythm has its baseline about 2 px below a line, and that's correct. `baselineAlignment` in the spec picks how strict to be:

| Mode | Flags | Use when |
|---|---|---|
| `consistent` (default) | text whose offset differs from other text with the same font size and line height. It has drifted, because something above it is off the rhythm. | almost always |
| `strict` | every baseline that isn't on a line | a true typographic baseline grid (editorial, reading apps), after the fixes in `css-fixes.md` §4 |
| `off` | nothing | the layout intentionally ignores rhythm |

The markdown header reports `Baselines: N of M text blocks sit exactly on a line; K of M keep their text style's phase`. A drifted baseline shows on the screenshot as a solid line under the text, at its measured baseline.

iOS frames carry no baselines. Use `rhythm` on non-text elements, and the `lineSpacing` technique in `swiftui-fixes.md` §4.

## Reading results and false positives

- **Full-bleed and overhanging media** (carousels, edge-to-edge images) are skipped automatically when they span the viewport. Partial bleeds will show up, so confirm them visually and add them to `ignore`.
- **Centered content** (hero headlines, empty states) legitimately sits off-column. Dismiss it, unless it's centered in the wrong container.
- **iOS text frames** include font leading, so text-to-text gaps are skipped and text edges are approximate. Use images, buttons and grouped containers for vertical rhythm.
- **System chrome** (nav bars, tab bars, toolbars, keyboard) is excluded on iOS, since UIKit lays it out.
- **Sub-pixel values** (e.g. `21.44`) usually come from `em`-based browser defaults (`h1 { margin: 0.67em }`). Fix them at the root, with a reset or explicit margins.
- **The same value repeated** across many elements is one root cause. Fix the token or component, not each instance.

## Running the analyzer directly

```bash
python3 $SKILL/scripts/audit_frames.py --spec .gridkit/spec.json home@390.frames.json             # markdown table
python3 $SKILL/scripts/audit_frames.py --spec .gridkit/spec.json home@390.frames.json --format json > home@390.audit.json
python3 $SKILL/scripts/audit_frames.py --spec .gridkit/spec.json home@390.frames.json --near-miss 12
```
