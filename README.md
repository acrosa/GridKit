# GridKit

A development-time SwiftUI library that overlays configurable layout grids on top of a running app's UI, so designers and developers can verify that views align to a grid system, respect margins/gutters, and adhere to vertical (baseline) rhythm.

Ships with a curated collection of professional grid and typographic layout presets — from classic 12-column web-style grids to magazine-inspired modular and asymmetric grids.

**Platform:** iOS 16+ · Swift 5.9+ · Zero dependencies · SPM

> GridKit is a debug tool: it compiles to a no-op in release builds unless explicitly force-enabled.

<img width="1210" height="834" alt="IMG_0138" src="https://github.com/user-attachments/assets/649985ad-87fc-4559-9473-e3bd7a4d15cd" />

## Installation

Add GridKit to your `Package.swift`:

```swift
dependencies: [
    .package(url: "https://github.com/acrosa/GridKit.git", from: "0.1.0"),
]
```

…and list it as a dependency of your target. In Xcode: **File → Add Package Dependencies…** and paste the URL.

## Setup

One modifier at the app root:

```swift
import GridKit

@main
struct MyApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
                .gridKit(.enabled(activation: .shake))
        }
    }
}
```

In non-`DEBUG` builds `gridKit(_:)` resolves to the unmodified view — no overlay window, no gesture recognizers — unless `.enabled(force: true)` is passed. `force: true` is intended for internal/TestFlight builds only.

### Activation modes

| Mode | Use |
|---|---|
| `.shake` | Device shake gesture (default). Note: conflicts with shake-to-undo in text-heavy apps. |
| `.threeFingerLongPress` | Simulator-friendly. |
| `.floatingButton` | An always-available draggable pill — tap to toggle, tap the label to configure. |
| `.manual` | Only via the programmatic API. |

### Programmatic control

```swift
GridKit.shared.show()
GridKit.shared.hide()
GridKit.shared.toggle()
GridKit.shared.apply(preset: .swissTwelveColumn)
GridKit.shared.apply(configuration: myCustomGrid)
if let url = Bundle.main.url(forResource: "brand-grid", withExtension: "json") {
    try GridKit.shared.load(contentsOf: url)
}
let image = GridKit.shared.snapshot()   // app + overlay composite for design review
```

## Grid anatomy

A `GridConfiguration` is composed of independent, stackable layers, each individually toggleable from the control panel:

- **Columns** — count, gutter, outer margins; safe-area-relative or full-bleed; optional highlighted column zone for asymmetric grids.
- **Rows** — horizontal row grid for modular grids.
- **Baseline grid** — repeating lines at a fixed rhythm with every-Nth-line emphasis; derivable from a text style's line height (`BaselineSpec(deriving: .body)`), tracking Dynamic Type.
- **Modules** — shaded intersection cells of columns × rows.
- **Margins & gutters** — rendered as tinted zones.
- **Key lines** — named guides (hanglines, folios, nav/tab bar heights) at pt offsets or fractional positions, anchored to either edge.
- **Spacing ruler** — opt-in edge ruler with pt ticks.

Configurations are `Codable` — commit shared grid definitions as JSON (see [`Examples/brand-grid.json`](Examples/brand-grid.json)) and load them at runtime.

## Preset library

Sixteen presets in four categories, each with notes documenting its origin and intended use:

| Category | Presets |
|---|---|
| Column systems | `swissTwelveColumn`, `eightColumn`, `sixColumn`, `fourColumnMobile`, `singleColumnReader` |
| Baseline / rhythm | `fourPointRhythm`, `eightPointRhythm`, `bodyDerivedRhythm` |
| Editorial / magazine | `modular3x5`, `modular4x6`, `asymmetricEditorial`, `heroSplit`, `folioGrid` |
| App layouts | `iosStandard`, `cardFeed`, `dashboardModules` |

Presets adapt to size classes: column systems define compact-width variants (e.g. `swissTwelveColumn` renders 4 columns in compact width).

## Control panel

Summoned by the activation gesture — or always present as a floating pill in `.floatingButton` mode (tap the glyph to toggle the grid, tap the label to expand). Draggable and collapsible; state persists across launches:

- **Preset browser** with live miniature thumbnails, grouped by category.
- **Layer toggles** for columns / rows / baseline / modules / margins / key lines / ruler.
- **Live parameter editing** — column count, gutter, margins, rhythm, emphasis.
- **Appearance** — magenta / cyan / red / custom color, opacity, and a *difference* blend mode that keeps lines visible on any background.
- **Snapshot** (screen + grid composite) and **JSON export** for design review.

## Architecture notes

- The overlay renders in a separate passthrough `UIWindow` above the alert level, so it stays on top of sheets and full-screen covers while never intercepting the host app's touches — only the control pill / panel is interactive (matched by its reported frame, so the rest of the window passes straight through).
- Drawing uses `Canvas` and only invalidates on configuration/size/scale changes.
- Lines are pixel-snapped (hairlines at 1/scale pt, odd-pixel strokes centered on pixel centers) for crisp rendering on 2x/3x displays.
- All layout math lives in `GridGeometry`, a pure, unit-tested layer with no UIKit/SwiftUI dependencies.
- One overlay window per scene (multi-window iPad support); the overlay is hidden from the accessibility tree while the panel is fully accessible.

## Privacy & App Review

No data collection, no networking. Inert in release builds by default; ship `force: true` only in internal/TestFlight builds.

## Testing

```bash
swift test   # on a macOS host, or via an iOS simulator destination in Xcode
```

Unit tests cover configuration codability (including the JSON fixture), rhythm derivation from fonts, pixel-snapping math, column/row/module/baseline geometry, and preset-library integrity. Snapshot tests of each preset at key device sizes and UI tests for activation gestures are on the roadmap alongside the alignment audit, macOS/visionOS support, and Xcode Previews integration.
