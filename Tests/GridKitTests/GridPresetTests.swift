import XCTest
@testable import GridKit

final class GridPresetTests: XCTestCase {
    func testPresetIDsAreUnique() {
        let ids = GridPreset.all.map(\.id)
        XCTAssertEqual(ids.count, Set(ids).count, "Duplicate preset IDs: \(ids)")
    }

    func testEveryCategoryHasPresets() {
        for category in GridPresetCategory.allCases {
            XCTAssertFalse(
                GridPreset.all.filter { $0.category == category }.isEmpty,
                "No presets in category \(category)"
            )
        }
    }

    func testSpecPresetsExist() {
        let expected = [
            "swiss-12-column", "eight-column", "six-column", "four-column-mobile", "single-column-reader",
            "four-point-rhythm", "eight-point-rhythm", "body-derived-rhythm",
            "modular-3x5", "modular-4x6", "asymmetric-editorial", "hero-split", "folio-grid",
            "ios-standard", "card-feed", "dashboard-modules",
        ]
        for id in expected {
            XCTAssertNotNil(GridPreset.preset(withID: id), "Missing preset \(id)")
        }
        XCTAssertEqual(GridPreset.all.count, expected.count)
    }

    func testEveryPresetConfigurationRoundTripsThroughJSON() throws {
        for preset in GridPreset.all {
            let data = try JSONEncoder().encode(preset.configuration)
            let decoded = try JSONDecoder().decode(GridConfiguration.self, from: data)
            XCTAssertEqual(decoded, preset.configuration, "Preset \(preset.id) did not round-trip")

            if let compact = preset.compactConfiguration {
                let compactData = try JSONEncoder().encode(compact)
                let decodedCompact = try JSONDecoder().decode(GridConfiguration.self, from: compactData)
                XCTAssertEqual(decodedCompact, compact, "Compact variant of \(preset.id) did not round-trip")
            }
        }
    }

    func testEveryPresetHasNotes() {
        for preset in GridPreset.all {
            XCTAssertFalse(preset.notes.isEmpty, "Preset \(preset.id) has no notes")
        }
    }

    func testSwissTwelveColumnAdaptsToCompactWidth() throws {
        let compact = try XCTUnwrap(GridPreset.swissTwelveColumn.compactConfiguration)
        XCTAssertEqual(GridPreset.swissTwelveColumn.configuration.columns?.count, 12)
        XCTAssertEqual(compact.columns?.count, 4)
    }

    func testAsymmetricEditorialHighlightsSidebarColumns() {
        XCTAssertEqual(GridPreset.asymmetricEditorial.configuration.columns?.highlightedColumns, 1...2)
    }

    func testHeroSplitUsesGoldenSections() throws {
        let lines = GridPreset.heroSplit.configuration.keyLines
        XCTAssertEqual(lines.count, 2)
        XCTAssertEqual(lines[0].offset, 0.382, accuracy: 0.0001)
        XCTAssertEqual(lines[1].offset, 0.618, accuracy: 0.0001)
        XCTAssertTrue(lines.allSatisfy { $0.unit == .fraction })
    }

    func testIOSStandardKeyLinesMatchPlatformFurniture() {
        let lines = GridPreset.iosStandard.configuration.keyLines
        XCTAssertEqual(lines.first { $0.name == "Nav bar" }?.offset, 44)
        XCTAssertEqual(lines.first { $0.name == "Tab bar" }?.offset, 49)
        XCTAssertEqual(lines.first { $0.name == "Tab bar" }?.anchor, .end)
    }
}
