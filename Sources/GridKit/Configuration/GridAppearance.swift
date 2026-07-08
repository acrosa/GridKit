import CoreGraphics
import SwiftUI

/// A codable RGBA color so grid configurations can be serialized as JSON and
/// shared between team members without depending on platform color types.
public struct GridColor: Codable, Sendable, Equatable {
    public var red: Double
    public var green: Double
    public var blue: Double
    public var alpha: Double

    public init(red: Double, green: Double, blue: Double, alpha: Double = 1) {
        self.red = red
        self.green = green
        self.blue = blue
        self.alpha = alpha
    }

    public var color: Color {
        Color(.sRGB, red: red, green: green, blue: blue, opacity: alpha)
    }

    /// Classic layout-guide magenta.
    public static let magenta = GridColor(red: 1.00, green: 0.10, blue: 0.65)
    public static let cyan = GridColor(red: 0.00, green: 0.75, blue: 0.95)
    public static let red = GridColor(red: 0.95, green: 0.20, blue: 0.15)
}

/// Blend modes supported by the overlay. `difference` keeps lines visible on
/// any background (dark or light) at the cost of shifting hues.
public enum GridBlendMode: String, Codable, Sendable, CaseIterable {
    case normal
    case difference

    public var swiftUIBlendMode: BlendMode {
        switch self {
        case .normal: return .normal
        case .difference: return .difference
        }
    }
}

/// Visual styling shared by every layer of a grid configuration.
public struct GridAppearance: Codable, Sendable, Equatable {
    /// Color of regular grid lines.
    public var lineColor: GridColor
    /// Color of emphasized lines (every Nth baseline, key lines).
    public var emphasisColor: GridColor
    /// Fill used to tint margin and gutter zones.
    public var marginTint: GridColor
    /// Fill used to shade modules and highlighted column zones.
    public var moduleTint: GridColor
    /// Overall overlay opacity, 0...1.
    public var opacity: Double
    /// Explicit line width in points. `nil` renders hairlines (1 physical
    /// pixel, i.e. 1/scale pt) — the recommended default.
    public var lineWidth: CGFloat?
    public var blendMode: GridBlendMode

    public init(
        lineColor: GridColor = .magenta,
        emphasisColor: GridColor? = nil,
        marginTint: GridColor? = nil,
        moduleTint: GridColor? = nil,
        opacity: Double = 0.6,
        lineWidth: CGFloat? = nil,
        blendMode: GridBlendMode = .normal
    ) {
        self.lineColor = lineColor
        self.emphasisColor = emphasisColor
            ?? GridColor(red: lineColor.red, green: lineColor.green, blue: lineColor.blue, alpha: 1)
        self.marginTint = marginTint
            ?? GridColor(red: lineColor.red, green: lineColor.green, blue: lineColor.blue, alpha: 0.06)
        self.moduleTint = moduleTint
            ?? GridColor(red: lineColor.red, green: lineColor.green, blue: lineColor.blue, alpha: 0.10)
        self.opacity = opacity
        self.lineWidth = lineWidth
        self.blendMode = blendMode
    }

    public static let magenta = GridAppearance(lineColor: .magenta)
    public static let cyan = GridAppearance(lineColor: .cyan)
    public static let red = GridAppearance(lineColor: .red)

    // Forgiving decoding so hand-written JSON may omit any field.
    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        let line = try c.decodeIfPresent(GridColor.self, forKey: .lineColor) ?? .magenta
        self.init(
            lineColor: line,
            emphasisColor: try c.decodeIfPresent(GridColor.self, forKey: .emphasisColor),
            marginTint: try c.decodeIfPresent(GridColor.self, forKey: .marginTint),
            moduleTint: try c.decodeIfPresent(GridColor.self, forKey: .moduleTint),
            opacity: try c.decodeIfPresent(Double.self, forKey: .opacity) ?? 0.6,
            lineWidth: try c.decodeIfPresent(CGFloat.self, forKey: .lineWidth),
            blendMode: try c.decodeIfPresent(GridBlendMode.self, forKey: .blendMode) ?? .normal
        )
    }
}
