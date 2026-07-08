#if canImport(UIKit)
import SwiftUI

/// Root view of the overlay window: grid canvas and the control panel pill.
struct GridOverlayRoot: View {
    @ObservedObject var kit: GridKit
    /// The overlay window hosting this root. Interactive frames are reported straight to it so
    /// each scene's window only captures touches over its own controls (multi-window safe).
    weak var window: GridOverlayWindow?
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass

    var body: some View {
        GeometryReader { proxy in
            let insets = GridInsets(
                top: proxy.safeAreaInsets.top,
                leading: proxy.safeAreaInsets.leading,
                bottom: proxy.safeAreaInsets.bottom,
                trailing: proxy.safeAreaInsets.trailing
            )
            let configuration = kit.activeConfiguration(forCompactWidth: horizontalSizeClass == .compact)

            ZStack(alignment: .bottomTrailing) {
                if kit.isVisible {
                    // The grid is purely visual — never let it capture touches, so taps pass through
                    // to the app and only the single control pill is interactive.
                    GridCanvasView(configuration: configuration, safeAreaInsets: insets)
                        .ignoresSafeArea()
                        .allowsHitTesting(false)
                }

                // One floating control: a draggable pill. Tap the grid glyph to toggle the overlay,
                // tap "GridKit" to open the config panel, drag to move. Always present in
                // floating-button mode; in gesture-activation modes it rides in with the grid.
                if kit.isVisible || kit.activation == .floatingButton {
                    GridControlPanel(kit: kit, containerSize: proxy.size)
                        .transition(.opacity)
                        .reportInteractiveFrame("gridkit.panel", in: window)
                } else {
                    // No control on screen (overlay hidden in a gesture-activation mode) → drop the
                    // stale hit region, otherwise the passthrough window keeps swallowing app taps
                    // where the pill used to be.
                    Color.clear
                        .frame(width: 0, height: 0)
                        .onAppear { window?.interactiveFrames.removeValue(forKey: "gridkit.panel") }
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottomTrailing)
            .frame(width: proxy.size.width, height: proxy.size.height)
        }
        .animation(.easeInOut(duration: 0.15), value: kit.isVisible)
    }
}

private extension View {
    /// Reports this view's window-space frame to the owning overlay window so it captures touches
    /// over the control (and only it).
    func reportInteractiveFrame(_ id: String, in window: GridOverlayWindow?) -> some View {
        background(
            GeometryReader { geo in
                Color.clear
                    .onAppear { window?.interactiveFrames[id] = geo.frame(in: .global) }
                    .onChange(of: geo.frame(in: .global)) { frame in
                        window?.interactiveFrames[id] = frame
                    }
                // NB: intentionally no `onDisappear` clear. Collapsing the panel (and rotation)
                // briefly tears down/rebuilds this background, and an onDisappear→nil there left the
                // control with no hit region — so the collapsed pill couldn't be tapped to reopen.
                // The frame is always re-reported on appear/change while the control is present, and
                // the `else` branch above clears it when the control leaves the screen for real.
            }
        )
    }
}
#endif
