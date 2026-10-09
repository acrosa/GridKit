// GridKit grid-align — dumps accessibility frames + a screenshot for each
// screen you visit, in the frames format audit_frames.py reads.
//
// Add to the app's UI test target (create one if needed), adjust
// `testCaptureScreens` to navigate to the screens under audit, then run:
//
//   TEST_RUNNER_GRID_AUDIT_OUT="$PWD/.gridkit/audit" xcodebuild test \
//     -scheme <AppScheme> -destination 'platform=iOS Simulator,name=iPhone 16' \
//     -only-testing:<UITestTarget>/GridAuditFrames
//
// (xcodebuild forwards TEST_RUNNER_-prefixed variables to the test runner;
// simulator test runners can write straight to the host path.)
import XCTest

final class GridAuditFrames: XCTestCase {
    override func setUp() {
        continueAfterFailure = true
    }

    @MainActor
    func testCaptureScreens() throws {
        let app = XCUIApplication()
        app.launch()

        try capture(app, name: "home")

        // Navigate and capture more screens, e.g.:
        // app.tabBars.buttons["Settings"].tap()
        // try capture(app, name: "settings")
    }

    // MARK: - Capture

    @MainActor
    func capture(_ app: XCUIApplication, name: String) throws {
        _ = app.wait(for: .runningForeground, timeout: 5)
        sleep(1) // let animations settle

        let root = try app.snapshot()
        let window = root.children.first { $0.elementType == .window } ?? root
        var elements: [[String: Any]] = []

        func walk(_ s: XCUIElementSnapshot, parent: Int?) {
            var myIndex = parent
            let f = s.frame
            if f.width > 0, f.height > 0, s.elementType != .application {
                let index = elements.count
                var item: [String: Any] = [
                    "id": index,
                    "kind": Self.kind(of: s.elementType),
                    "type": Self.typeName(s.elementType),
                    "x": Double(f.minX), "y": Double(f.minY), "w": Double(f.width), "h": Double(f.height),
                ]
                if let parent { item["parent"] = parent }
                if !s.identifier.isEmpty { item["selector"] = "#\(s.identifier)" }
                if !s.label.isEmpty { item["label"] = String(s.label.prefix(48)) }
                elements.append(item)
                myIndex = index
            }
            for child in s.children { walk(child, parent: myIndex) }
        }
        walk(window, parent: nil)

        let screen = window.frame
        let shot = XCUIScreen.main.screenshot()
        let payload: [String: Any] = [
            "platform": "ios",
            "name": "\(name)@\(Int(screen.width))",
            "viewport": ["width": Double(screen.width), "height": Double(screen.height), "scale": Double(shot.image.scale)],
            "sizeClass": screen.width < 600 ? "compact" : "regular",
            "elements": elements,
        ]
        let json = try JSONSerialization.data(withJSONObject: payload, options: [.prettyPrinted, .sortedKeys])

        let base = "\(name)@\(Int(screen.width))"
        if let dir = ProcessInfo.processInfo.environment["GRID_AUDIT_OUT"] {
            let url = URL(fileURLWithPath: dir, isDirectory: true)
            try FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
            try json.write(to: url.appendingPathComponent("\(base).frames.json"))
            try shot.pngRepresentation.write(to: url.appendingPathComponent("\(base).png"))
        }
        // Also attach to the .xcresult, for device runs where the host path is unreachable.
        let frames = XCTAttachment(data: json, uniformTypeIdentifier: "public.json")
        frames.name = "\(base).frames.json"
        frames.lifetime = .keepAlways
        add(frames)
        let image = XCTAttachment(screenshot: shot)
        image.name = "\(base).png"
        image.lifetime = .keepAlways
        add(image)
    }

    static func kind(of type: XCUIElement.ElementType) -> String {
        switch type {
        case .staticText, .textView: return "text"
        case .image, .icon, .map, .webView: return "media"
        case .button, .link, .textField, .secureTextField, .searchField, .switch, .toggle, .slider, .stepper,
             .segmentedControl, .picker, .menuButton, .popUpButton, .tab, .cell:
            return "control"
        default: return "container"
        }
    }

    static func typeName(_ type: XCUIElement.ElementType) -> String {
        switch type {
        case .window: return "window"
        case .navigationBar: return "navigationBar"
        case .tabBar: return "tabBar"
        case .toolbar: return "toolbar"
        case .scrollView: return "scrollView"
        case .collectionView: return "collectionView"
        case .table: return "table"
        case .cell: return "cell"
        case .staticText: return "staticText"
        case .image: return "image"
        case .button: return "button"
        case .textField: return "textField"
        case .other: return "other"
        default: return "element(\(type.rawValue))"
        }
    }
}
