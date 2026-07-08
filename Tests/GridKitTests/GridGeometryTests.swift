import XCTest
@testable import GridKit

final class GridGeometryTests: XCTestCase {
    // MARK: Pixel snapping

    func testHairlineWidthMatchesDisplayScale() {
        XCTAssertEqual(GridGeometry.hairlineWidth(scale: 2), 0.5)
        XCTAssertEqual(GridGeometry.hairlineWidth(scale: 3), 1.0 / 3.0, accuracy: 0.0001)
        // Degenerate scales clamp to 1.
        XCTAssertEqual(GridGeometry.hairlineWidth(scale: 0), 1)
    }

    func testOddPixelStrokesSnapToPixelCenters() {
        // A hairline on a 2x display is 1 physical pixel — its center must sit
        // on a half-pixel boundary.
        let snapped = GridGeometry.snappedLinePosition(10.3, scale: 2, lineWidth: 0.5)
        XCTAssertEqual(snapped, 10.25)
        let snapped3x = GridGeometry.snappedLinePosition(10.3, scale: 3, lineWidth: 1.0 / 3.0)
        // floor(10.3 * 3) = 30, +0.5 => 30.5 / 3
        XCTAssertEqual(snapped3x, 30.5 / 3, accuracy: 0.0001)
    }

    func testEvenPixelStrokesSnapToPixelBoundaries() {
        // A 1 pt stroke on a 2x display is 2 physical pixels — its center must
        // sit on a pixel boundary.
        let snapped = GridGeometry.snappedLinePosition(10.3, scale: 2, lineWidth: 1)
        XCTAssertEqual(snapped, 10.5)
    }

    // MARK: Content span

    func testContentSpanRespectsSafeAreaAndMargins() {
        let span = GridGeometry.contentSpan(
            total: 390, startMargin: 16, endMargin: 16,
            safeStart: 0, safeEnd: 0, respectsSafeArea: true
        )
        XCTAssertEqual(span, 16...374)

        let withSafeArea = GridGeometry.contentSpan(
            total: 390, startMargin: 16, endMargin: 16,
            safeStart: 44, safeEnd: 34, respectsSafeArea: true
        )
        XCTAssertEqual(withSafeArea, 60...340)

        let ignoringSafeArea = GridGeometry.contentSpan(
            total: 390, startMargin: 16, endMargin: 16,
            safeStart: 44, safeEnd: 34, respectsSafeArea: false
        )
        XCTAssertEqual(ignoringSafeArea, 16...374)
    }

    func testContentSpanIsNilWhenNoSpaceRemains() {
        XCTAssertNil(GridGeometry.contentSpan(
            total: 20, startMargin: 16, endMargin: 16,
            safeStart: 0, safeEnd: 0, respectsSafeArea: true
        ))
    }

    // MARK: Columns

    func testTwelveColumnFramesTileTheContentWidthExactly() {
        let spec = ColumnSpec(count: 12, gutter: 16, margin: 16)
        let frames = GridGeometry.columnFrames(in: CGSize(width: 390, height: 844), spec: spec)

        XCTAssertEqual(frames.count, 12)
        // content = 390 - 32 = 358; gutters = 11 * 16 = 176; column = 182/12
        let expectedWidth = (358.0 - 176.0) / 12.0
        for frame in frames {
            XCTAssertEqual(frame.width, expectedWidth, accuracy: 0.0001)
            XCTAssertEqual(frame.height, 844)
        }
        XCTAssertEqual(frames.first?.minX ?? -1, 16, accuracy: 0.0001)
        XCTAssertEqual(frames.last?.maxX ?? -1, 374, accuracy: 0.0001)
        // Adjacent frames are separated by exactly one gutter.
        for (left, right) in zip(frames, frames.dropFirst()) {
            XCTAssertEqual(right.minX - left.maxX, 16, accuracy: 0.0001)
        }
    }

    func testColumnFramesEmptyWhenColumnsWouldBeNegative() {
        let spec = ColumnSpec(count: 12, gutter: 40, margin: 16)
        let frames = GridGeometry.columnFrames(in: CGSize(width: 320, height: 600), spec: spec)
        XCTAssertTrue(frames.isEmpty)
    }

    // MARK: Rows & modules

    func testRowFramesAndModules() {
        let columns = GridGeometry.columnFrames(
            in: CGSize(width: 300, height: 500),
            spec: ColumnSpec(count: 3, gutter: 10, margin: 10)
        )
        let rows = GridGeometry.rowFrames(
            in: CGSize(width: 300, height: 500),
            spec: RowSpec(count: 5, gutter: 10, margin: 10)
        )
        XCTAssertEqual(rows.count, 5)
        // content height = 480; gutters = 40; row height = 88
        XCTAssertEqual(rows[0].height, 88, accuracy: 0.0001)
        XCTAssertEqual(rows[0].minY, 10, accuracy: 0.0001)
        XCTAssertEqual(rows[4].maxY, 490, accuracy: 0.0001)

        let modules = GridGeometry.moduleFrames(columns: columns, rows: rows)
        XCTAssertEqual(modules.count, 15)
        XCTAssertEqual(modules[0].origin.x, columns[0].minX)
        XCTAssertEqual(modules[0].origin.y, rows[0].minY)
    }

