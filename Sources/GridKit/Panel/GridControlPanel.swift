#if canImport(UIKit)
import SwiftUI
import UIKit

/// Compact, draggable, collapsible control panel: preset browser, layer
/// toggles, live parameter editing, appearance, and export actions.
struct GridControlPanel: View {
    @ObservedObject var kit: GridKit
    /// Size of the overlay window's content area — used to clamp dragging so the
    /// control can never be pushed fully off-screen (and lost).
    var containerSize: CGSize = .zero
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass

    @State private var offset: CGSize = .zero
    @GestureState private var dragTranslation: CGSize = .zero

    var body: some View {
        Group {
            if kit.isPanelCollapsed {
                collapsedPill
            } else {
                expandedPanel
            }
        }
        .offset(
            x: offset.width + dragTranslation.width,
            y: offset.height + dragTranslation.height
        )
        .padding(.trailing, 12)
        .padding(.bottom, 40)
    }

    private var dragGesture: some Gesture {
        DragGesture()
            .updating($dragTranslation) { value, state, _ in state = value.translation }
            .onEnded { value in
                offset = clamped(
                    CGSize(
                        width: offset.width + value.translation.width,
                        height: offset.height + value.translation.height
                    )
                )
            }
    }

    /// The control is anchored bottom-trailing, so valid offsets pull it left/up (negative) —
    /// clamped so a corner of it always stays on screen.
    private func clamped(_ proposed: CGSize) -> CGSize {
        guard containerSize.width > 0, containerSize.height > 0 else { return proposed }
        return CGSize(
            width: min(0, max(-(containerSize.width - 90), proposed.width)),
            height: min(0, max(-(containerSize.height - 140), proposed.height))
        )
    }

    // MARK: Collapsed

    private var collapsedPill: some View {
        HStack(spacing: 10) {
            // Tap the glyph to toggle the grid overlay on/off.
            Button {
                kit.toggle()
            } label: {
                Image(systemName: kit.isVisible ? "square.grid.3x3.fill" : "square.grid.3x3")
                    .foregroundColor(kit.isVisible ? .accentColor : .primary)
            }
            .buttonStyle(.plain)
            .accessibilityLabel(kit.isVisible ? "Hide grid" : "Show grid")

            // Tap the label to open the configuration panel.
            Button {
                kit.isPanelCollapsed = false
            } label: {
                HStack(spacing: 5) {
                    Text("GridKit").font(.caption.weight(.semibold))
                    Image(systemName: "slider.horizontal.3").font(.caption2)
                }
                .foregroundColor(.primary)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Configure grid")
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(Capsule().fill(.ultraThinMaterial))
        .overlay(Capsule().strokeBorder(Color.primary.opacity(0.15)))
        .gesture(dragGesture)
    }

    // MARK: Expanded

    private var expandedPanel: some View {
        VStack(spacing: 0) {
            header
            Divider()
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    presetBrowser
                    Divider()
                    layerToggles
                    parameterEditors
                    appearanceControls
                    if let scale = kit.configuration.modularScale {
                        Divider()
                        modularScaleInspector(scale)
                    }
                    Divider()
                    actions
                }
                .padding(12)
            }
            .frame(maxHeight: 380)
        }
        .frame(width: 300)
        .background(RoundedRectangle(cornerRadius: 14).fill(.regularMaterial))
        .overlay(RoundedRectangle(cornerRadius: 14).strokeBorder(Color.primary.opacity(0.12)))
        .shadow(color: .black.opacity(0.25), radius: 14, y: 6)
    }

