# `.gridkit/spec.json`

The audit target. It is a superset of GridKit's configuration JSON: any file GridKit loads (`Examples/brand-grid.json`) is also a valid spec, treated as the regular variant with defaults for everything else.

```json
{
  "platform": "web",
  "preset": "swiss-12-column",
  "regular": { "columns": { "gutter": 24 }, "baseline": { "rhythm": 8, "emphasisEvery": 3 }, "maxContentWidth": 1200 },
  "compact": { "columns": { "count": 4, "leadingMargin": 16, "trailingMargin": 16 } },
  "compactBreakpoint": 768,
  "spacing": { "base": 8, "allow": [0, 1, 2] },
  "typeScale": [12, 14, 16, 20, 24, 32, 40],
  "tolerance": 1,
  "nearMiss": 8,
  "rem": 16,
  "ignore": ["div.marquee", "Hero image"],
  "targets": [
    { "name": "mobile", "width": 390, "height": 844 },
    { "name": "desktop", "width": 1440, "height": 900 }
  ],
  "web": { "url": "http://localhost:5173", "routes": ["/", "/pricing"] }
}
```

| Field | Meaning |
|---|---|
| `platform` | `"ios"` (values in pt) or `"web"` (CSS px). Picks per-platform preset variants and defaults. |
| `preset` | Optional base from GridKit's preset library (`gridspec.py presets`). |
| `regular` / `compact` | GridKit configuration layers (`columns`, `rows`, `baseline`, `keyLines`, `modularScale`, `respectsSafeArea`), plus `maxContentWidth`. They merge over the preset layer by layer, so `{"columns": {"gutter": 24}}` changes only the gutter. `null` removes a layer. A tweak to `regular` also carries into the preset's compact variant, except for column count. `"compact": null` disables the compact variant. |
| `columns` | `count`, `gutter`, `leadingMargin`, `trailingMargin` (or `margin` for both), optional `highlightedColumns: [from, to]`. |
| `baseline` | `rhythm`, `offset`, `emphasisEvery`: the horizontal baseline grid. The rhythm drives the vertical gap, line-height and text-baseline checks. `gridspec.py init` always writes one: `--rhythm`, else the preset's, else the spacing base. `--no-rhythm` opts out. |
| `baselineAlignment` | `"consistent"` (default), `"strict"` or `"off"`. How the web audit judges text baselines against the grid (see `frames-format.md`, Baseline grid). |
| `maxContentWidth` | Caps the content area and centers it (a centered `.container`). GridKit's overlay has no equivalent. The audit adds the extra inset to both margins. |
| `compactBreakpoint` | Web: viewport widths below this use `compact` (default 768, matching gridkit-react). iOS: width heuristic for the horizontal size class (default 600). Frames captured by the UI test carry their real size class, which wins. |
| `spacing` | The spacing scale. `base`: any multiple is allowed (default 4). Or `scale`: an explicit list. `allow`: extra always-OK values (default `[0, 1]` for hairlines). Gutters and margins from the grid are always allowed. |
| `typeScale` | Allowed font sizes. If absent, `modularScale` steps are used. If neither is set, font sizes are not checked. |
| `tolerance` | Max deviation (pt/px) still counted as aligned. Default 1. iOS frames get +⅓ pt for 3× rounding. |
| `nearMiss` | Max deviation treated as an accidental misalignment. Larger offsets are assumed intentional. Default 8. |
| `rem` | Root font size for converting `rem` values in the static scan (default 16). |
| `ignore` | Substrings matched against a finding's selector, label or component. Use it for intentional exceptions, and document why in the report. |
| `targets` | Viewports to audit. iOS targets carry `safeArea` (XCUITest can't read it, so the audit looks it up here by width × height) and `scale`. |
| `web` | `url` + `routes` for `web_capture.mjs`. |

## Common iOS targets (portrait, pt)

| Device | Size | Safe area top / bottom | Scale |
|---|---|---|---|
| iPhone SE (3rd gen) | 375 × 667 | 20 / 0 | 2 |
| iPhone 16 / 15 / 14 Pro | 393 × 852 | 59 / 34 | 3 |
| iPhone 16 Plus / 15 Pro Max | 430 × 932 | 59 / 34 | 3 |
| iPhone 16 Pro | 402 × 874 | 62 / 34 | 3 |
| iPhone 16 Pro Max | 440 × 956 | 62 / 34 | 3 |
| iPad Pro 11" (M4) | 834 × 1210 | 24 / 20 | 2 |
| iPad Pro 13" (M4) | 1032 × 1376 | 24 / 20 | 2 |

These are typical values. When it matters, confirm them on the simulator (`GeometryReader` safe-area insets, or GridKit's panel).

## Choosing values with the user

- **Gutter vs margin:** margins ≥ gutter reads as framed. On phones, 16 pt margins with 8–16 gutters is the norm (Material: 16/8, iOS readable margins: 16/20).
- **Spacing base:** 8 for most products, 4 for dense data UIs. Expect existing values like 12 and 20 on an 8-pt base. Either allow them via `allow`, or plan to migrate them.
- **Rhythm:** use 4 or 8 for UI, or the body line height (`body-derived-rhythm`) for text-heavy reading layouts. Match it to the spacing base, or to a divisor of it, so every on-scale gap is also on the rhythm. `emphasisEvery` marks the larger beat, e.g. 3 × 8 = 24 for section spacing.