    // MARK: Baselines

    func testBaselineCountAndSpacing() {
        let spec = BaselineSpec(rhythm: 8)
        let lines = GridGeometry.baselines(height: 100, spec: spec)
        // 0, 8, ..., 96 => 13 lines
        XCTAssertEqual(lines.count, 13)
        XCTAssertEqual(lines[1].position - lines[0].position, 8)
        XCTAssertTrue(lines.allSatisfy { !$0.isEmphasis })
    }

    func testBaselineEmphasisEveryNth() {
        let spec = BaselineSpec(rhythm: 4, emphasisEvery: 4)
        let lines = GridGeometry.baselines(height: 32, spec: spec)
        // Lines at 0,4,...,32 => 9 lines; emphasis at indices 0, 4, 8.
        XCTAssertEqual(lines.count, 9)
        XCTAssertEqual(lines.filter(\.isEmphasis).map(\.position), [0, 16, 32])
    }

    func testBaselineOffsetAndTopInset() {
        let spec = BaselineSpec(rhythm: 10, offset: 3)
        let lines = GridGeometry.baselines(height: 50, spec: spec, topInset: 20)
        XCTAssertEqual(lines.first?.position, 23)
    }

    func testDegenerateRhythmProducesNoLines() {
        let spec = BaselineSpec(rhythm: 0)
        XCTAssertTrue(GridGeometry.baselines(height: 100, spec: spec).isEmpty)
    }

    // MARK: Key lines

    func testKeyLineResolutionPointsAndFractions() {
        let size = CGSize(width: 390, height: 844)
        let safeArea = GridInsets(top: 44, leading: 0, bottom: 34, trailing: 0)

        let navBar = KeyLine(name: "Nav", axis: .horizontal, offset: 44, anchor: .start)
        XCTAssertEqual(
            GridGeometry.resolvedPosition(of: navBar, in: size, safeArea: safeArea, respectsSafeArea: true),
            88
        )

        let tabBar = KeyLine(name: "Tab", axis: .horizontal, offset: 49, anchor: .end)
        XCTAssertEqual(
            GridGeometry.resolvedPosition(of: tabBar, in: size, safeArea: safeArea, respectsSafeArea: true),
            844 - 34 - 49
        )

        let golden = KeyLine(name: "Golden", axis: .horizontal, offset: 0.382, anchor: .start, unit: .fraction)
        let resolved = GridGeometry.resolvedPosition(of: golden, in: size, safeArea: .zero, respectsSafeArea: false)
        XCTAssertEqual(resolved, 844 * 0.382, accuracy: 0.0001)
    }

    // MARK: Measurement helpers

    func testRhythmDeviation() {
        XCTAssertEqual(GridGeometry.rhythmDeviation(distance: 24, rhythm: 8), 0)
        XCTAssertEqual(GridGeometry.rhythmDeviation(distance: 26, rhythm: 8) ?? -1, 2, accuracy: 0.0001)
        XCTAssertEqual(GridGeometry.rhythmDeviation(distance: 30, rhythm: 8) ?? -1, 2, accuracy: 0.0001)
        XCTAssertNil(GridGeometry.rhythmDeviation(distance: 30, rhythm: nil))
        XCTAssertNil(GridGeometry.rhythmDeviation(distance: 30, rhythm: 0))
    }

    func testNearestLineDelta() {
        XCTAssertEqual(GridGeometry.nearestLineDelta(from: 18, to: [0, 16, 32]), 2)
        XCTAssertEqual(GridGeometry.nearestLineDelta(from: 15, to: [0, 16, 32]), -1)
        XCTAssertNil(GridGeometry.nearestLineDelta(from: 15, to: []))
    }

    // MARK: Rhythm derivation

    func testRhythmRoundingFromLineHeight() {
        // 20.3 pt line height on a 4 pt unit rounds to 20.
        XCTAssertEqual(BaselineSpec.rhythm(forLineHeight: 20.3, roundedTo: 4), 20)
        // 22.1 pt on a 4 pt unit: 22.1/4 = 5.525, rounds up to 6 units = 24.
        XCTAssertEqual(BaselineSpec.rhythm(forLineHeight: 22.1, roundedTo: 4), 24)
        // Doubling the multiple doubles the raw value before rounding.
        XCTAssertEqual(BaselineSpec.rhythm(forLineHeight: 10.2, multiple: 2, roundedTo: 4), 20)
        // Never collapses below one unit.
        XCTAssertEqual(BaselineSpec.rhythm(forLineHeight: 0.4, roundedTo: 4), 4)
    }

    #if canImport(UIKit)
    func testBodyDerivedSpecUsesPreferredFontLineHeight() {
        let spec = BaselineSpec(deriving: .body, roundedTo: 1)
        let expected = BaselineSpec.rhythm(
            forLineHeight: UIFont.preferredFont(forTextStyle: .body).lineHeight,
            roundedTo: 1
        )
        XCTAssertEqual(spec.rhythm, expected)
        XCTAssertGreaterThan(spec.rhythm, 0)
    }
    #endif
}
