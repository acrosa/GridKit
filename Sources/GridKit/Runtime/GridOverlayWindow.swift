#if canImport(UIKit)
import UIKit

/// A passthrough window layered above the app's key window (and above
/// sheets/alerts). The grid itself never captures touches; only interactive
/// chrome (control panel, floating button, presented share sheets) does.
final class GridOverlayWindow: UIWindow {
    /// Window-space frames of the interactive overlay chrome (floating button, control panel),
    /// reported by the SwiftUI content. Only taps inside one of these are captured; everything else
    /// passes straight through to the app. We can't rely on the SwiftUI hosting view's hit-testing
    /// here — it reports itself for empty taps too, which would swallow every touch.
    var interactiveFrames: [String: CGRect] = [:]

    override func hitTest(_ point: CGPoint, with event: UIEvent?) -> UIView? {
        // `point` is in this window's coordinate space; the reported frames come from SwiftUI's
        // `.global` space, which can be window- OR screen-relative depending on the OS. Check both
        // (raw point and the screen-converted point) so the match is robust on iPhone and iPad.
        let screenPoint = convert(point, to: nil)
        let overChrome = interactiveFrames.values.contains {
            $0.contains(point) || $0.contains(screenPoint)
        }
        guard overChrome, let hit = super.hitTest(point, with: event) else { return nil }
        return hit
    }
}

extension Notification.Name {
    static let gridKitDeviceDidShake = Notification.Name("GridKit.deviceDidShake")
}

/// Installs a one-time, contained swizzle of `UIWindow.motionEnded` that
/// rebroadcasts shake gestures as a notification. Only invoked when the
/// `.shake` activation is requested, i.e. never in release builds unless
/// GridKit was force-enabled.
enum ShakeDetector {
    private static var installed = false

    @MainActor
    static func installIfNeeded() {
        guard !installed else { return }
        installed = true

        let cls: AnyClass = UIWindow.self
        let original = #selector(UIWindow.motionEnded(_:with:))
        let replacement = #selector(UIWindow.gridKit_motionEnded(_:with:))
        guard let originalMethod = class_getInstanceMethod(cls, original),
              let replacementMethod = class_getInstanceMethod(cls, replacement)
        else { return }

        // `motionEnded(_:with:)` is inherited from `UIResponder` — `UIWindow` doesn't override it.
        // `method_exchangeImplementations` would therefore swap the *shared* `UIResponder`
        // implementation, so a shake delivered to any responder (e.g. a SwiftUI hosting view) would
        // run our body and try to call `gridKit_motionEnded`, which only `UIWindow` implements —
        // crashing with "unrecognized selector". Instead, ADD `motionEnded` directly to `UIWindow`
        // (contained to windows) and point `gridKit_motionEnded` at the inherited original.
        let addedToWindow = class_addMethod(
            cls,
            original,
            method_getImplementation(replacementMethod),
            method_getTypeEncoding(replacementMethod)
        )
        if addedToWindow {
            class_replaceMethod(
                cls,
                replacement,
                method_getImplementation(originalMethod),
                method_getTypeEncoding(originalMethod)
            )
        } else {
            // `UIWindow` already has its own `motionEnded` — a plain exchange is safe here.
            method_exchangeImplementations(originalMethod, replacementMethod)
        }
    }
}

private extension UIWindow {
    @objc func gridKit_motionEnded(_ motion: UIEvent.EventSubtype, with event: UIEvent?) {
        // Implementations are exchanged: this calls the original motionEnded.
        gridKit_motionEnded(motion, with: event)
        if motion == .motionShake {
            NotificationCenter.default.post(name: .gridKitDeviceDidShake, object: nil)
        }
    }
}
#endif
