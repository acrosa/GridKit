import CoreGraphics

/// Platform-independent edge insets so the geometry layer stays free of
/// SwiftUI/UIKit types (and unit-testable anywhere).
public struct GridInsets: Sendable, Equatable {
    public var top: CGFloat
    public var leading: CGFloat
    public var bottom: CGFloat
    public var trailing: CGFloat

    public init(top: CGFloat = 0, leading: CGFloat = 0, bottom: CGFloat = 0, trailing: CGFloat = 0) {
        self.top = top
        self.leading = leading
        self.bottom = bottom
        self.trailing = trailing
    }

    public static let zero = GridInsets()
}

/// A resolved line position along one axis.
public struct GridLine: Sendable, Equatable {
    public let position: CGFloat
    public let isEmphasis: Bool

    public init(position: CGFloat, isEmphasis: Bool = false) {
        self.position = position
        self.isEmphasis = isEmphasis
    }
}

/// Pure layout math for the overlay renderer. All functions are deterministic
/// and covered by unit tests; the Canvas layer only converts their output to
/// paths.
public enum GridGeometry {
    // MARK: Pixel snapping

    /// Width of a 1-physical-pixel hairline in points.
    public static func hairlineWidth(scale: CGFloat) -> CGFloat {
        1 / max(scale, 1)
    }

    /// Snaps a stroke's center position so the stroke covers whole physical
    /// pixels and renders crisp on 2x/3x displays.
    ///
    /// Strokes whose width is an odd number of pixels must be centered on a
    /// pixel *center* (boundary + half pixel); even-pixel strokes on a pixel
    /// *boundary*.
    public static func snappedLinePosition(_ position: CGFloat, scale: CGFloat, lineWidth: CGFloat) -> CGFloat {
        let scale = max(scale, 1)
        let pixelWidth = (lineWidth * scale).rounded()
        if pixelWidth.truncatingRemainder(dividingBy: 2) == 1 {
            return (floor(position * scale) + 0.5) / scale
        }
        return (position * scale).rounded() / scale
    }

    // MARK: Columns & rows

    /// The horizontal grid area after margins and (optionally) safe-area
    /// insets. Returns `nil` when there is no positive space to draw in.
    public static func contentSpan(
        total: CGFloat,
        startMargin: CGFloat,
        endMargin: CGFloat,
        safeStart: CGFloat,
        safeEnd: CGFloat,
        respectsSafeArea: Bool
    ) -> ClosedRange<CGFloat>? {
        let start = startMargin + (respectsSafeArea ? safeStart : 0)
        let end = total - endMargin - (respectsSafeArea ? safeEnd : 0)
        guard end > start else { return nil }
        return start...end
    }

    /// Frames of each column, spanning the full height of the grid area.
    public static func columnFrames(
        in size: CGSize,
        spec: ColumnSpec,
        safeArea: GridInsets = .zero,
        respectsSafeArea: Bool = true
    ) -> [CGRect] {
        guard spec.count > 0,
              let span = contentSpan(
                  total: size.width,
                  startMargin: spec.leadingMargin,
                  endMargin: spec.trailingMargin,
                  safeStart: safeArea.leading,
                  safeEnd: safeArea.trailing,
                  respectsSafeArea: respectsSafeArea
              )
        else { return [] }

        let contentWidth = span.upperBound - span.lowerBound
        let gutterTotal = spec.gutter * CGFloat(spec.count - 1)
        let columnWidth = (contentWidth - gutterTotal) / CGFloat(spec.count)
        guard columnWidth > 0 else { return [] }

        return (0..<spec.count).map { index in
            let x = span.lowerBound + CGFloat(index) * (columnWidth + spec.gutter)
            return CGRect(x: x, y: 0, width: columnWidth, height: size.height)
        }
    }

