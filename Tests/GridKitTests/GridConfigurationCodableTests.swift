import XCTest
@testable import GridKit

final class GridConfigurationCodableTests: XCTestCase {
    func testFullConfigurationRoundTrips() throws {
        let original = GridConfiguration(
            columns: ColumnSpec(count: 5, gutter: 16, leadingMargin: 24, trailingMargin: 24, highlightedColumns: 1...2),
            rows: RowSpec(count: 5, gutter: 16, topMargin: 72, bottomMargin: 56),
            baseline: BaselineSpec(rhythm: 8, offset: 2, emphasisEvery: 3),
            keyLines: [
                KeyLine(name: "Hangline", axis: .horizontal, offset: 0.2, anchor: .start, unit: .fraction),
                KeyLine(name: "Folio", axis: .horizontal, offset: 40, anchor: .end),
            ],
            appearance: GridAppearance(lineColor: .cyan, opacity: 0.8, lineWidth: 1, blendMode: .difference),
            respectsSafeArea: false,
            layers: [.columns, .baseline, .keyLines],
            modularScale: ModularScale(ratio: 1.25, baseSize: 17)
        )

        let data = try JSONEncoder().encode(original)
        let decoded = try JSONDecoder().decode(GridConfiguration.self, from: data)
        XCTAssertEqual(decoded, original)
    }

    func testMinimalJSONDecodesWithDefaults() throws {
        let json = Data(#"{"columns": {"count": 12}}"#.utf8)
        let decoded = try JSONDecoder().decode(GridConfiguration.self, from: json)

        XCTAssertEqual(decoded.columns?.count, 12)
        XCTAssertEqual(decoded.columns?.gutter, 16)
        XCTAssertEqual(decoded.columns?.leadingMargin, 16)
        XCTAssertEqual(decoded.columns?.trailingMargin, 16)
        XCTAssertNil(decoded.rows)
        XCTAssertNil(decoded.baseline)
        XCTAssertTrue(decoded.keyLines.isEmpty)
        XCTAssertTrue(decoded.respectsSafeArea)
        XCTAssertEqual(decoded.layers, .standard)
        XCTAssertEqual(decoded.appearance.blendMode, .normal)
    }

    func testAsymmetricMarginsDefaultTrailingToLeading() throws {
        let json = Data(#"{"columns": {"count": 6, "leadingMargin": 32}}"#.utf8)
        let decoded = try JSONDecoder().decode(GridConfiguration.self, from: json)
        XCTAssertEqual(decoded.columns?.leadingMargin, 32)
        XCTAssertEqual(decoded.columns?.trailingMargin, 32)
    }

    func testBrandGridFixtureDecodes() throws {
        let url = try XCTUnwrap(
            Bundle.module.url(forResource: "brand-grid", withExtension: "json", subdirectory: "Fixtures")
        )
        let data = try Data(contentsOf: url)
        let decoded = try JSONDecoder().decode(GridConfiguration.self, from: data)

        XCTAssertEqual(decoded.columns?.count, 12)
        XCTAssertEqual(decoded.baseline?.rhythm, 8)
        XCTAssertEqual(decoded.baseline?.emphasisEvery, 3)
        XCTAssertEqual(decoded.keyLines.count, 1)
        XCTAssertEqual(decoded.keyLines.first?.name, "Hangline")
        XCTAssertEqual(decoded.appearance.blendMode, .difference)
        XCTAssertEqual(decoded.modularScale?.ratio ?? 0, 1.25, accuracy: 0.0001)
    }

    func testModularScaleSteps() {
        let scale = ModularScale(ratio: 2, baseSize: 16)
        let steps = scale.steps(below: 1, above: 2)
        XCTAssertEqual(steps, [8, 16, 32, 64])
    }
}
