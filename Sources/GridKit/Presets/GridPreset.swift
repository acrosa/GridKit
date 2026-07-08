import CoreGraphics
import Foundation

public enum GridPresetCategory: String, Codable, Sendable, CaseIterable, Identifiable {
    case columnSystems
    case rhythm
    case editorial
    case appLayouts

    public var id: String { rawValue }

    public var displayName: String {
        switch self {
        case .columnSystems: return "Column Systems"
        case .rhythm: return "Baseline & Rhythm"
        case .editorial: return "Editorial & Magazine"
        case .appLayouts: return "App Layouts"
        }
    }
}

/// A curated grid definition with metadata documenting its origin and
/// intended use.
public struct GridPreset: Identifiable, Sendable {
    public let id: String
    public let name: String
    public let category: GridPresetCategory
    /// Configuration used in regular width (and as the fallback everywhere).
    public let configuration: GridConfiguration
    /// Optional variant applied in compact horizontal size class.
    public let compactConfiguration: GridConfiguration?
    /// Historical/practical notes and recommended use.
    public let notes: String

    public init(
        id: String,
        name: String,
        category: GridPresetCategory,
        configuration: GridConfiguration,
        compactConfiguration: GridConfiguration? = nil,
        notes: String
    ) {
        self.id = id
        self.name = name
        self.category = category
        self.configuration = configuration
        self.compactConfiguration = compactConfiguration
        self.notes = notes
    }
}

// MARK: - Column systems

public extension GridPreset {
    /// 12 columns, 16 pt gutter, 16 pt margins. The versatile default.
    static let swissTwelveColumn = GridPreset(
        id: "swiss-12-column",
        name: "Swiss 12-Column",
        category: .columnSystems,
        configuration: GridConfiguration(
            columns: ColumnSpec(count: 12, gutter: 16, margin: 16)
        ),
        compactConfiguration: GridConfiguration(
            columns: ColumnSpec(count: 4, gutter: 16, margin: 16)
        ),
        notes: "The workhorse of Swiss-school layout: 12 divides into halves, thirds, quarters and sixths, making almost any arrangement possible. Renders 4 columns in compact width."
    )

    /// 8 columns for tablet/wide layouts.
    static let eightColumn = GridPreset(
        id: "eight-column",
        name: "8-Column",
        category: .columnSystems,
        configuration: GridConfiguration(
            columns: ColumnSpec(count: 8, gutter: 16, margin: 24)
        ),
        compactConfiguration: GridConfiguration(
            columns: ColumnSpec(count: 4, gutter: 16, margin: 16)
        ),
        notes: "A tablet-friendly system: 8 columns pair naturally with split views and two-up layouts on iPad."
    )

    /// 6 columns with generous 24 pt gutters.
    static let sixColumn = GridPreset(
        id: "six-column",
        name: "6-Column Airy",
        category: .columnSystems,
        configuration: GridConfiguration(
            columns: ColumnSpec(count: 6, gutter: 24, margin: 24)
        ),
        compactConfiguration: GridConfiguration(
            columns: ColumnSpec(count: 3, gutter: 20, margin: 20)
        ),
        notes: "Fewer, wider columns with generous gutters — suits content-forward marketing and gallery layouts where breathing room matters."
    )

    /// 4 columns, 8 pt gutter, 16 pt margins — Material-style phone grid.
    static let fourColumnMobile = GridPreset(
        id: "four-column-mobile",
        name: "4-Column Mobile",
        category: .columnSystems,
        configuration: GridConfiguration(
            columns: ColumnSpec(count: 4, gutter: 8, margin: 16)
        ),
        notes: "The Material Design phone grid: 4 columns, tight 8 pt gutters, 16 pt margins. A pragmatic default for phone-only apps."
    )

    /// One measure-limited text column, centered, for long-form reading.
    static let singleColumnReader = GridPreset(
        id: "single-column-reader",
        name: "Single-Column Reader",
        category: .columnSystems,
        configuration: GridConfiguration(
            columns: ColumnSpec(count: 1, gutter: 0, margin: 96),
            baseline: BaselineSpec(rhythm: 8, emphasisEvery: 3)
        ),
        compactConfiguration: GridConfiguration(
            columns: ColumnSpec(count: 1, gutter: 0, margin: 24),
            baseline: BaselineSpec(rhythm: 8, emphasisEvery: 3)
        ),
        notes: "A single measure-limited column (~66 characters at body size) with comfortable margins — the classic ideal for long-form reading. Pair with the 8 pt rhythm for paragraph spacing."
    )
}

