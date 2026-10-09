# gridkit-react

Development-time layout grid overlays for React web apps — the web counterpart of [GridKit for iOS](../README.md). Add one component at your app root, start your site, and toggle a configurable grid (columns, baseline rhythm, modules, key lines) on top of whatever is rendering right now, with a floating control panel to browse presets and tune parameters live.

- **Same JSON format as the iOS library** — commit one `brand-grid.json` and load it on both platforms.
- **Zero dependencies** beyond React 18+. Renders nothing in production builds.
- **Pixel-snapped hairlines** drawn on a `<canvas>` at device resolution; a passthrough overlay that never intercepts clicks.
- **17 presets** — Swiss 12-column, 8-column, 4/8 px rhythm, body-derived rhythm, modular 3×5 / 4×6, asymmetric editorial, golden hero split, folio, Bootstrap container, app shell, card feed, dashboard modules.

## Install

```bash
npm install --save-dev gridkit-react
```

## Setup

One component at the app root:

```tsx
import { GridKitOverlay } from "gridkit-react";

export function App() {
  return (
    <>
      <YourApp />
      <GridKitOverlay />
    </>
  );
}
```

Start your app. A small **GridKit** pill appears in the bottom-right corner: tap the grid glyph to toggle the overlay, tap the label to open the control panel, drag it anywhere. `Alt`+`Shift`+`G` (`⌥⇧G` on macOS) toggles the grid from the keyboard.

By default the overlay is active only when `process.env.NODE_ENV !== "production"`, so it compiles out of production bundles. Pass `enabled` to control this explicitly (e.g. `enabled={isStaging}` for internal builds).

### Options

```tsx
<GridKitOverlay
  activation={["floatingButton", "keyboard"]} // default
  hotkey="alt+shift+g"                        // "mod" = ⌘ on macOS, Ctrl elsewhere
  initialPreset={swissTwelveColumn}           // seeds the first launch only
  safeArea={{ top: 64 }}                      // e.g. a fixed site header
  compactBreakpoint={768}                     // below this, presets use their compact variant
  anchor="viewport"                           // or "document" to scroll with the page
  enabled={process.env.NODE_ENV !== "production"}
/>
```

| Activation | Use |
|---|---|
| `floatingButton` | Always-available draggable pill — tap to toggle, tap the label to configure. |
| `keyboard` | Shortcut (default `alt+shift+g`). Ignored while typing for plain, unmodified keys. |
| `urlParam` | `?gridkit=1` shows the grid on load — handy for sharing review links. |
| `shake` | Device shake via DeviceMotion (Android; iOS Safari asks for permission on first tap). |
| `manual` | Only via the programmatic API. |

`safeArea` is merged with the browser's `env(safe-area-inset-*)` (notches, home indicators). Columns, rows and key lines are inset by it when the configuration's *Respect safe area* is on, so the grid starts below your fixed header — the web equivalent of iOS safe areas.

### Programmatic control

```ts
import { GridKit, swissTwelveColumn } from "gridkit-react";

GridKit.shared.show();
GridKit.shared.hide();
GridKit.shared.toggle();
GridKit.shared.apply(swissTwelveColumn);
GridKit.shared.applyConfiguration(myCustomGrid);
await GridKit.shared.load("/brand-grid.json");    // same file the iOS app loads
GridKit.shared.loadJSON(jsonString);
const json = GridKit.shared.exportJSON();
const png = await GridKit.shared.snapshot();      // transparent PNG Blob of the overlay layer
```

Or reactively, from any component:

```tsx
const { isVisible, toggle, apply, appliedPresetID } = useGridKit();
```

### Anchoring

The iOS overlay is pinned to the screen; on the web that's **Viewport** mode (default). Switch the panel's *Anchor* to **Document** and the grid scrolls with the page instead: baselines stay locked to your content, rows and modules span the whole document, and key lines measure from the top of the page. The choice persists in `localStorage`.

## Grid anatomy

A `GridConfiguration` is composed of independent, stackable layers, each toggleable from the panel:

- **Columns** — count, gutter, outer margins; optional highlighted column zone for asymmetric grids.
- **Rows** — horizontal row grid for modular grids.
- **Baseline grid** — repeating lines at a fixed rhythm with every-Nth-line emphasis. `bodyDerivedRhythm()` derives the rhythm from `body`'s computed line-height.
- **Modules** — shaded intersection cells of columns × rows.
- **Margins & gutters** — rendered as tinted zones.
- **Key lines** — named guides (header height, sidebar width, hanglines) at px offsets or fractional positions, anchored to either edge.
- **Spacing ruler** — opt-in edge ruler with px ticks.

Configurations are plain JSON, identical to the iOS format:

```json
{
  "columns": { "count": 12, "gutter": 16, "leadingMargin": 20, "trailingMargin": 20 },
  "baseline": { "rhythm": 8, "emphasisEvery": 3 },
  "keyLines": [{ "name": "Hangline", "axis": "horizontal", "offset": 96, "anchor": "start", "unit": "points" }],
  "appearance": { "lineColor": { "red": 0, "green": 0.75, "blue": 0.95, "alpha": 1 }, "opacity": 0.7, "blendMode": "difference" },
  "respectsSafeArea": true
}
```

Build them in code with the helpers, too:

```ts
import { configuration, columns, baseline, keyLine } from "gridkit-react";

const brand = configuration({
  columns: columns(12, 16, 20),
  baseline: baseline(8, 3),
  keyLines: [keyLine("Hangline", "horizontal", 96)],
});
```

## Control panel

- **Preset browser** with live miniature thumbnails, grouped by category.
- **Layer toggles** for columns / rows / baseline / modules / margins / key lines / ruler. Turning on *Baseline* for a grid without one adds an editable 8 px baseline grid.
- **Live parameter editing** — column count, gutter, margins, rhythm, emphasis, baseline offset.
- **Appearance** — magenta / cyan / red / custom color, opacity, and a *difference* blend mode that keeps lines visible on any background.
- **Anchor** — viewport or document.
- **Snapshot** (overlay as a transparent PNG at device resolution, for layering over a screenshot in Figma), **Export / Copy / Import JSON**.

Panel position, collapsed state, anchor and the configuration persist across reloads.

## Architecture notes

- The overlay is a `position: fixed` portal on `document.body` with `pointer-events: none`; only the pill / panel opt back in — the web equivalent of the iOS passthrough window.
- The grid is drawn with the Canvas 2D API and only redraws when the configuration, viewport, scroll position (document mode) or device pixel ratio changes. Opacity and blend mode are applied as CSS so the browser composites them.
- Lines are pixel-snapped (hairlines at 1/devicePixelRatio px, odd-pixel strokes centered on pixel centers) for crisp rendering on 2x/3x displays.
- All layout math lives in `GridGeometry`, a pure, unit-tested module with no DOM dependencies — a line-for-line port of the Swift version, tested against the same cases.
- `GridKit.shared` is a tiny external store: React reads it through `useSyncExternalStore`; plain scripts can drive it without React.

## Development

```bash
cd web
npm install
npm run dev        # demo site at http://localhost:5173
npm test           # vitest: geometry, JSON codec (against ../Examples/brand-grid.json), presets, runtime
npm run typecheck
npm run build      # ESM + CJS + .d.ts into dist/
```

## Snapshot limitations

Browsers can't composite the page itself into an image without a screen-capture permission prompt, so `snapshot()` exports the overlay layer alone as a transparent PNG. Take a normal screenshot of the page and layer the PNG over it in your design tool.

## License

MIT
