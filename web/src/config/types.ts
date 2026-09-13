/**
 * Configuration model — a 1:1 port of the Swift `GridConfiguration` types so
 * the same JSON grid definition (see `Examples/brand-grid.json`) can be shared
 * between the iOS and web overlays.
 */

/** Vertical column grid: count, gutter width, and outer margins. */
export interface ColumnSpec {
  count: number;
  /** Gap between adjacent columns, in CSS px. */
  gutter: number;
  leadingMargin: number;
  trailingMargin: number;
  /**
   * Optional 1-based inclusive range of columns to shade (e.g. a sidebar zone
   * in an asymmetric editorial grid). Encoded as `[lower, upper]` — the same
   * shape Swift's `ClosedRange<Int>` uses in JSON.
   */
  highlightedColumns?: [number, number];
}

/** Horizontal row grid used by modular grids. */
export interface RowSpec {
  count: number;
  gutter: number;
  topMargin: number;
  bottomMargin: number;
}

/** Repeating horizontal lines at a fixed rhythm for typographic vertical rhythm. */
export interface BaselineSpec {
  /** Distance between baselines, in CSS px. */
  rhythm: number;
  /** Offset of the first baseline from the top of the grid area. */
  offset: number;
  /**
   * Draw every Nth line stronger (e.g. every 4th line of a 4 px grid marks the
   * 16 px "beat"). `undefined` disables emphasis.
   */
  emphasisEvery?: number;
}

export type KeyLineAxis = "horizontal" | "vertical";
/** Which edge the offset is measured from: top/left (`start`) or bottom/right (`end`). */
export type KeyLineAnchor = "start" | "end";
/** How `offset` is interpreted: absolute px, or a fraction (0…1) of the grid area's extent. */
export type KeyLineUnit = "points" | "fraction";

/** A named horizontal or vertical guide at a fixed offset — hanglines, folios, header heights. */
export interface KeyLine {
  name: string;
  axis: KeyLineAxis;
  offset: number;
  anchor: KeyLineAnchor;
  unit: KeyLineUnit;
}

export function keyLineID(line: KeyLine): string {
  return `${line.name}-${line.axis}-${line.anchor}-${line.offset}`;
}

/**
 * Independently toggleable layers of the overlay, stored as a bitmask so the
 * JSON encoding matches the Swift `OptionSet`.
 */
export const GridLayers = {
  columns: 1 << 0,
  rows: 1 << 1,
  baseline: 1 << 2,
  modules: 1 << 3,
  margins: 1 << 4,
  keyLines: 1 << 5,
  ruler: 1 << 6,
} as const;
export type GridLayer = keyof typeof GridLayers;

/** Everything except the spacing ruler, which is opt-in. */
export const STANDARD_LAYERS =
  GridLayers.columns |
  GridLayers.rows |
  GridLayers.baseline |
  GridLayers.modules |
  GridLayers.margins |
  GridLayers.keyLines;
export const ALL_LAYERS = STANDARD_LAYERS | GridLayers.ruler;

export function hasLayer(mask: number, layer: GridLayer): boolean {
  return (mask & GridLayers[layer]) !== 0;
}
export function withLayer(mask: number, layer: GridLayer, on: boolean): number {
  return on ? mask | GridLayers[layer] : mask & ~GridLayers[layer];
}

/** A modular type scale (ratio + base size) for the panel's scale inspector. */
export interface ModularScale {
  ratio: number;
  baseSize: number;
}

/** Sizes on the scale from `below` steps under the base to `above` steps over it, ascending. */
export function modularScaleSteps(scale: ModularScale, below = 2, above = 5): number[] {
  const steps: number[] = [];
  for (let i = -below; i <= above; i++) steps.push(scale.baseSize * Math.pow(scale.ratio, i));
  return steps;
}

/** A codable RGBA color (components 0…1) shared with the iOS JSON format. */
export interface GridColor {
  red: number;
  green: number;
  blue: number;
  alpha: number;
}

export type GridBlendMode = "normal" | "difference";

/** Visual styling shared by every layer of a grid configuration. */
export interface GridAppearance {
  /** Color of regular grid lines. */
  lineColor: GridColor;
  /** Color of emphasized lines (every Nth baseline, key lines). */
  emphasisColor: GridColor;
  /** Fill used to tint margin and gutter zones. */
  marginTint: GridColor;
  /** Fill used to shade modules and highlighted column zones. */
  moduleTint: GridColor;
  /** Overall overlay opacity, 0…1. */
  opacity: number;
  /** Explicit line width in CSS px. `undefined` renders hairlines (1 device pixel). */
  lineWidth?: number;
  blendMode: GridBlendMode;
}

/** A complete grid definition composed of independent, stackable layers. */
export interface GridConfiguration {
  columns?: ColumnSpec;
  rows?: RowSpec;
  baseline?: BaselineSpec;
  keyLines: KeyLine[];
  appearance: GridAppearance;
  /** Whether column/row/key-line geometry is inset by the safe area (notches, or a host-supplied fixed header). */
  respectsSafeArea: boolean;
  /** Bitmask of `GridLayers` currently drawn. Layers without a backing spec are skipped regardless. */
  layers: number;
  /** Optional modular scale shown in the control panel's scale inspector. */
  modularScale?: ModularScale;
}

/** Platform-independent edge insets for the geometry layer. */
export interface GridInsets {
  top: number;
  leading: number;
  bottom: number;
  trailing: number;
}
export const ZERO_INSETS: GridInsets = { top: 0, leading: 0, bottom: 0, trailing: 0 };

export interface Size {
  width: number;
  height: number;
}
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}
