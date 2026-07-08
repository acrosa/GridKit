import CoreGraphics
import Foundation

/// Vertical column grid: count, gutter width, and outer margins.
public struct ColumnSpec: Codable, Sendable, Equatable {
    public var count: Int
    /// Gap between adjacent columns, in points.
    public var gutter: CGFloat
    public var leadingMargin: CGFloat
    public var trailingMargin: CGFloat
    /// Optional 1-based inclusive range of columns to shade (e.g. a sidebar
    /// zone in an asymmetric editorial grid).
    public var highlightedColumns: ClosedRange<Int>?

    public init(
        count: Int,
        gutter: CGFloat,
        leadingMargin: CGFloat,
        trailingMargin: CGFloat,
        highlightedColumns: ClosedRange<Int>? = nil
    ) {
        self.count = count
        self.gutter = gutter
        self.leadingMargin = leadingMargin
        self.trailingMargin = trailingMargin
        self.highlightedColumns = highlightedColumns
    }

    public init(count: Int, gutter: CGFloat, margin: CGFloat) {
        self.init(count: count, gutter: gutter, leadingMargin: margin, trailingMargin: margin)
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        count = try c.decode(Int.self, forKey: .count)
        gutter = try c.decodeIfPresent(CGFloat.self, forKey: .gutter) ?? 16
        leadingMargin = try c.decodeIfPresent(CGFloat.self, forKey: .leadingMargin) ?? 16
        trailingMargin = try c.decodeIfPresent(CGFloat.self, forKey: .trailingMargin) ?? leadingMargin
        highlightedColumns = try c.decodeIfPresent(ClosedRange<Int>.self, forKey: .highlightedColumns)
    }
}

/// Horizontal row grid used by modular grids.
public struct RowSpec: Codable, Sendable, Equatable {
    public var count: Int
    public var gutter: CGFloat
    public var topMargin: CGFloat
    public var bottomMargin: CGFloat

    public init(count: Int, gutter: CGFloat, topMargin: CGFloat, bottomMargin: CGFloat) {
        self.count = count
        self.gutter = gutter
        self.topMargin = topMargin
        self.bottomMargin = bottomMargin
    }

    public init(count: Int, gutter: CGFloat, margin: CGFloat) {
        self.init(count: count, gutter: gutter, topMargin: margin, bottomMargin: margin)
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        count = try c.decode(Int.self, forKey: .count)
        gutter = try c.decodeIfPresent(CGFloat.self, forKey: .gutter) ?? 16
        topMargin = try c.decodeIfPresent(CGFloat.self, forKey: .topMargin) ?? 16
        bottomMargin = try c.decodeIfPresent(CGFloat.self, forKey: .bottomMargin) ?? topMargin
    }
}

/// Repeating horizontal lines at a fixed rhythm for typographic vertical rhythm.
public struct BaselineSpec: Codable, Sendable, Equatable {
    /// Distance between baselines, in points.
    public var rhythm: CGFloat
    /// Offset of the first baseline from the top of the grid area.
    public var offset: CGFloat
    /// Draw every Nth line stronger (e.g. every 4th line of a 4 pt grid marks
    /// the 16 pt "beat"). `nil` disables emphasis.
    public var emphasisEvery: Int?

    public init(rhythm: CGFloat, offset: CGFloat = 0, emphasisEvery: Int? = nil) {
        self.rhythm = rhythm
        self.offset = offset
        self.emphasisEvery = emphasisEvery
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        rhythm = try c.decode(CGFloat.self, forKey: .rhythm)
        offset = try c.decodeIfPresent(CGFloat.self, forKey: .offset) ?? 0
        emphasisEvery = try c.decodeIfPresent(Int.self, forKey: .emphasisEvery)
    }

    /// Rounds a font line height to the nearest multiple of `unit`, clamped to
    /// at least `unit`. Exposed for testability; used by the UIKit-deriving
    /// initializer.
    public static func rhythm(forLineHeight lineHeight: CGFloat, multiple: Int = 1, roundedTo unit: CGFloat = 1) -> CGFloat {
        let raw = lineHeight * CGFloat(max(multiple, 1))
        let snapped = (raw / unit).rounded() * unit
        return max(snapped, unit)
    }
}

/// A named horizontal or vertical guide at a fixed offset — hanglines, sink
/// lines, folios, nav/tab bar heights.
public struct KeyLine: Codable, Sendable, Equatable, Identifiable {
    public enum Axis: String, Codable, Sendable {
        case horizontal
        case vertical
    }

    /// Which edge the offset is measured from.
    public enum Anchor: String, Codable, Sendable {
        /// Top (horizontal lines) or leading (vertical lines).
        case start
        /// Bottom (horizontal lines) or trailing (vertical lines).
        case end
    }

    /// How `offset` is interpreted.
    public enum Unit: String, Codable, Sendable {
        case points
        /// Fraction of the grid area's extent along the line's axis (0...1).
        case fraction
    }

    public var name: String
    public var axis: Axis
    public var offset: CGFloat
    public var anchor: Anchor
    public var unit: Unit

    public var id: String { "\(name)-\(axis.rawValue)-\(anchor.rawValue)-\(offset)" }

