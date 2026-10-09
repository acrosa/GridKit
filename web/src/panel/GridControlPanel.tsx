import { useMemo, useRef, useState, type ChangeEvent } from "react";
import { CYAN, colorFromHex, colorsEqual, cssColor, hexColor, MAGENTA, makeAppearance, RED } from "../config/appearance";
import { baseline } from "../config/builders";
import { cloneConfiguration } from "../config/codec";
import {
  GridLayers,
  hasLayer,
  modularScaleSteps,
  withLayer,
  type GridColor,
  type GridConfiguration,
  type GridLayer,
  type ModularScale,
} from "../config/types";
import { allPresets, PRESET_CATEGORIES, presetCategoryName, type GridPreset } from "../presets";
import { GridCanvas } from "../rendering/GridCanvas";
import type { GridKit } from "../runtime/GridKit";
import { useGridKitState } from "../runtime/hooks";
import { CameraIcon, ChevronDownIcon, CloseIcon, CopyIcon, ExportIcon, GridIcon, ImportIcon, SlidersIcon } from "./icons";
import { useDrag } from "./useDrag";

export interface GridControlPanelProps {
  kit: GridKit;
  containerSize: { width: number; height: number };
  isCompact: boolean;
  hotkeyLabel?: string;
}

/**
 * Compact, draggable, collapsible control: preset browser, layer toggles,
 * live parameter editing, appearance, anchor, and export actions.
 */
export function GridControlPanel({ kit, containerSize, isCompact, hotkeyLabel }: GridControlPanelProps) {
  const state = useGridKitState(kit);
  const drag = useDrag(state.panelOffset, (o) => kit.setPanelOffset(o), containerSize);

  return (
    <div className="gk-control" style={{ transform: drag.transform }}>
      {state.isPanelCollapsed ? (
        <div className={`gk-pill${drag.dragging ? " gk-dragging" : ""}`} {...drag.handleProps}>
          <button
            type="button"
            className={`gk-btn${state.isVisible ? " gk-on" : ""}`}
            onClick={() => kit.toggle()}
            aria-label={state.isVisible ? "Hide grid" : "Show grid"}
            aria-pressed={state.isVisible}
            title={hotkeyLabel ? `Toggle grid (${hotkeyLabel})` : "Toggle grid"}
          >
            <GridIcon filled={state.isVisible} />
          </button>
          <button type="button" className="gk-btn" onClick={() => kit.setPanelCollapsed(false)} aria-label="Configure grid">
            <span className="gk-label">GridKit</span>
            <SlidersIcon />
          </button>
        </div>
      ) : (
        <div className="gk-panel" role="dialog" aria-label="GridKit">
          <div className={`gk-header${drag.dragging ? " gk-dragging" : ""}`} {...drag.handleProps}>
            <span style={{ color: "var(--gk-accent)", display: "inline-flex" }}>
              <GridIcon />
            </span>
            <span>GridKit</span>
            <span className="gk-spacer" />
            <button type="button" className="gk-btn" onClick={() => kit.setPanelCollapsed(true)} aria-label="Collapse panel">
              <ChevronDownIcon />
            </button>
            <button type="button" className="gk-btn" onClick={() => kit.hide()} aria-label="Hide grid overlay">
              <CloseIcon />
            </button>
          </div>
          <div className="gk-body">
            <PresetBrowser kit={kit} appliedPresetID={state.appliedPresetID} isCompact={isCompact} />
            <div className="gk-divider" />
            <LayerToggles kit={kit} configuration={state.configuration} />
            <ParameterEditors kit={kit} configuration={state.configuration} />
            <AppearanceControls kit={kit} configuration={state.configuration} />
            <AnchorControl kit={kit} anchor={state.anchor} />
            {state.configuration.modularScale && (
              <>
                <div className="gk-divider" />
                <ModularScaleInspector scale={state.configuration.modularScale} />
              </>
            )}
            <div className="gk-divider" />
            <Actions kit={kit} />
          </div>
        </div>
      )}
    </div>
  );
}

// MARK: Preset browser