    private var header: some View {
        HStack {
            Image(systemName: "grid")
                .foregroundColor(.accentColor)
            Text("GridKit")
                .font(.subheadline.weight(.semibold))
            Spacer()
            Button {
                kit.isPanelCollapsed = true
            } label: {
                Image(systemName: "chevron.down.circle.fill")
                    .foregroundColor(.secondary)
            }
            .accessibilityLabel("Collapse panel")
            Button {
                kit.hide()
            } label: {
                Image(systemName: "xmark.circle.fill")
                    .foregroundColor(.secondary)
            }
            .accessibilityLabel("Hide grid overlay")
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .contentShape(Rectangle())
        .gesture(dragGesture)
    }

    // MARK: Preset browser

    private var presetBrowser: some View {
        VStack(alignment: .leading, spacing: 8) {
            ForEach(GridPresetCategory.allCases) { category in
                let presets = GridPreset.all.filter { $0.category == category }
                if !presets.isEmpty {
                    Text(category.displayName)
                        .font(.caption2.weight(.semibold))
                        .foregroundColor(.secondary)
                        .textCase(.uppercase)
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 8) {
                            ForEach(presets) { preset in
                                PresetThumbnail(
                                    preset: preset,
                                    isApplied: kit.appliedPresetID == preset.id,
                                    isCompact: horizontalSizeClass == .compact
                                ) {
                                    kit.apply(preset: preset)
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // MARK: Layer toggles

    private var layerToggles: some View {
        VStack(alignment: .leading, spacing: 4) {
            sectionTitle("Layers")
            FlowToggles(kit: kit)
        }
    }

    // MARK: Parameters

    @ViewBuilder
    private var parameterEditors: some View {
        if kit.configuration.columns != nil {
            VStack(alignment: .leading, spacing: 4) {
                sectionTitle("Columns")
                Stepper(
                    "Count: \(kit.configuration.columns?.count ?? 0)",
                    value: editBinding(
                        get: { $0.columns?.count ?? 1 },
                        set: { $0.columns?.count = $1 }
                    ),
                    in: 1...24
                )
                .font(.caption)
                labeledSlider(
                    "Gutter",
                    value: editBinding(
                        get: { Double($0.columns?.gutter ?? 0) },
                        set: { $0.columns?.gutter = CGFloat($1) }
                    ),
                    range: 0...48
                )
                labeledSlider(
                    "Margins",
                    value: editBinding(
                        get: { Double($0.columns?.leadingMargin ?? 0) },
                        set: {
                            $0.columns?.leadingMargin = CGFloat($1)
                            $0.columns?.trailingMargin = CGFloat($1)
                        }
                    ),
                    range: 0...96
                )
            }
        }
        if kit.configuration.baseline != nil {
            VStack(alignment: .leading, spacing: 4) {
                sectionTitle("Baseline")
                Stepper(
                    "Rhythm: \(Int(kit.configuration.baseline?.rhythm ?? 0)) pt",
                    value: editBinding(
                        get: { Double($0.baseline?.rhythm ?? 4) },
                        set: { $0.baseline?.rhythm = CGFloat($1) }
                    ),
                    in: 1...64
                )
                .font(.caption)
                Stepper(
                    emphasisLabel,
                    value: editBinding(
                        get: { Double($0.baseline?.emphasisEvery ?? 0) },
                        set: { $0.baseline?.emphasisEvery = $1 > 0 ? Int($1) : nil }
                    ),
                    in: 0...12
                )
                .font(.caption)
            }
        }
    }

    private var emphasisLabel: String {
        if let every = kit.configuration.baseline?.emphasisEvery {
            return "Emphasis: every \(every)"
        }
        return "Emphasis: off"
    }

    // MARK: Appearance

    private var appearanceControls: some View {
        VStack(alignment: .leading, spacing: 4) {
            sectionTitle("Appearance")
            HStack(spacing: 8) {
                schemeSwatch("Magenta", .magenta)
                schemeSwatch("Cyan", .cyan)
                schemeSwatch("Red", .red)
                ColorPicker("Custom", selection: customColorBinding, supportsOpacity: false)
                    .labelsHidden()
                    .accessibilityLabel("Custom grid color")
            }
            labeledSlider(
                "Opacity",
                value: Binding(
                    get: { kit.configuration.appearance.opacity },
                    set: { kit.configuration.appearance.opacity = $0 }
                ),
                range: 0.1...1,
                step: 0.05
            )
            Toggle(isOn: Binding(
                get: { kit.configuration.appearance.blendMode == .difference },
                set: { kit.configuration.appearance.blendMode = $0 ? .difference : .normal }
            )) {
                Text("Difference blend")
                    .font(.caption)
            }
            .toggleStyle(.switch)
        }
    }

    private func schemeSwatch(_ name: String, _ color: GridColor) -> some View {
        Button {
            kit.configuration.appearance = GridAppearance(
                lineColor: color,
                opacity: kit.configuration.appearance.opacity,
                lineWidth: kit.configuration.appearance.lineWidth,
                blendMode: kit.configuration.appearance.blendMode
            )
        } label: {
            Circle()
                .fill(color.color)
                .frame(width: 22, height: 22)
                .overlay(
                    Circle().strokeBorder(
                        Color.primary.opacity(kit.configuration.appearance.lineColor == color ? 0.8 : 0.15),
                        lineWidth: 2
                    )
                )
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(name) color scheme")
    }

    private var customColorBinding: Binding<Color> {
        Binding(
            get: { kit.configuration.appearance.lineColor.color },
            set: { newColor in
                let ui = UIColor(newColor)
                var r: CGFloat = 0, g: CGFloat = 0, b: CGFloat = 0, a: CGFloat = 0
                guard ui.getRed(&r, green: &g, blue: &b, alpha: &a) else { return }
                kit.configuration.appearance = GridAppearance(
                    lineColor: GridColor(red: r, green: g, blue: b),
                    opacity: kit.configuration.appearance.opacity,
                    lineWidth: kit.configuration.appearance.lineWidth,
                    blendMode: kit.configuration.appearance.blendMode
                )
            }
        )
    }

    // MARK: Modular scale inspector

    private func modularScaleInspector(_ scale: ModularScale) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            sectionTitle("Modular Scale \(String(format: "%.3g", scale.ratio)) / \(Int(scale.baseSize)) pt")
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(alignment: .firstTextBaseline, spacing: 10) {
                    ForEach(scale.steps(), id: \.self) { size in
                        VStack(spacing: 2) {
                            Text("Aa")
                                .font(.system(size: min(CGFloat(size), 34)))
                            Text(String(format: "%.1f", size))
                                .font(.system(size: 8, design: .monospaced))
                                .foregroundColor(.secondary)
                        }
                    }
                }
            }
        }
    }

    // MARK: Actions

    private var actions: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 10) {
                Button {
                    if let image = kit.snapshot() {
                        kit.presentShareSheet(items: [image])
                    }
                } label: {
                    Label("Snapshot", systemImage: "camera")
                        .font(.caption)
                }
                .buttonStyle(.bordered)

                ShareLink(item: kit.exportJSON(), preview: SharePreview("GridKit configuration")) {
                    Label("Export JSON", systemImage: "square.and.arrow.up")
                        .font(.caption)
                }
                .buttonStyle(.bordered)
            }
        }
    }

    // MARK: Helpers

    private func sectionTitle(_ title: String) -> some View {
        Text(title)
            .font(.caption2.weight(.semibold))
            .foregroundColor(.secondary)
            .textCase(.uppercase)
    }

    private func labeledSlider(
        _ title: String,
        value: Binding<Double>,
        range: ClosedRange<Double>,
        step: Double = 1
    ) -> some View {
        HStack {
            Text(title)
                .font(.caption)
                .frame(width: 60, alignment: .leading)
            Slider(value: value, in: range, step: step)
            Text(step < 1 ? String(format: "%.2f", value.wrappedValue) : "\(Int(value.wrappedValue))")
                .font(.caption.monospacedDigit())
                .frame(width: 32, alignment: .trailing)
        }
    }

    /// Binding for live parameter edits. Edits target the visible (regular)
    /// configuration, so the preset's compact override is dropped first.
    private func editBinding<T>(
        get: @escaping (GridConfiguration) -> T,
        set: @escaping (inout GridConfiguration, T) -> Void
    ) -> Binding<T> {
        Binding(
            get: { get(kit.configuration) },
            set: { newValue in
                kit.willLiveEdit()
                set(&kit.configuration, newValue)
            }
        )
    }
}

/// Wrapping toggle chips for the six grid layers.
private struct FlowToggles: View {
    @ObservedObject var kit: GridKit

    private static let entries: [(String, GridLayers)] = [
        ("Columns", .columns),
        ("Rows", .rows),
        ("Baseline", .baseline),
        ("Modules", .modules),
        ("Margins", .margins),
        ("Key lines", .keyLines),
        ("Ruler", .ruler),
    ]

    var body: some View {
        let columns = [GridItem(.adaptive(minimum: 82), spacing: 6)]
        LazyVGrid(columns: columns, alignment: .leading, spacing: 6) {
            ForEach(Self.entries, id: \.0) { name, layer in
                chip(name: name, layer: layer)
            }
        }
    }

    private func chip(name: String, layer: GridLayers) -> some View {
        let isOn = kit.configuration.layers.contains(layer)
        return Button {
            if isOn {
                kit.configuration.layers.remove(layer)
            } else {
                kit.configuration.layers.insert(layer)
            }
        } label: {
            Text(name)
                .font(.caption2.weight(.medium))
                .padding(.horizontal, 8)
                .padding(.vertical, 5)
                .frame(maxWidth: .infinity)
                .background(
                    Capsule().fill(isOn ? Color.accentColor.opacity(0.2) : Color.primary.opacity(0.06))
                )
                .overlay(
                    Capsule().strokeBorder(isOn ? Color.accentColor : Color.primary.opacity(0.15))
                )
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(name) layer")
        .accessibilityValue(isOn ? "on" : "off")
    }
}

/// Miniature rendering of a preset used in the browser.
private struct PresetThumbnail: View {
    let preset: GridPreset
    let isApplied: Bool
    let isCompact: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: 4) {
                GridCanvasView(configuration: thumbnailConfiguration)
                    .frame(width: 72, height: 48)
                    .background(Color.primary.opacity(0.04))
                    .clipShape(RoundedRectangle(cornerRadius: 6))
                    .overlay(
                        RoundedRectangle(cornerRadius: 6).strokeBorder(
                            isApplied ? Color.accentColor : Color.primary.opacity(0.15),
                            lineWidth: isApplied ? 2 : 1
                        )
                    )
                Text(preset.name)
                    .font(.system(size: 9, weight: isApplied ? .semibold : .regular))
                    .lineLimit(1)
                    .frame(width: 76)
            }
        }
        .buttonStyle(.plain)
        .accessibilityLabel(preset.name)
        .accessibilityHint(preset.notes)
    }

    /// Thumbnails render at ~1/5 scale, so pt-based dimensions are divided
    /// down to keep the miniature legible.
    private var thumbnailConfiguration: GridConfiguration {
        var config = (isCompact ? preset.compactConfiguration : nil) ?? preset.configuration
        let factor: CGFloat = 5
        if var columns = config.columns {
            columns.gutter /= factor
            columns.leadingMargin /= factor
            columns.trailingMargin /= factor
            config.columns = columns
        }
        if var rows = config.rows {
            rows.gutter /= factor
            rows.topMargin /= factor
            rows.bottomMargin /= factor
            config.rows = rows
        }
        if var baseline = config.baseline {
            baseline.rhythm = max(baseline.rhythm / factor, 2)
            config.baseline = baseline
        }
        config.keyLines = config.keyLines.map { line in
            var line = line
            if line.unit == .points { line.offset /= factor }
            line.name = ""
            return line
        }
        config.respectsSafeArea = false
        config.layers.remove(.ruler)
        config.appearance.opacity = 1
        return config
    }
}
#endif
