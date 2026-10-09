import XCTest
@testable import GridKit

/// The grid-align Claude Code skill (skills/grid-align) carries its own copy of
/// the preset table so its Python scripts stay dependency-free. Keep it in sync.
final class SkillPresetsTests: XCTestCase {
    private struct Table: Decodable {
        struct Preset: Decodable {
            var id: String
            var platforms: [String]
            var regular: GridConfiguration
            var compact: GridConfiguration?
        }
        var presets: [Preset]
    }

    private func loadTable() throws -> Table {
        let url = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent() // GridKitTests
            .deletingLastPathComponent() // Tests
            .deletingLastPathComponent() // repo root
            .appendingPathComponent("skills/grid-align/assets/presets.json")
        return try JSONDecoder().decode(Table.self, from: Data(contentsOf: url))
    }

    private func assertSameLayout(_ a: GridConfiguration?, _ b: GridConfiguration?, _ message: String, line: UInt = #line) {
        XCTAssertEqual(a?.columns, b?.columns, "\(message): columns", line: line)
        XCTAssertEqual(a?.rows, b?.rows, "\(message): rows", line: line)
        XCTAssertEqual(a?.baseline, b?.baseline, "\(message): baseline", line: line)
        XCTAssertEqual(a?.keyLines, b?.keyLines, "\(message): keyLines", line: line)
    }

    func testSkillPresetTableMatchesLibrary() throws {
        let table = try loadTable().presets.filter { $0.platforms.contains("ios") }
        XCTAssertEqual(Set(table.map(\.id)), Set(GridPreset.all.map(\.id)))

        for preset in GridPreset.all where preset.id != "body-derived-rhythm" { // rhythm is measured at runtime
            guard let skill = table.first(where: { $0.id == preset.id }) else { continue }
            assertSameLayout(skill.regular, preset.configuration, "\(preset.id) regular")
            assertSameLayout(skill.compact, preset.compactConfiguration, "\(preset.id) compact")
        }
    }
}