function PresetBrowser({ kit, appliedPresetID, isCompact }: { kit: GridKit; appliedPresetID?: string; isCompact: boolean }) {
  // Re-derive on each open so `bodyDerivedRhythm` reflects the live type scale.
  const presets = useMemo(() => allPresets(), []);
  return (
    <div className="gk-section">
      {PRESET_CATEGORIES.map((category) => {
        const items = presets.filter((p) => p.category === category);
        if (items.length === 0) return null;
        return (
          <div key={category} className="gk-section">
            <div className="gk-title">{presetCategoryName(category)}</div>
            <div className="gk-presets">
              {items.map((preset) => (
                <PresetThumbnail
                  key={preset.id}
                  preset={preset}
                  isApplied={appliedPresetID === preset.id}
                  isCompact={isCompact}
                  onSelect={() => kit.apply(preset)}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Thumbnails render at ~1/5 scale, so px-based dimensions are divided down to keep the miniature legible. */
function thumbnailConfiguration(preset: GridPreset, isCompact: boolean): GridConfiguration {
  const config = cloneConfiguration((isCompact ? preset.compactConfiguration : undefined) ?? preset.configuration);
  const factor = 5;
  if (config.columns) {
    config.columns.gutter /= factor;
    config.columns.leadingMargin /= factor;
    config.columns.trailingMargin /= factor;
  }
  if (config.rows) {
    config.rows.gutter /= factor;
    config.rows.topMargin /= factor;
    config.rows.bottomMargin /= factor;
  }
  if (config.baseline) config.baseline.rhythm = Math.max(config.baseline.rhythm / factor, 2);
  config.keyLines = config.keyLines.map((line) => ({
    ...line,
    offset: line.unit === "points" ? line.offset / factor : line.offset,
    name: "",
  }));
  config.respectsSafeArea = false;
  config.layers &= ~GridLayers.ruler;
  config.appearance = { ...config.appearance, opacity: 1, blendMode: "normal" };
  return config;
}

function PresetThumbnail({
  preset,
  isApplied,
  isCompact,
  onSelect,
}: {
  preset: GridPreset;
  isApplied: boolean;
  isCompact: boolean;
  onSelect: () => void;
}) {
  const config = useMemo(() => thumbnailConfiguration(preset, isCompact), [preset, isCompact]);
  return (
    <button
      type="button"
      className={`gk-btn gk-preset${isApplied ? " gk-on" : ""}`}
      onClick={onSelect}
      title={preset.notes}
      aria-label={preset.name}
      aria-pressed={isApplied}
    >
      <div className="gk-thumb">
        <GridCanvas configuration={config} size={{ width: 72, height: 48 }} labels={false} />
      </div>
      <span className="gk-name">{preset.name}</span>
    </button>
  );
}

// MARK: Layers

const LAYER_ENTRIES: Array<[string, GridLayer]> = [
  ["Columns", "columns"],
  ["Rows", "rows"],
  ["Baseline", "baseline"],
  ["Modules", "modules"],
  ["Margins", "margins"],
  ["Key lines", "keyLines"],
  ["Ruler", "ruler"],
];

function LayerToggles({ kit, configuration }: { kit: GridKit; configuration: GridConfiguration }) {
  return (
    <div className="gk-section">
      <div className="gk-title">Layers</div>
      <div className="gk-chips">
        {LAYER_ENTRIES.map(([name, layer]) => {
          // A baseline layer with no spec draws nothing, so show it as off.
          const on = hasLayer(configuration.layers, layer) && (layer !== "baseline" || !!configuration.baseline);
          return (
            <button
              key={layer}
              type="button"
              className={`gk-btn gk-chip${on ? " gk-on" : ""}`}
              aria-pressed={on}
              aria-label={`${name} layer`}
              onClick={() => {
                if (!on && layer === "baseline" && !configuration.baseline) {
                  // Turning on vertical rhythm for a grid without one adds an editable 8 px baseline.
                  kit.update((c) => {
                    c.baseline = baseline(8, 3);
                    c.layers = withLayer(c.layers, "baseline", true);
                  });
                } else {
                  kit.setLayer(layer, !on);
                }
              }}
            >
              {name}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// MARK: Parameters

function Stepper({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="gk-stepper">
      <span>{label}</span>
      <span className="gk-steps" role="group" aria-label={label}>
        <button type="button" className="gk-btn" aria-label="Decrement" disabled={value <= min} onClick={() => onChange(Math.max(min, value - 1))}>
          −
        </button>
        <button type="button" className="gk-btn" aria-label="Increment" disabled={value >= max} onClick={() => onChange(Math.min(max, value + 1))}>
          +
        </button>
      </span>
    </div>
  );
}

function LabeledSlider({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="gk-row">
      <span className="gk-key">{label}</span>
      <input
        className="gk-range"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <span className="gk-val">{step < 1 ? value.toFixed(2) : Math.round(value)}</span>
    </label>
  );
}

function ParameterEditors({ kit, configuration }: { kit: GridKit; configuration: GridConfiguration }) {
  const cols = configuration.columns;
  const base = configuration.baseline;
  return (
    <>
      {cols && (
        <div className="gk-section">
          <div className="gk-title">Columns</div>
          <Stepper
            label={`Count: ${cols.count}`}
            value={cols.count}
            min={1}
            max={24}
            onChange={(v) => kit.update((c) => void (c.columns && (c.columns.count = v)))}
          />
          <LabeledSlider
            label="Gutter"
            value={cols.gutter}
            min={0}
            max={48}
            onChange={(v) => kit.update((c) => void (c.columns && (c.columns.gutter = v)))}
          />
          <LabeledSlider
            label="Margins"
            value={cols.leadingMargin}
            min={0}
            max={160}
            onChange={(v) =>
              kit.update((c) => {
                if (c.columns) {
                  c.columns.leadingMargin = v;
                  c.columns.trailingMargin = v;
                }
              })
            }
          />
        </div>
      )}
      {base && (
        <div className="gk-section">
          <div className="gk-title">Baseline</div>
          <Stepper
            label={`Rhythm: ${Math.round(base.rhythm)} px`}
            value={Math.round(base.rhythm)}
            min={1}
            max={64}
            onChange={(v) => kit.update((c) => void (c.baseline && (c.baseline.rhythm = v)))}
          />
          <Stepper
            label={base.emphasisEvery ? `Emphasis: every ${base.emphasisEvery}` : "Emphasis: off"}
            value={base.emphasisEvery ?? 0}
            min={0}
            max={12}
            onChange={(v) =>
              kit.update((c) => {
                if (!c.baseline) return;
                if (v > 0) c.baseline.emphasisEvery = v;
                else delete c.baseline.emphasisEvery;
              })
            }
          />
          <LabeledSlider
            label="Offset"
            value={base.offset}
            min={0}
            max={Math.max(1, Math.round(base.rhythm) - 1)}
            onChange={(v) => kit.update((c) => void (c.baseline && (c.baseline.offset = v)))}
          />
        </div>
      )}
    </>
  );
}

// MARK: Appearance

function AppearanceControls({ kit, configuration }: { kit: GridKit; configuration: GridConfiguration }) {
  const appearance = configuration.appearance;
  const setLineColor = (color: GridColor) =>
    kit.update((c) => {
      c.appearance = makeAppearance({
        lineColor: color,
        opacity: c.appearance.opacity,
        ...(c.appearance.lineWidth !== undefined ? { lineWidth: c.appearance.lineWidth } : {}),
        blendMode: c.appearance.blendMode,
      });
    }, true);
  const swatch = (name: string, color: GridColor) => (
    <button
      key={name}
      type="button"
      className={`gk-btn gk-swatch${colorsEqual(appearance.lineColor, color) ? " gk-on" : ""}`}
      style={{ background: cssColor(color) }}
      aria-label={`${name} color scheme`}
      title={name}
      onClick={() => setLineColor(color)}
    />
  );
  return (
    <div className="gk-section">
      <div className="gk-title">Appearance</div>
      <div className="gk-swatches">
        {swatch("Magenta", MAGENTA)}
        {swatch("Cyan", CYAN)}
        {swatch("Red", RED)}
        <input
          className="gk-color"
          type="color"
          value={hexColor(appearance.lineColor)}
          aria-label="Custom grid color"
          title="Custom"
          onChange={(e: ChangeEvent<HTMLInputElement>) => {
            const color = colorFromHex(e.target.value);
            if (color) setLineColor(color);
          }}
        />
      </div>
      <LabeledSlider
        label="Opacity"
        value={appearance.opacity}
        min={0.1}
        max={1}
        step={0.05}
        onChange={(v) => kit.update((c) => void (c.appearance.opacity = v), true)}
      />
      <label className="gk-switch">
        <span>Difference blend</span>
        <button
          type="button"
          role="switch"
          aria-checked={appearance.blendMode === "difference"}
          className={`gk-btn gk-toggle${appearance.blendMode === "difference" ? " gk-on" : ""}`}
          onClick={() =>
            kit.update((c) => void (c.appearance.blendMode = c.appearance.blendMode === "difference" ? "normal" : "difference"), true)
          }
        />
      </label>
      <label className="gk-switch">
        <span>Respect safe area</span>
        <button
          type="button"
          role="switch"
          aria-checked={configuration.respectsSafeArea}
          className={`gk-btn gk-toggle${configuration.respectsSafeArea ? " gk-on" : ""}`}
          onClick={() => kit.update((c) => void (c.respectsSafeArea = !c.respectsSafeArea), true)}
        />
      </label>
    </div>
  );
}

function AnchorControl({ kit, anchor }: { kit: GridKit; anchor: "viewport" | "document" }) {
  return (
    <div className="gk-section">
      <div className="gk-title">
        Anchor <span className="gk-hint">— pin to the viewport or scroll with the page</span>
      </div>
      <div className="gk-segmented" role="radiogroup" aria-label="Grid anchor">
        {(["viewport", "document"] as const).map((value) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={anchor === value}
            className={`gk-btn${anchor === value ? " gk-on" : ""}`}
            onClick={() => kit.setAnchor(value)}
          >
            {value === "viewport" ? "Viewport" : "Document"}
          </button>
        ))}
      </div>
    </div>
  );
}

// MARK: Modular scale

function ModularScaleInspector({ scale }: { scale: ModularScale }) {
  return (
    <div className="gk-section">
      <div className="gk-title">
        Modular scale {Number(scale.ratio.toPrecision(3))} / {Math.round(scale.baseSize)} px
      </div>
      <div className="gk-scale">
        {modularScaleSteps(scale).map((size) => (
          <div key={size} className="gk-step">
            <span style={{ fontSize: Math.min(size, 34), lineHeight: 1 }}>Aa</span>
            <span className="gk-size">{size.toFixed(1)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// MARK: Actions

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function Actions({ kit }: { kit: GridKit }) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string | null>(null);
  const flash = (message: string) => {
    setStatus(message);
    setTimeout(() => setStatus(null), 1800);
  };

  const onSnapshot = async () => {
    const blob = await kit.snapshot();
    if (blob) download(blob, "gridkit-overlay.png");
    else flash("Snapshot unavailable");
  };
  const onExport = () => download(new Blob([kit.exportJSON()], { type: "application/json" }), "gridkit-configuration.json");
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(kit.exportJSON());
      flash("Copied JSON");
    } catch {
      flash("Clipboard blocked");
    }
  };
  const onImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      kit.loadJSON(await file.text());
      flash(`Loaded ${file.name}`);
    } catch (error) {
      flash((error as Error).message);
    }
  };

  return (
    <div className="gk-section">
      <div className="gk-actions">
        <button type="button" className="gk-btn gk-action" onClick={() => void onSnapshot()} title="Download the overlay as a transparent PNG">
          <CameraIcon /> Snapshot
        </button>
        <button type="button" className="gk-btn gk-action" onClick={onExport} title="Download the configuration as JSON">
          <ExportIcon /> Export JSON
        </button>
        <button type="button" className="gk-btn gk-action" onClick={() => void onCopy()} title="Copy the configuration JSON">
          <CopyIcon /> Copy
        </button>
        <button type="button" className="gk-btn gk-action" onClick={() => fileInput.current?.click()} title="Load a configuration JSON file">
          <ImportIcon /> Import
        </button>
        <input ref={fileInput} type="file" accept="application/json,.json" className="gk-hidden" onChange={(e) => void onImport(e)} />
      </div>
      {status && (
        <div className="gk-notes" role="status">
          {status}
        </div>
      )}
    </div>
  );
}
