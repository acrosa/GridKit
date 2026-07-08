import SwiftUI

public extension View {
    /// Attaches the GridKit overlay system at the app root.
    ///
    ///     WindowGroup {
    ///         ContentView()
    ///             .gridKit(.enabled(activation: .shake))
    ///     }
    ///
    /// In non-DEBUG builds this resolves to the unmodified view unless
    /// `.enabled(force: true)` is passed (intended for internal/TestFlight
    /// builds only).
    @ViewBuilder
    func gridKit(_ mode: GridKitMode) -> some View {
        #if DEBUG && canImport(UIKit)
        switch mode {
        case .disabled:
            self
        case .enabled(let options):
            modifier(GridKitInstaller(options: options))
        }
        #elseif canImport(UIKit)
        switch mode {
        case .enabled(let options) where options.force:
            modifier(GridKitInstaller(options: options))
        default:
            self
        }
        #else
        self
        #endif
    }
}

#if canImport(UIKit)
import UIKit

private struct GridKitInstaller: ViewModifier {
    let options: GridKitOptions

    func body(content: Content) -> some View {
        content.background(
            WindowSceneReader { scene in
                GridKit.shared.install(options: options, scene: scene)
            }
            .frame(width: 0, height: 0)
            .accessibilityHidden(true)
        )
    }
}

/// Zero-sized helper that reports the hosting `UIWindowScene` once the view
/// lands in a window — the hook GridKit uses to attach one overlay window
/// per scene (multi-window iPad support).
private struct WindowSceneReader: UIViewRepresentable {
    let onScene: @MainActor (UIWindowScene) -> Void

    func makeUIView(context: Context) -> SceneReportingView {
        let view = SceneReportingView()
        view.onScene = onScene
        view.isUserInteractionEnabled = false
        view.backgroundColor = .clear
        return view
    }

    func updateUIView(_ uiView: SceneReportingView, context: Context) {
        uiView.onScene = onScene
    }

    final class SceneReportingView: UIView {
        var onScene: (@MainActor (UIWindowScene) -> Void)?

        override func didMoveToWindow() {
            super.didMoveToWindow()
            guard let scene = window?.windowScene else { return }
            onScene?(scene)
        }
    }
}
#endif
