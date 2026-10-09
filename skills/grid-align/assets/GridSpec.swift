// Grid tokens + layout helpers for aligning a SwiftUI app to its grid.
// Template from GridKit's grid-align skill: fill the numbers in from
// `.gridkit/spec.json` (`gridspec.py resolve` prints them), rename to match
// the project's conventions, and delete what you don't use.
// Requires iOS 16+ (the `Layout` protocol).
import SwiftUI

/// Single source of truth for the layout grid. Mirror of .gridkit/spec.json.
enum GridSpec {
    /// Base unit of the spacing scale and the baseline rhythm.
    static let rhythm: CGFloat = 8

    /// Spacing scale — use these instead of literals.
    enum Space {
        static let xxs: CGFloat = 4
        static let xs: CGFloat = 8
        static let s: CGFloat = 12
        static let m: CGFloat = 16
        static let l: CGFloat = 24
        static let xl: CGFloat = 32
        static let xxl: CGFloat = 48
    }

    /// Column metrics for one size class (the spec's regular/compact variants).
    struct Metrics: Equatable {
        var columns: Int
        var gutter: CGFloat
        var margin: CGFloat

        /// Width of `span` columns (plus the gutters between them) in a
        /// content area `contentWidth` wide (container width minus margins).
        func width(spanning span: Int, in contentWidth: CGFloat) -> CGFloat {
            let span = min(max(span, 1), columns)
            let column = (contentWidth - gutter * CGFloat(columns - 1)) / CGFloat(columns)
            return column * CGFloat(span) + gutter * CGFloat(span - 1)
        }
    }

    static let regular = Metrics(columns: 12, gutter: 16, margin: 16)
    static let compact = Metrics(columns: 4, gutter: 16, margin: 16)

    static func metrics(for sizeClass: UserInterfaceSizeClass?) -> Metrics {
        sizeClass == .regular ? regular : compact
    }

    /// Smallest multiple of the rhythm that fits `lineHeight`; use with
    /// `.lineSpacing(GridSpec.lineSpacing(for: .body))` so every line advances
    /// by a whole number of baseline steps.
    static func lineSpacing(for textStyle: UIFont.TextStyle) -> CGFloat {
        let lineHeight = UIFont.preferredFont(forTextStyle: textStyle).lineHeight
        return (lineHeight / rhythm).rounded(.up) * rhythm - lineHeight
    }
}

// MARK: - Environment

private struct GridMetricsKey: EnvironmentKey {
    static let defaultValue = GridSpec.compact
}

extension EnvironmentValues {
    /// Grid metrics for the current size class (set by `.gridContainer()`).
    var gridMetrics: GridSpec.Metrics {
        get { self[GridMetricsKey.self] }
        set { self[GridMetricsKey.self] = newValue }
    }
}

/// Resolves the size-class variant once at the screen root, applies the
/// outer margins, and publishes the metrics to descendants.
private struct GridContainer: ViewModifier {
    @Environment(\.horizontalSizeClass) private var sizeClass
    var appliesMargins: Bool

    func body(content: Content) -> some View {
        let metrics = GridSpec.metrics(for: sizeClass)
        content
            .padding(.horizontal, appliesMargins ? metrics.margin : 0)
            .environment(\.gridMetrics, metrics)
    }
}

extension View {
    /// Screen-level grid container: horizontal margins + metrics in the environment.
    /// For scroll views prefer `appliesMargins: false` plus
    /// `.contentMargins(.horizontal, metrics.margin, for: .scrollContent)` (iOS 17)
    /// so content scrolls under the margins instead of being clipped by them.
    func gridContainer(appliesMargins: Bool = true) -> some View {
        modifier(GridContainer(appliesMargins: appliesMargins))
    }

    /// Lays the view out across `span` columns of a `ColumnGrid`.
    func gridSpan(_ span: Int) -> some View {
        layoutValue(key: GridSpanKey.self, value: span)
    }
}

// MARK: - Column layout

private struct GridSpanKey: LayoutValueKey {
    static let defaultValue = 1
}

/// Flows children left to right across the grid's columns, each child taking
/// `.gridSpan(n)` columns (default 1) and wrapping to a new row when it no
/// longer fits. Children land exactly on column edges, at any width.
///
///     ColumnGrid(metrics: metrics) {
///         Hero().gridSpan(metrics.columns)
///         Card().gridSpan(2)
///         Card().gridSpan(2)
///     }
struct ColumnGrid: Layout {
    var metrics: GridSpec.Metrics
    var rowSpacing: CGFloat = GridSpec.Space.m

    private struct Item {
        var index: Int
        var column: Int
        var span: Int
    }

    private struct Row {
        var items: [Item] = []
        var height: CGFloat = 0
    }

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let width = proposal.replacingUnspecifiedDimensions().width
        let rows = arrange(width: width, subviews: subviews)
        let height = rows.reduce(0) { $0 + $1.height } + rowSpacing * CGFloat(max(rows.count - 1, 0))
        return CGSize(width: width, height: height)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let step = metrics.width(spanning: 1, in: bounds.width) + metrics.gutter
        var y = bounds.minY
        for row in arrange(width: bounds.width, subviews: subviews) {
            for item in row.items {
                subviews[item.index].place(
                    at: CGPoint(x: bounds.minX + CGFloat(item.column) * step, y: y),
                    proposal: ProposedViewSize(width: metrics.width(spanning: item.span, in: bounds.width), height: nil)
                )
            }
            y += row.height + rowSpacing
        }
    }

    private func arrange(width: CGFloat, subviews: Subviews) -> [Row] {
        var rows: [Row] = []
        var row = Row()
        var column = 0
        for (index, subview) in subviews.enumerated() {
            let span = min(max(subview[GridSpanKey.self], 1), metrics.columns)
            if column + span > metrics.columns {
                rows.append(row)
                row = Row()
                column = 0
            }
            let size = subview.sizeThatFits(ProposedViewSize(width: metrics.width(spanning: span, in: width), height: nil))
            row.items.append(Item(index: index, column: column, span: span))
            row.height = max(row.height, size.height)
            column += span
        }
        if !row.items.isEmpty { rows.append(row) }
        return rows
    }
}
