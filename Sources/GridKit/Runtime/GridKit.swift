#if canImport(UIKit)
import Combine
import SwiftUI
import UIKit

/// Runtime controller for the overlay. One instance manages one overlay
/// window per connected scene; configuration state is shared across scenes.
@MainActor
public final class GridKit: ObservableObject {
    public static let shared = GridKit()

    // MARK: Published state

    @Published public private(set) var isVisible = false

    /// The active configuration (regular-width variant when the applied
    /// preset defines a compact override).
    @Published public var configuration: GridConfiguration {
        didSet { persistConfiguration() }
    }

    /// Compact-width variant supplied by the applied preset, if any. Cleared
    /// when the user live-edits parameters so edits are WYSIWYG.
    @Published public internal(set) var compactConfiguration: GridConfiguration?

    /// ID of the most recently applied preset (for panel highlighting).
    @Published public internal(set) var appliedPresetID: String?

    /// Whether the control panel is collapsed to a pill. Persisted.
    @Published public var isPanelCollapsed: Bool {
        didSet { defaults.set(isPanelCollapsed, forKey: Keys.panelCollapsed) }
    }

    // MARK: Private state

    private var options = GridKitOptions()
    private var overlayWindows: [ObjectIdentifier: GridOverlayWindow] = [:]
    private var activationHandler: ActivationHandler?
    private var sceneDisconnectObserver: NSObjectProtocol?
    private var didApplyInitialPreset = false
    /// Whether `init` restored a configuration persisted by a previous launch.
    private let hasPersistedConfiguration: Bool
    private let defaults = UserDefaults.standard

    private enum Keys {
        static let configuration = "GridKit.configuration"
        static let compactConfiguration = "GridKit.compactConfiguration"
        static let panelCollapsed = "GridKit.panelCollapsed"
        static let appliedPresetID = "GridKit.appliedPresetID"
    }

    private init() {
        // Default collapsed → the single control pill (not the full panel) shows on first launch.
        isPanelCollapsed = (defaults.object(forKey: Keys.panelCollapsed) as? Bool) ?? true
        appliedPresetID = defaults.string(forKey: Keys.appliedPresetID)
        if let data = defaults.data(forKey: Keys.configuration),
           let restored = try? JSONDecoder().decode(GridConfiguration.self, from: data) {
            hasPersistedConfiguration = true
            configuration = restored
            if let compactData = defaults.data(forKey: Keys.compactConfiguration) {
                compactConfiguration = try? JSONDecoder().decode(GridConfiguration.self, from: compactData)
            }
        } else {
            hasPersistedConfiguration = false
            configuration = GridPreset.swissTwelveColumn.configuration
            compactConfiguration = GridPreset.swissTwelveColumn.compactConfiguration
            appliedPresetID = GridPreset.swissTwelveColumn.id
        }
    }

    // MARK: Public API

    public func show() {
        isVisible = true
    }

    public func hide() {
        isVisible = false
    }

    public func toggle() {
        isVisible ? hide() : show()
    }

    public func apply(preset: GridPreset) {
        // Set the compact variant first: persisting runs in `configuration`'s
        // didSet and must capture the new pair, not a stale compact override.
        compactConfiguration = preset.compactConfiguration
        appliedPresetID = preset.id
        defaults.set(preset.id, forKey: Keys.appliedPresetID)
        configuration = preset.configuration
    }

    public func apply(configuration: GridConfiguration) {
        compactConfiguration = nil
        appliedPresetID = nil
        defaults.removeObject(forKey: Keys.appliedPresetID)
        self.configuration = configuration
    }

    /// Loads a `GridConfiguration` from JSON, e.g. a shared team grid
    /// definition committed to the repo.
    public func load(contentsOf url: URL) throws {
        let data = try Data(contentsOf: url)
        let decoded = try JSONDecoder().decode(GridConfiguration.self, from: data)
        apply(configuration: decoded)
    }

    /// Exports the active configuration as pretty-printed JSON.
    public func exportJSON() -> String {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        guard let data = try? encoder.encode(configuration) else { return "{}" }
        return String(decoding: data, as: UTF8.self)
    }

    /// Renders the host app's key window with the grid overlay composited on
    /// top — for design review handoff.
    public func snapshot() -> UIImage? {
        guard let scene = overlayWindows.keys.compactMap({ id in
            overlayWindows[id]?.windowScene
        }).first(where: { $0.activationState == .foregroundActive }) ?? overlayWindows.values.first?.windowScene,
            let appWindow = scene.windows.first(where: { $0.isKeyWindow && !($0 is GridOverlayWindow) })
                ?? scene.windows.first(where: { !($0 is GridOverlayWindow) })
        else { return nil }

        let renderer = UIGraphicsImageRenderer(bounds: appWindow.bounds)
        return renderer.image { _ in
            appWindow.drawHierarchy(in: appWindow.bounds, afterScreenUpdates: true)
            if let overlay = overlayWindows[ObjectIdentifier(scene)] {
                overlay.drawHierarchy(in: appWindow.bounds, afterScreenUpdates: true)
            }
        }
    }

    /// The configuration to render for a given horizontal size class.
    public func activeConfiguration(forCompactWidth isCompact: Bool) -> GridConfiguration {
        if isCompact, let compact = compactConfiguration { return compact }
        return configuration
    }

    /// Call from parameter editors: live edits target the visible variant, so
    /// the compact override is dropped to keep editing WYSIWYG.
    public func willLiveEdit() {
        compactConfiguration = nil
    }

    // MARK: Installation (called by the view modifier)