    public init(name: String, axis: Axis, offset: CGFloat, anchor: Anchor = .start, unit: Unit = .points) {
        self.name = name
        self.axis = axis
        self.offset = offset
        self.anchor = anchor
        self.unit = unit
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        name = try c.decodeIfPresent(String.self, forKey: .name) ?? "Guide"
        axis = try c.decode(Axis.self, forKey: .axis)
        offset = try c.decode(CGFloat.self, forKey: .offset)
        anchor = try c.decodeIfPresent(Anchor.self, forKey: .anchor) ?? .start
        unit = try c.decodeIfPresent(Unit.self, forKey: .unit) ?? .points
    }
}

/// Independently toggleable layers of the overlay.
public struct GridLayers: OptionSet, Codable, Sendable, Equatable {
    public let rawValue: Int
    public init(rawValue: Int) { self.rawValue = rawValue }

    public static let columns = GridLayers(rawValue: 1 << 0)
    public static let rows = GridLayers(rawValue: 1 << 1)
    public static let baseline = GridLayers(rawValue: 1 << 2)
    public static let modules = GridLayers(rawValue: 1 << 3)
    public static let margins = GridLayers(rawValue: 1 << 4)
    public static let keyLines = GridLayers(rawValue: 1 << 5)
    public static let ruler = GridLayers(rawValue: 1 << 6)

    /// Everything except the spacing ruler, which is opt-in.
    public static let standard: GridLayers = [.columns, .rows, .baseline, .modules, .margins, .keyLines]
    public static let all: GridLayers = [.columns, .rows, .baseline, .modules, .margins, .keyLines, .ruler]

    public init(from decoder: Decoder) throws {
        let c = try decoder.singleValueContainer()
        rawValue = try c.decode(Int.self)
    }

    public func encode(to encoder: Encoder) throws {
        var c = encoder.singleValueContainer()
        try c.encode(rawValue)
    }
}

/// A modular type scale (ratio + base size) for the panel's scale inspector.
public struct ModularScale: Codable, Sendable, Equatable {
    public var ratio: Double
    public var baseSize: Double

    public init(ratio: Double, baseSize: Double) {
        self.ratio = ratio
        self.baseSize = baseSize
    }

    /// Sizes on the scale from `-below` steps under the base to `above` steps
    /// over it, in ascending order.
    public func steps(below: Int = 2, above: Int = 5) -> [Double] {
        (-below...above).map { baseSize * pow(ratio, Double($0)) }
    }
}

/// A complete grid definition composed of independent, stackable layers.
///
/// Configurations are `Codable` so teams can commit shared grid definitions
/// as JSON and load them with ``GridKit/load(contentsOf:)``.
public struct GridConfiguration: Codable, Sendable, Equatable {
    public var columns: ColumnSpec?
    public var rows: RowSpec?
    public var baseline: BaselineSpec?
    public var keyLines: [KeyLine]
    public var appearance: GridAppearance
    public var respectsSafeArea: Bool
    /// Which layers are currently drawn. Layers without a backing spec are
    /// skipped regardless of this value.
    public var layers: GridLayers
    /// Optional modular scale shown in the control panel's scale inspector.
    public var modularScale: ModularScale?

    public init(
        columns: ColumnSpec? = nil,
        rows: RowSpec? = nil,
        baseline: BaselineSpec? = nil,
        keyLines: [KeyLine] = [],
        appearance: GridAppearance = .magenta,
        respectsSafeArea: Bool = true,
        layers: GridLayers = .standard,
        modularScale: ModularScale? = nil
    ) {
        self.columns = columns
        self.rows = rows
        self.baseline = baseline
        self.keyLines = keyLines
        self.appearance = appearance
        self.respectsSafeArea = respectsSafeArea
        self.layers = layers
        self.modularScale = modularScale
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        columns = try c.decodeIfPresent(ColumnSpec.self, forKey: .columns)
        rows = try c.decodeIfPresent(RowSpec.self, forKey: .rows)
        baseline = try c.decodeIfPresent(BaselineSpec.self, forKey: .baseline)
        keyLines = try c.decodeIfPresent([KeyLine].self, forKey: .keyLines) ?? []
        appearance = try c.decodeIfPresent(GridAppearance.self, forKey: .appearance) ?? .magenta
        respectsSafeArea = try c.decodeIfPresent(Bool.self, forKey: .respectsSafeArea) ?? true
        layers = try c.decodeIfPresent(GridLayers.self, forKey: .layers) ?? .standard
        modularScale = try c.decodeIfPresent(ModularScale.self, forKey: .modularScale)
    }
}

#if canImport(UIKit)
import UIKit

public extension BaselineSpec {
    /// Derives a rhythm from a system text style's line height, rounded to the
    /// nearest `roundedTo` unit. Respects the current Dynamic Type setting at
    /// the time of creation.
    ///
    ///     BaselineSpec(deriving: .body, multiple: 1)
    init(deriving textStyle: UIFont.TextStyle, multiple: Int = 1, roundedTo unit: CGFloat = 1, emphasisEvery: Int? = nil) {
        let lineHeight = UIFont.preferredFont(forTextStyle: textStyle).lineHeight
        self.init(
            rhythm: Self.rhythm(forLineHeight: lineHeight, multiple: multiple, roundedTo: unit),
            emphasisEvery: emphasisEvery
        )
    }
}
#endif
