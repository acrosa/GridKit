import SwiftUI

/// Draws a `GridConfiguration` with `Canvas`. The view is purely visual —
/// hit testing is disabled — and only redraws when the configuration, size,
/// or display scale changes (Canvas invalidates on input change only).
public struct GridCanvasView: View {
    public let configuration: GridConfiguration
    public let safeAreaInsets: GridInsets

    @Environment(\.displayScale) private var displayScale

    public init(configuration: GridConfiguration, safeAreaInsets: GridInsets = .zero) {
        self.configuration = configuration
        self.safeAreaInsets = safeAreaInsets
    }

    public var body: some View {
        Canvas(opaque: false, rendersAsynchronously: false) { context, size in
            draw(in: &context, size: size)
        }
        .opacity(configuration.appearance.opacity)
        .blendMode(configuration.appearance.blendMode.swiftUIBlendMode)
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }

    // MARK: Drawing

    private var lineWidth: CGFloat {
        configuration.appearance.lineWidth ?? GridGeometry.hairlineWidth(scale: displayScale)
    }

    private func snap(_ value: CGFloat) -> CGFloat {
        GridGeometry.snappedLinePosition(value, scale: displayScale, lineWidth: lineWidth)
    }

    private func draw(in context: inout GraphicsContext, size: CGSize) {
        let appearance = configuration.appearance
        let layers = configuration.layers
        let safeArea = configuration.respectsSafeArea ? safeAreaInsets : .zero

        var columns: [CGRect] = []
        var rows: [CGRect] = []
        if let spec = configuration.columns {
            columns = GridGeometry.columnFrames(
                in: size, spec: spec, safeArea: safeAreaInsets,
                respectsSafeArea: configuration.respectsSafeArea
            )
        }
        if let spec = configuration.rows {
            rows = GridGeometry.rowFrames(
                in: size, spec: spec, safeArea: safeAreaInsets,
                respectsSafeArea: configuration.respectsSafeArea
            )
        }

        // Margin & gutter tint: everything outside the column zones.
        if layers.contains(.margins), !columns.isEmpty {
            var outside = Path(CGRect(origin: .zero, size: size))
            for column in columns {
                outside.addRect(column)
            }
            context.fill(outside, with: .color(appearance.marginTint.color), style: FillStyle(eoFill: true))
        }

        // Highlighted column zone (asymmetric grids).
        if layers.contains(.columns),
           let highlight = configuration.columns?.highlightedColumns,
           !columns.isEmpty {
            let indices = columns.indices.filter { highlight.contains($0 + 1) }
            if let first = indices.first, let last = indices.last {
                let zone = CGRect(
                    x: columns[first].minX, y: 0,
                    width: columns[last].maxX - columns[first].minX, height: size.height
                )
                context.fill(Path(zone), with: .color(appearance.moduleTint.color))
            }
        }

        // Modules.
        if layers.contains(.modules), !columns.isEmpty, !rows.isEmpty {
            var path = Path()
            for module in GridGeometry.moduleFrames(columns: columns, rows: rows) {
                path.addRect(module)
            }
            context.fill(path, with: .color(appearance.moduleTint.color))
        }

        // Column edges.
        if layers.contains(.columns) {
            var path = Path()
            for column in columns {
                for x in [column.minX, column.maxX] {
                    let sx = snap(x)
                    path.move(to: CGPoint(x: sx, y: 0))
                    path.addLine(to: CGPoint(x: sx, y: size.height))
                }
            }
            context.stroke(path, with: .color(appearance.lineColor.color), lineWidth: lineWidth)
        }

        // Row edges.
        if layers.contains(.rows) {
            var path = Path()
            for row in rows {
                for y in [row.minY, row.maxY] {
                    let sy = snap(y)
                    path.move(to: CGPoint(x: 0, y: sy))
                    path.addLine(to: CGPoint(x: size.width, y: sy))
                }
            }
            context.stroke(path, with: .color(appearance.lineColor.color), lineWidth: lineWidth)
        }

        // Baseline grid.
        if layers.contains(.baseline), let spec = configuration.baseline {
            let lines = GridGeometry.baselines(height: size.height, spec: spec, topInset: safeArea.top)
            var regular = Path()
            var emphasis = Path()
            for line in lines {
                let y = snap(line.position)
                var path = line.isEmphasis ? emphasis : regular
                path.move(to: CGPoint(x: 0, y: y))
                path.addLine(to: CGPoint(x: size.width, y: y))
                if line.isEmphasis { emphasis = path } else { regular = path }
            }
            context.stroke(regular, with: .color(appearance.lineColor.color.opacity(0.55)), lineWidth: lineWidth)
            context.stroke(emphasis, with: .color(appearance.emphasisColor.color), lineWidth: lineWidth)
        }

        // Key lines with labels.
        if layers.contains(.keyLines) {
            for keyLine in configuration.keyLines {
                let position = snap(
                    GridGeometry.resolvedPosition(
                        of: keyLine, in: size, safeArea: safeAreaInsets,
                        respectsSafeArea: configuration.respectsSafeArea
                    )
                )
                var path = Path()
                let labelPoint: CGPoint
                if keyLine.axis == .horizontal {
                    path.move(to: CGPoint(x: 0, y: position))
                    path.addLine(to: CGPoint(x: size.width, y: position))
                    labelPoint = CGPoint(x: safeArea.leading + 6, y: position - 8)
                } else {
                    path.move(to: CGPoint(x: position, y: 0))
                    path.addLine(to: CGPoint(x: position, y: size.height))
                    labelPoint = CGPoint(x: position + 4, y: safeArea.top + 10)
                }
                context.stroke(
                    path,
                    with: .color(appearance.emphasisColor.color),
                    style: StrokeStyle(lineWidth: max(lineWidth, 1), dash: [6, 3])
                )
                let label = Text(keyLine.name)
                    .font(.system(size: 9, weight: .medium, design: .monospaced))
                    .foregroundColor(appearance.emphasisColor.color)
                context.draw(context.resolve(label), at: labelPoint, anchor: .leading)
            }
        }

        // Spacing ruler: ticks along the leading edge every 8 pt, labels every 80 pt.
        if layers.contains(.ruler) {
            var ticks = Path()
            let start = safeArea.top
            var y = start
            var pt = 0
            while y <= size.height {
                let major = pt % 80 == 0
                let length: CGFloat = major ? 12 : (pt % 40 == 0 ? 8 : 4)
                let sy = snap(y)
                ticks.move(to: CGPoint(x: 0, y: sy))
                ticks.addLine(to: CGPoint(x: length, y: sy))
                if major, pt > 0 {
                    let label = Text("\(pt)")
                        .font(.system(size: 8, design: .monospaced))
                        .foregroundColor(appearance.lineColor.color)
                    context.draw(context.resolve(label), at: CGPoint(x: 14, y: sy), anchor: .leading)
                }
                y += 8
                pt += 8
            }
            context.stroke(ticks, with: .color(appearance.lineColor.color), lineWidth: lineWidth)
        }
    }
}