    func install(options: GridKitOptions, scene: UIWindowScene) {
        self.options = options

        // The initial preset only SEEDS a first launch — once the user has edited (and thus
        // persisted) a configuration, their edits win over the compile-time preset.
        if !didApplyInitialPreset {
            didApplyInitialPreset = true
            if !hasPersistedConfiguration, let preset = options.initialPreset {
                apply(preset: preset)
            }
        }

        attachOverlayWindow(to: scene)
        installActivation(in: scene)
        installSceneDisconnectObserver()
    }

    var activation: GridKitActivation { options.activation }

    private func attachOverlayWindow(to scene: UIWindowScene) {
        let key = ObjectIdentifier(scene)
        guard overlayWindows[key] == nil else { return }

        let window = GridOverlayWindow(windowScene: scene)
        // A window created with `init(windowScene:)` has no frame — size it to the scene so the
        // overlay is full-screen (otherwise the bottom-trailing control lands mid-screen).
        window.frame = scene.windows.first(where: { !($0 is GridOverlayWindow) })?.frame
            ?? scene.screen.bounds
        window.windowLevel = UIWindow.Level(rawValue: UIWindow.Level.alert.rawValue + 1)
        window.backgroundColor = .clear
        window.isHidden = false

        let host = UIHostingController(rootView: GridOverlayRoot(kit: self, window: window))
        host.view.backgroundColor = .clear
        window.rootViewController = host
        // Pin the hosting view to fill the window so the SwiftUI GeometryReader measures the full
        // screen (otherwise it collapses to its content size and the control lands mid-screen).
        host.view.frame = window.bounds
        host.view.autoresizingMask = [.flexibleWidth, .flexibleHeight]

        overlayWindows[key] = window
    }

    /// Releases a scene's overlay window when the scene disconnects (multi-window iPad) — without
    /// this, every closed window leaks its overlay window + hosting controller.
    private func installSceneDisconnectObserver() {
        guard sceneDisconnectObserver == nil else { return }
        sceneDisconnectObserver = NotificationCenter.default.addObserver(
            forName: UIScene.didDisconnectNotification,
            object: nil,
            queue: .main
        ) { [weak self] note in
            guard let scene = note.object as? UIWindowScene else { return }
            let key = ObjectIdentifier(scene)
            Task { @MainActor [weak self] in
                if let window = self?.overlayWindows.removeValue(forKey: key) {
                    window.isHidden = true
                    window.rootViewController = nil
                }
            }
        }
    }

    private func installActivation(in scene: UIWindowScene) {
        switch options.activation {
        case .shake:
            ShakeDetector.installIfNeeded()
            if activationHandler == nil {
                let handler = ActivationHandler { [weak self] in self?.toggle() }
                NotificationCenter.default.addObserver(
                    handler,
                    selector: #selector(ActivationHandler.activate),
                    name: .gridKitDeviceDidShake,
                    object: nil
                )
                activationHandler = handler
            }
        case .threeFingerLongPress:
            guard let appWindow = scene.windows.first(where: { !($0 is GridOverlayWindow) }) else { return }
            let handler = activationHandler ?? ActivationHandler { [weak self] in self?.toggle() }
            activationHandler = handler
            let alreadyInstalled = appWindow.gestureRecognizers?.contains { $0.name == "GridKit.threeFingerLongPress" } ?? false
            guard !alreadyInstalled else { return }
            let recognizer = UILongPressGestureRecognizer(
                target: handler,
                action: #selector(ActivationHandler.handleLongPress(_:))
            )
            recognizer.name = "GridKit.threeFingerLongPress"
            recognizer.numberOfTouchesRequired = 3
            recognizer.minimumPressDuration = 0.5
            recognizer.cancelsTouchesInView = false
            appWindow.addGestureRecognizer(recognizer)
        case .floatingButton, .manual:
            break // floating button is rendered by GridOverlayRoot; manual needs nothing.
        }
    }

    // MARK: Sharing

    /// Presents a share sheet from the overlay window (used by the panel for
    /// snapshot export). Prefers the foreground-active scene's window so the
    /// sheet appears where the user is on multi-window iPad.
    func presentShareSheet(items: [Any]) {
        let window = overlayWindows.values
            .first { $0.windowScene?.activationState == .foregroundActive && !$0.isHidden }
            ?? overlayWindows.values.first { !$0.isHidden }
        guard let root = window?.rootViewController else { return }
        let controller = UIActivityViewController(activityItems: items, applicationActivities: nil)
        if let popover = controller.popoverPresentationController {
            popover.sourceView = root.view
            popover.sourceRect = CGRect(x: root.view.bounds.midX, y: root.view.bounds.midY, width: 1, height: 1)
            popover.permittedArrowDirections = []
        }
        root.present(controller, animated: true)
    }

    // MARK: Persistence

    private func persistConfiguration() {
        if let data = try? JSONEncoder().encode(configuration) {
            defaults.set(data, forKey: Keys.configuration)
        }
        if let compact = compactConfiguration, let data = try? JSONEncoder().encode(compact) {
            defaults.set(data, forKey: Keys.compactConfiguration)
        } else {
            defaults.removeObject(forKey: Keys.compactConfiguration)
        }
    }
}

/// NSObject trampoline so gestures and notifications can target the
/// MainActor-isolated controller.
private final class ActivationHandler: NSObject {
    private let action: @MainActor () -> Void

    init(action: @escaping @MainActor () -> Void) {
        self.action = action
    }

    @objc func activate() {
        let action = action
        Task { @MainActor in action() }
    }

    @objc func handleLongPress(_ recognizer: UILongPressGestureRecognizer) {
        guard recognizer.state == .began else { return }
        activate()
    }
}
#endif
