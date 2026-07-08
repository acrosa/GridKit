import Foundation

/// How the overlay is summoned at runtime.
public enum GridKitActivation: String, Sendable, Equatable {
    /// Device shake gesture (default).
    case shake
    /// Simulator-friendly three-finger long press.
    case threeFingerLongPress
    /// Small draggable on-screen button.
    case floatingButton
    /// Only via the programmatic `GridKit.shared` API.
    case manual
}

/// Options carried by `GridKitMode.enabled`.
public struct GridKitOptions: Sendable {
    public var activation: GridKitActivation
    public var initialPreset: GridPreset?
    /// Allow GridKit in non-DEBUG builds (internal/TestFlight only — see the
    /// App Review notes in the README).
    public var force: Bool

    public init(activation: GridKitActivation = .shake, initialPreset: GridPreset? = nil, force: Bool = false) {
        self.activation = activation
        self.initialPreset = initialPreset
        self.force = force
    }
}

public enum GridKitMode: Sendable {
    case disabled
    case enabled(GridKitOptions)

    /// Convenience with defaults: `.enabled(activation: .shake)`.
    public static func enabled(
        activation: GridKitActivation = .shake,
        initialPreset: GridPreset? = nil,
        force: Bool = false
    ) -> GridKitMode {
        .enabled(GridKitOptions(activation: activation, initialPreset: initialPreset, force: force))
    }
}