    /// Frames of each row, spanning the full width of the grid area.
    public static func rowFrames(
        in size: CGSize,
        spec: RowSpec,
        safeArea: GridInsets = .zero,
        respectsSafeArea: Bool = true
    ) -> [CGRect] {
        guard spec.count > 0,
              let span = contentSpan(
                  total: size.height,
                  startMargin: spec.topMargin,
                  endMargin: spec.bottomMargin,
                  safeStart: safeArea.top,
                  safeEnd: safeArea.bottom,
                  respectsSafeArea: respectsSafeArea
              )
        else { return [] }

        let contentHeight = span.upperBound - span.lowerBound
        let gutterTotal = spec.gutter * CGFloat(spec.count - 1)
        let rowHeight = (contentHeight - gutterTotal) / CGFloat(spec.count)
        guard rowHeight > 0 else { return [] }

        return (0..<spec.count).map { index in
            let y = span.lowerBound + CGFloat(index) * (rowHeight + spec.gutter)
            return CGRect(x: 0, y: y, width: size.width, height: rowHeight)
        }
    }

    /// Module cells: intersections of columns × rows.
    public static func moduleFrames(columns: [CGRect], rows: [CGRect]) -> [CGRect] {
        rows.flatMap { row in
            columns.map { column in
                CGRect(x: column.minX, y: row.minY, width: column.width, height: row.height)
            }
        }
    }

    // MARK: Baselines

    /// Baseline y-positions within `height`, starting at `topInset +
    /// spec.offset`, stepping by the rhythm. The first line and then every
    /// `emphasisEvery`th line after it are emphasized.
    public static func baselines(
        height: CGFloat,
        spec: BaselineSpec,
        topInset: CGFloat = 0
    ) -> [GridLine] {
        guard spec.rhythm > 0.5 else { return [] }
        var lines: [GridLine] = []
        var y = topInset + spec.offset
        var index = 0
        while y <= height + 0.001 {
            let emphasized: Bool
            if let every = spec.emphasisEvery, every > 0 {
                emphasized = index % every == 0
            } else {
                emphasized = false
            }
            lines.append(GridLine(position: y, isEmphasis: emphasized))
            y += spec.rhythm
            index += 1
        }
        return lines
    }

    // MARK: Key lines

    /// Resolves a key line to an absolute position along its axis.
    public static func resolvedPosition(of keyLine: KeyLine, in size: CGSize, safeArea: GridInsets, respectsSafeArea: Bool) -> CGFloat {
        let extent = keyLine.axis == .horizontal ? size.height : size.width
        let startInset: CGFloat
        let endInset: CGFloat
        if respectsSafeArea {
            startInset = keyLine.axis == .horizontal ? safeArea.top : safeArea.leading
            endInset = keyLine.axis == .horizontal ? safeArea.bottom : safeArea.trailing
        } else {
            startInset = 0
            endInset = 0
        }
        let available = extent - startInset - endInset
        let distance = keyLine.unit == .fraction ? keyLine.offset * available : keyLine.offset
        switch keyLine.anchor {
        case .start: return startInset + distance
        case .end: return extent - endInset - distance
        }
    }

    // MARK: Measurement helpers

    /// Distance between two points, plus how far it deviates from the nearest
    /// multiple of `rhythm` (nil when no rhythm is configured).
    public static func rhythmDeviation(distance: CGFloat, rhythm: CGFloat?) -> CGFloat? {
        guard let rhythm, rhythm > 0 else { return nil }
        let remainder = distance.truncatingRemainder(dividingBy: rhythm)
        return min(remainder, rhythm - remainder)
    }

    /// Signed delta from `value` to the nearest entry in `candidates`
    /// (positive = value is past the line). Nil when candidates is empty.
    public static func nearestLineDelta(from value: CGFloat, to candidates: [CGFloat]) -> CGFloat? {
        guard let nearest = candidates.min(by: { abs(value - $0) < abs(value - $1) }) else { return nil }
        return value - nearest
    }
}