// MARK: - Baseline / rhythm systems

public extension GridPreset {
    /// 4 pt baseline grid, emphasis every 4th line.
    static let fourPointRhythm = GridPreset(
        id: "four-point-rhythm",
        name: "4 pt Rhythm",
        category: .rhythm,
        configuration: GridConfiguration(
            baseline: BaselineSpec(rhythm: 4, emphasisEvery: 4)
        ),
        notes: "A fine 4 pt baseline grid; every 4th line marks the 16 pt beat. Use for dense UI where components sit on a 4 pt spacing system."
    )

    /// 8 pt baseline grid, emphasis every 3rd line.
    static let eightPointRhythm = GridPreset(
        id: "eight-point-rhythm",
        name: "8 pt Rhythm",
        category: .rhythm,
        configuration: GridConfiguration(
            baseline: BaselineSpec(rhythm: 8, emphasisEvery: 3)
        ),
        notes: "Matches the ubiquitous 8-pt spacing system; every 3rd line marks the 24 pt beat. The most common vertical rhythm for iOS apps."
    )

    /// Rhythm derived from the body text style's line height; adapts to the
    /// Dynamic Type setting in effect when the preset is applied.
    static var bodyDerivedRhythm: GridPreset {
        let spec: BaselineSpec
        #if canImport(UIKit)
        spec = BaselineSpec(deriving: .body, multiple: 1, roundedTo: 1, emphasisEvery: 4)
        #else
        spec = BaselineSpec(rhythm: 22, emphasisEvery: 4)
        #endif
        return GridPreset(
            id: "body-derived-rhythm",
            name: "Body-Derived Rhythm",
            category: .rhythm,
            configuration: GridConfiguration(
                baseline: spec,
                modularScale: ModularScale(ratio: 1.25, baseSize: 17)
            ),
            notes: "Rhythm derived from the preferred body font's line height, so the grid tracks Dynamic Type. Re-apply the preset after a text-size change to re-derive."
        )
    }
}

// MARK: - Editorial / magazine grids

public extension GridPreset {
    /// 3 × 5 modular grid with a hangline at the top module.
    static let modular3x5 = GridPreset(
        id: "modular-3x5",
        name: "Modular 3×5",
        category: .editorial,
        configuration: GridConfiguration(
            columns: ColumnSpec(count: 3, gutter: 16, margin: 24),
            rows: RowSpec(count: 5, gutter: 16, margin: 24),
            keyLines: [
                KeyLine(name: "Hangline", axis: .horizontal, offset: 0.2, anchor: .start, unit: .fraction),
            ]
        ),
        notes: "A Müller-Brockmann-style modular grid: 3 columns × 5 rows with a hangline one module down, where feature headlines and images hang. Classic magazine feature layout."
    )

    /// Denser modular grid for image-rich, catalog-like layouts.
    static let modular4x6 = GridPreset(
        id: "modular-4x6",
        name: "Modular 4×6",
        category: .editorial,
        configuration: GridConfiguration(
            columns: ColumnSpec(count: 4, gutter: 12, margin: 20),
            rows: RowSpec(count: 6, gutter: 12, margin: 20)
        ),
        notes: "A denser modular grid for image-rich, catalog-like layouts — product grids, photo indexes, and dashboards with many small units."
    )

    /// 5-column grid used asymmetrically: 2-column sidebar + 3-column body.
    static let asymmetricEditorial = GridPreset(
        id: "asymmetric-editorial",
        name: "Asymmetric Editorial",
        category: .editorial,
        configuration: GridConfiguration(
            columns: ColumnSpec(
                count: 5,
                gutter: 16,
                leadingMargin: 24,
                trailingMargin: 24,
                highlightedColumns: 1...2
            ),
            baseline: BaselineSpec(rhythm: 8, emphasisEvery: 3)
        ),
        notes: "A 5-column grid used asymmetrically: the tinted 2-column zone carries captions, pull quotes and sidebars; body copy sits on the remaining 3 columns. A staple of contemporary editorial design."
    )

