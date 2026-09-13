import type { BaselineSpec, ColumnSpec, GridInsets, KeyLine, Rect, RowSpec, Size } from "../config/types";
import { ZERO_INSETS } from "../config/types";

/** A resolved line position along one axis. */
export interface GridLine {
  position: number;
  isEmphasis: boolean;
}

/**
 * Pure layout math for the overlay renderer — a direct port of the Swift
 * `GridGeometry` enum. All functions are deterministic and unit-tested; the
 * canvas layer only converts their output to paths.
 */

// MARK: Pixel snapping

/** Width of a 1-device-pixel hairline in CSS px. */
export function hairlineWidth(scale: number): number {
  return 1 / Math.max(scale, 1);
}

/**
 * Snaps a stroke's center position so the stroke covers whole device pixels
 * and renders crisp on 2x/3x displays. Odd-pixel strokes are centered on a
 * pixel *center*; even-pixel strokes on a pixel *boundary*.
 */
export function snappedLinePosition(position: number, scale: number, lineWidth: number): number {
  const s = Math.max(scale, 1);
  const pixelWidth = Math.round(lineWidth * s);
  if (pixelWidth % 2 === 1) {
    return (Math.floor(position * s) + 0.5) / s;
  }
  return Math.round(position * s) / s;
}

// MARK: Columns & rows

/**
 * The grid span along one axis after margins and (optionally) safe-area
 * insets. Returns `undefined` when there is no positive space to draw in.
 */
export function contentSpan(
  total: number,
  startMargin: number,
  endMargin: number,
  safeStart: number,
  safeEnd: number,
  respectsSafeArea: boolean,
): [number, number] | undefined {
  const start = startMargin + (respectsSafeArea ? safeStart : 0);
  const end = total - endMargin - (respectsSafeArea ? safeEnd : 0);
  if (!(end > start)) return undefined;
  return [start, end];
}

/** Frames of each column, spanning the full height of the grid area. */
export function columnFrames(
  size: Size,
  spec: ColumnSpec,
  safeArea: GridInsets = ZERO_INSETS,
  respectsSafeArea = true,
): Rect[] {
  if (spec.count <= 0) return [];
  const span = contentSpan(
    size.width,
    spec.leadingMargin,
    spec.trailingMargin,
    safeArea.leading,
    safeArea.trailing,
    respectsSafeArea,
  );
  if (!span) return [];
  const contentWidth = span[1] - span[0];
  const gutterTotal = spec.gutter * (spec.count - 1);
  const columnWidth = (contentWidth - gutterTotal) / spec.count;
  if (!(columnWidth > 0)) return [];
  const frames: Rect[] = [];
  for (let i = 0; i < spec.count; i++) {
    frames.push({ x: span[0] + i * (columnWidth + spec.gutter), y: 0, width: columnWidth, height: size.height });
  }
  return frames;
}

/** Frames of each row, spanning the full width of the grid area. */
export function rowFrames(
  size: Size,
  spec: RowSpec,
  safeArea: GridInsets = ZERO_INSETS,
  respectsSafeArea = true,
): Rect[] {
  if (spec.count <= 0) return [];
  const span = contentSpan(size.height, spec.topMargin, spec.bottomMargin, safeArea.top, safeArea.bottom, respectsSafeArea);
  if (!span) return [];
  const contentHeight = span[1] - span[0];
  const gutterTotal = spec.gutter * (spec.count - 1);
  const rowHeight = (contentHeight - gutterTotal) / spec.count;
  if (!(rowHeight > 0)) return [];
  const frames: Rect[] = [];
  for (let i = 0; i < spec.count; i++) {
    frames.push({ x: 0, y: span[0] + i * (rowHeight + spec.gutter), width: size.width, height: rowHeight });
  }
  return frames;
}

/** Module cells: intersections of columns × rows. */
export function moduleFrames(columns: Rect[], rows: Rect[]): Rect[] {
  const modules: Rect[] = [];
  for (const row of rows) {
    for (const column of columns) {
      modules.push({ x: column.x, y: row.y, width: column.width, height: row.height });
    }
  }
  return modules;
}

// MARK: Baselines

/**
 * Baseline y-positions within `height`, starting at `topInset + spec.offset`,
 * stepping by the rhythm. The first line and then every `emphasisEvery`th
 * line after it are emphasized.
 */
export function baselines(height: number, spec: BaselineSpec, topInset = 0): GridLine[] {
  if (!(spec.rhythm > 0.5)) return [];
  const lines: GridLine[] = [];
  let y = topInset + spec.offset;
  let index = 0;
  const every = spec.emphasisEvery;
  while (y <= height + 0.001) {
    const isEmphasis = every !== undefined && every > 0 ? index % every === 0 : false;
    lines.push({ position: y, isEmphasis });
    y += spec.rhythm;
    index += 1;
  }
  return lines;
}

// MARK: Key lines

/** Resolves a key line to an absolute position along its axis. */
export function resolvedPosition(
  keyLine: KeyLine,
  size: Size,
  safeArea: GridInsets,
  respectsSafeArea: boolean,
): number {
  const horizontal = keyLine.axis === "horizontal";
  const extent = horizontal ? size.height : size.width;
  const startInset = respectsSafeArea ? (horizontal ? safeArea.top : safeArea.leading) : 0;
  const endInset = respectsSafeArea ? (horizontal ? safeArea.bottom : safeArea.trailing) : 0;
  const available = extent - startInset - endInset;
  const distance = keyLine.unit === "fraction" ? keyLine.offset * available : keyLine.offset;
  return keyLine.anchor === "start" ? startInset + distance : extent - endInset - distance;
}

// MARK: Measurement helpers

/** How far `distance` deviates from the nearest multiple of `rhythm` (undefined when no rhythm). */
export function rhythmDeviation(distance: number, rhythm: number | undefined): number | undefined {
  if (rhythm === undefined || !(rhythm > 0)) return undefined;
  const remainder = distance % rhythm;
  return Math.min(remainder, rhythm - remainder);
}

/** Signed delta from `value` to the nearest candidate (positive = past the line). */
export function nearestLineDelta(value: number, candidates: number[]): number | undefined {
  if (candidates.length === 0) return undefined;
  let nearest = candidates[0] as number;
  for (const c of candidates) if (Math.abs(value - c) < Math.abs(value - nearest)) nearest = c;
  return value - nearest;
}
