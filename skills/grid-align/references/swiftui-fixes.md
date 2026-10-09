# SwiftUI and UIKit fix playbook

Check the deployment target first (`IPHONEOS_DEPLOYMENT_TARGET` in the project, or `platforms:` in `Package.swift`). APIs marked 17+ need `if #available` or the fallback shown.

## 1. Tokens

Copy `assets/GridSpec.swift` into the app (it builds on iOS 16+), fill in the spec's numbers, and adapt names to any existing `Spacing`/`Layout`/`Theme` enum. If the project already has tokens, extend them rather than adding a second system. Then replace literals with tokens:

```swift
// before
VStack(alignment: .leading, spacing: 10) { … }.padding(.horizontal, 18)
// after
VStack(alignment: .leading, spacing: GridSpec.Space.s) { … }.padding(.horizontal, metrics.margin)
```

When an off-scale value appears many times (`scan_spacing.py` histogram), find out where it comes from first: a token definition, a shared `ViewModifier`, or a `ButtonStyle`/`LabelStyle`. Fix it there.

## 2. Screen margins and safe areas

| Situation | Fix |
|---|---|
| Plain screen | `.gridContainer()` at the screen root (margins + metrics in the environment) |
| `ScrollView` | `.contentMargins(.horizontal, metrics.margin, for: .scrollContent)` (17+), so content scrolls edge to edge while resting on the margins. Fallback: `.padding(.horizontal, m)` on the scroll *content*, not the ScrollView. |
| Content that must clear bars/overlays | `.safeAreaPadding(.bottom, h)` (17+) instead of padding + spacer hacks. `.safeAreaInset(edge:)` for custom bars. |
| `List` / `Form` | Row insets: `.listRowInsets(EdgeInsets(top: 0, leading: m, bottom: 0, trailing: m))`. Section spacing: `.listSectionSpacing(.custom(x))` (17+). `.contentMargins(.horizontal, m, for: .scrollContent)` (17+) works on List too. Don't add `.padding` inside rows on top of the default insets, since that's the classic doubled margin. |
| Doubled margin (`content-edge` finding) | Find nested `.padding(.horizontal)` calls. Keep only the outermost (screen-level) one. |
| Long-form text on iPad | Cap the width (`.frame(maxWidth: 672)`, roughly 66 characters of body text), then center it. Or adopt `single-column-reader`. |

Don't mix the system's default margins with the grid's. `.padding()` with no arguments is 16 pt on iPhone, but it's platform-defined. Pass the token explicitly.

## 3. Columns and spans

| Need | Primitive |
|---|---|
| Items in equal columns | `LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: metrics.gutter), count: n), spacing: rowGap)`. The `spacing:` on `GridItem` is the gutter *after* that column. |
| Mixed spans flowing across the grid | `ColumnGrid(metrics:)` + `.gridSpan(n)` from `GridSpec.swift`. It lands every child exactly on column edges at any width. |
| A view sized to n of N columns of its container | `.containerRelativeFrame(.horizontal, count: N, span: n, spacing: gutter)` (17+). Common in horizontal carousels (`ScrollView(.horizontal)` + `.scrollTargetLayout()`). Fallback: `metrics.width(spanning:in:)` with the width from a `GeometryReader` or an `onGeometryChange` (back-deployed to iOS 16 with Xcode 16) at the container. |
| Table-like alignment of labels and values | `Grid` / `GridRow`, with `.gridCellColumns(n)` for spans and `.gridColumnAlignment(.leading)`. Equal widths need `.frame(maxWidth: .infinity)` in the cells. |
| Size-class variants (`compact` vs `regular` grid) | `@Environment(\.horizontalSizeClass)` → `GridSpec.metrics(for:)` (`.gridContainer()` does this). Use `ViewThatFits` to choose between a 2-up and a stacked layout. |

Replace `.frame(width: 172)`-style hand-computed widths with a span. Use `.offset` only for animation and gestures: an `.offset` nudge moves the drawing but not the layout, so it never truly aligns.

## 4. Vertical rhythm and type

- Stack spacing: `VStack(spacing: GridSpec.Space.m)`. Avoid `Spacer().frame(height: 13)` and `Divider().padding(.vertical, 3)`.
- Fixed heights of controls, bars and tiles should be rhythm multiples: `.frame(minHeight: 44)` for a 4-pt rhythm, `48` for an 8-pt one.
- Line height: older SDKs have no line-height modifier on `Text` (check the newest SDK's Text APIs before reaching for a workaround). Use `.lineSpacing(GridSpec.lineSpacing(for: .body))` to make each line advance by a whole number of rhythm steps. Note that `lineSpacing` only adds space *between* lines, so a multi-line `Text`'s frame height is `lines × step − lineSpacing`. Account for that in the spacing below the text.
- Text with Dynamic Type: scale custom sizes with `@ScaledMetric(relativeTo: .body) var gap = GridSpec.Space.m`, and recompute rhythm-derived values from `UIFont.preferredFont(forTextStyle:)`. Don't freeze the layout at the default size.
- Align baselines across a row with `HStack(alignment: .firstTextBaseline)`. To align a view's edge to a key line, use `.alignmentGuide(.top) { d in d[.firstTextBaseline] - offset }` (hanglines).
- Type scale: map ad-hoc `.font(.system(size: 15))` to the scale's nearest step or, better, a text style (`.subheadline`), so Dynamic Type keeps working.

## 5. Key lines

Hanglines and folio lines are y offsets from the safe-area top. Express them as `.padding(.top, keyLine - currentTop)` on the first element of the section, or as an `alignmentGuide`. Never as an `.offset`. For fraction key lines (golden split), split with a `GeometryReader` or `containerRelativeFrame(.vertical) { h, _ in h * 0.382 }` (17+).

## UIKit

| Need | Fix |
|---|---|
| Screen margins | `view.directionalLayoutMargins = NSDirectionalEdgeInsets(top: 0, leading: m, bottom: 0, trailing: m)` **and** `viewRespectsSystemMinimumLayoutMargins = false` on the view controller. Otherwise the system minimum (16/20 pt) silently wins. Constrain to `layoutMarginsGuide`. |
| Readable text width | `readableContentGuide` |
| Columns | `UICollectionViewCompositionalLayout`: `NSCollectionLayoutGroup.horizontal(layoutSize:repeatingSubitem:count:)` (iOS 16+), `group.interItemSpacing = .fixed(gutter)`, `section.interGroupSpacing = rowGap`, `section.contentInsets = .init(top: 0, leading: m, bottom: 0, trailing: m)`, or `section.contentInsetsReference = .layoutMargins` to inherit the margins above. |
| Spans | a nested group whose width is `.fractionalWidth(CGFloat(span) / CGFloat(columns))` doesn't subtract the gutters. Compute absolute widths with `GridSpec.Metrics.width(spanning:in:)` inside `NSCollectionLayoutSection` providers (they receive `layoutEnvironment.container.effectiveContentSize`). |
| Stack views | `stackView.spacing = token`, `isLayoutMarginsRelativeArrangement = true` with `directionalLayoutMargins` for inner padding. |
| Auto Layout constants | replace literals with tokens. A `constant: 18` next to `constant: 16` almost always marks a misalignment. |
| Line height | `NSMutableParagraphStyle` with `minimumLineHeight = maximumLineHeight = k × rhythm`, plus a `baselineOffset` to recenter the glyphs (commonly `(lineHeight − font.lineHeight) / 4`; verify on screen, as the right divisor has changed between iOS versions). |
