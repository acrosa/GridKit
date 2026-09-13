import { makeAppearance } from "./appearance";
import {
  STANDARD_LAYERS,
  type BaselineSpec,
  type ColumnSpec,
  type GridAppearance,
  type GridConfiguration,
  type KeyLine,
  type KeyLineAnchor,
  type KeyLineUnit,
  type ModularScale,
  type RowSpec,
} from "./types";

/** Convenience constructors mirroring the Swift initializers. */

export function columns(
  count: number,
  gutter: number,
  margin: number | { leading: number; trailing: number },
  highlightedColumns?: [number, number],
): ColumnSpec {
  const spec: ColumnSpec = {
    count,
    gutter,
    leadingMargin: typeof margin === "number" ? margin : margin.leading,
    trailingMargin: typeof margin === "number" ? margin : margin.trailing,
  };
  if (highlightedColumns) spec.highlightedColumns = highlightedColumns;
  return spec;
}

export function rows(count: number, gutter: number, margin: number | { top: number; bottom: number }): RowSpec {
  return {
    count,
    gutter,
    topMargin: typeof margin === "number" ? margin : margin.top,
    bottomMargin: typeof margin === "number" ? margin : margin.bottom,
  };
}

export function baseline(rhythm: number, emphasisEvery?: number, offset = 0): BaselineSpec {
  const spec: BaselineSpec = { rhythm, offset };
  if (emphasisEvery !== undefined) spec.emphasisEvery = emphasisEvery;
  return spec;
}

export function keyLine(
  name: string,
  axis: "horizontal" | "vertical",
  offset: number,
  anchor: KeyLineAnchor = "start",
  unit: KeyLineUnit = "points",
): KeyLine {
  return { name, axis, offset, anchor, unit };
}

/**
 * Rounds a font line height to the nearest multiple of `unit`, clamped to at
 * least `unit`. Used to derive a baseline rhythm from a computed CSS
 * line-height.
 */
export function rhythmForLineHeight(lineHeight: number, multiple = 1, roundedTo = 1): number {
  const raw = lineHeight * Math.max(multiple, 1);
  const snapped = Math.round(raw / roundedTo) * roundedTo;
  return Math.max(snapped, roundedTo);
}

export interface ConfigurationOptions {
  columns?: ColumnSpec;
  rows?: RowSpec;
  baseline?: BaselineSpec;
  keyLines?: KeyLine[];
  appearance?: GridAppearance;
  respectsSafeArea?: boolean;
  layers?: number;
  modularScale?: ModularScale;
}

export function configuration(options: ConfigurationOptions = {}): GridConfiguration {
  const config: GridConfiguration = {
    keyLines: options.keyLines ?? [],
    appearance: options.appearance ?? makeAppearance(),
    respectsSafeArea: options.respectsSafeArea ?? true,
    layers: options.layers ?? STANDARD_LAYERS,
  };
  if (options.columns) config.columns = options.columns;
  if (options.rows) config.rows = options.rows;
  if (options.baseline) config.baseline = options.baseline;
  if (options.modularScale) config.modularScale = options.modularScale;
  return config;
}