    /// Golden-ratio vertical split with key lines.
    static let heroSplit = GridPreset(
        id: "hero-split",
        name: "Hero Split (Golden)",
        category: .editorial,
        configuration: GridConfiguration(
            keyLines: [
                KeyLine(name: "Golden section", axis: .horizontal, offset: 0.382, anchor: .start, unit: .fraction),
                KeyLine(name: "Golden section (inverse)", axis: .horizontal, offset: 0.618, anchor: .start, unit: .fraction),
            ]
        ),
        notes: "Horizontal key lines at the golden sections (0.382 / 0.618 of the height) for hero-image + content splits. Align the image bottom or content top to a section for a naturally balanced composition."
    )

    /// Modular grid with reserved folio/header and footer key lines.
    static let folioGrid = GridPreset(
        id: "folio-grid",
        name: "Folio Grid",
        category: .editorial,
        configuration: GridConfiguration(
            columns: ColumnSpec(count: 3, gutter: 16, margin: 24),
            rows: RowSpec(count: 4, gutter: 16, topMargin: 72, bottomMargin: 56),
            keyLines: [
                KeyLine(name: "Running head", axis: .horizontal, offset: 48, anchor: .start),
                KeyLine(name: "Folio", axis: .horizontal, offset: 40, anchor: .end),
            ]
        ),
        notes: "A book-like modular grid with reserved zones for running heads and folios (page furniture). Useful for reader and document apps where chrome must clear the content block."
    )
}

// MARK: - App-specific layouts

public extension GridPreset {
    /// Columns matching iOS layout margins, 44 pt touch-target rhythm, and
    /// key lines at nav bar and tab bar heights.
    static let iosStandard = GridPreset(
        id: "ios-standard",
        name: "iOS Standard",
        category: .appLayouts,
        configuration: GridConfiguration(
            columns: ColumnSpec(count: 1, gutter: 0, margin: 20),
            baseline: BaselineSpec(rhythm: 44),
            keyLines: [
                KeyLine(name: "Nav bar", axis: .horizontal, offset: 44, anchor: .start),
                KeyLine(name: "Tab bar", axis: .horizontal, offset: 49, anchor: .end),
            ]
        ),
        compactConfiguration: GridConfiguration(
            columns: ColumnSpec(count: 1, gutter: 0, margin: 16),
            baseline: BaselineSpec(rhythm: 44),
            keyLines: [
                KeyLine(name: "Nav bar", axis: .horizontal, offset: 44, anchor: .start),
                KeyLine(name: "Tab bar", axis: .horizontal, offset: 49, anchor: .end),
            ]
        ),
        notes: "iOS platform furniture: 16/20 pt readable margins, a 44 pt row rhythm for touch targets, and key lines at standard nav-bar and tab-bar heights (safe-area relative)."
    )

    /// Feed layout: full-width card zone with 16 pt insets, 12 pt inter-card rhythm.
    static let cardFeed = GridPreset(
        id: "card-feed",
        name: "Card Feed",
        category: .appLayouts,
        configuration: GridConfiguration(
            columns: ColumnSpec(count: 1, gutter: 0, margin: 16),
            baseline: BaselineSpec(rhythm: 12, emphasisEvery: 2)
        ),
        notes: "For scrolling card feeds: a full-width card zone with 16 pt side insets and a 12 pt rhythm to check inter-card spacing."
    )

    /// 2×N module grid with 12 pt gutters for widget/dashboard layouts.
    static let dashboardModules = GridPreset(
        id: "dashboard-modules",
        name: "Dashboard Modules",
        category: .appLayouts,
        configuration: GridConfiguration(
            columns: ColumnSpec(count: 2, gutter: 12, margin: 16),
            rows: RowSpec(count: 6, gutter: 12, margin: 16)
        ),
        notes: "A 2-across module grid with 12 pt gutters, matching widget/dashboard layouts. Modules shade the cells your tiles should fill."
    )
}

// MARK: - Registry

public extension GridPreset {
    static let all: [GridPreset] = [
        // Column systems
        .swissTwelveColumn, .eightColumn, .sixColumn, .fourColumnMobile, .singleColumnReader,
        // Rhythm
        .fourPointRhythm, .eightPointRhythm, .bodyDerivedRhythm,
        // Editorial
        .modular3x5, .modular4x6, .asymmetricEditorial, .heroSplit, .folioGrid,
        // App layouts
        .iosStandard, .cardFeed, .dashboardModules,
    ]

    static func preset(withID id: String) -> GridPreset? {
        all.first { $0.id == id }
    }
}
