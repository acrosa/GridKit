import { cssColor } from "../config/appearance";
import { hasLayer, type GridConfiguration, type GridInsets, type Rect, type Size, ZERO_INSETS } from "../config/types";
import {
  baselines,
  columnFrames,
  hairlineWidth,
  moduleFrames,
  resolvedPosition,
  rowFrames,
  snappedLinePosition,
} from "../geometry/GridGeometry";

export interface DrawOptions {
  /** Device pixel ratio used for hairlines and pixel snapping. */
  scale: number;
  /** Safe-area insets (notches, or a host-supplied fixed header/sidebar). */
  safeArea?: GridInsets;
  /**
   * Visible window into the grid area, in the same coordinate space as `size`.
   * When the grid is anchored to the document, `size` is the whole document
   * and `viewport` is the scrolled-into-view portion; drawing outside it is
   * culled. Defaults to the full `size`.
   */
  viewport?: Rect;
  /** Draw text labels (key line names, ruler numbers). Thumbnails turn this off. */
  labels?: boolean;
}

/**
 * Draws a configuration into a 2D canvas context whose transform already maps
 * CSS px to device pixels (and, for document-anchored grids, has been
 * translated by the scroll offset). Opacity and blend mode are applied by the
 * host element via CSS, not here — same split as the SwiftUI renderer.
 */
export function drawGrid(ctx: CanvasRenderingContext2D, size: Size, config: GridConfiguration, options: DrawOptions): void {
  const appearance = config.appearance;
  const layers = config.layers;
  const insets = options.safeArea ?? ZERO_INSETS;
  const safeArea = config.respectsSafeArea ? insets : ZERO_INSETS;
  const viewport = options.viewport ?? { x: 0, y: 0, width: size.width, height: size.height };
  const labels = options.labels ?? true;
  const scale = Math.max(options.scale, 1);
  const lineWidth = appearance.lineWidth ?? hairlineWidth(scale);
  const snap = (v: number) => snappedLinePosition(v, scale, lineWidth);
  const visibleY = (y: number) => y >= viewport.y - 1 && y <= viewport.y + viewport.height + 1;
  const visibleX = (x: number) => x >= viewport.x - 1 && x <= viewport.x + viewport.width + 1;

  let columns: Rect[] = [];
  let rows: Rect[] = [];
  if (config.columns) columns = columnFrames(size, config.columns, insets, config.respectsSafeArea);
  if (config.rows) rows = rowFrames(size, config.rows, insets, config.respectsSafeArea);

  // Margin & gutter tint: everything outside the column zones (even-odd fill).
  if (hasLayer(layers, "margins") && columns.length > 0) {
    ctx.beginPath();
    ctx.rect(viewport.x, viewport.y, viewport.width, viewport.height);
    for (const c of columns) ctx.rect(c.x, viewport.y, c.width, viewport.height);
    ctx.fillStyle = cssColor(appearance.marginTint);
    ctx.fill("evenodd");
  }

  // Highlighted column zone (asymmetric grids).
  if (hasLayer(layers, "columns") && config.columns?.highlightedColumns && columns.length > 0) {
    const [lower, upper] = config.columns.highlightedColumns;
    const first = columns[Math.max(lower, 1) - 1];
    const last = columns[Math.min(upper, columns.length) - 1];
    if (first && last && upper >= lower) {
      ctx.fillStyle = cssColor(appearance.moduleTint);
      ctx.fillRect(first.x, viewport.y, last.x + last.width - first.x, viewport.height);
    }
  }

  // Modules.
  if (hasLayer(layers, "modules") && columns.length > 0 && rows.length > 0) {
    ctx.fillStyle = cssColor(appearance.moduleTint);
    ctx.beginPath();
    for (const m of moduleFrames(columns, rows)) {
      if (m.y + m.height < viewport.y || m.y > viewport.y + viewport.height) continue;
      ctx.rect(m.x, m.y, m.width, m.height);
    }
    ctx.fill();
  }

  ctx.lineWidth = lineWidth;
  ctx.setLineDash([]);

  // Column edges.
  if (hasLayer(layers, "columns") && columns.length > 0) {
    ctx.strokeStyle = cssColor(appearance.lineColor);
    ctx.beginPath();
    for (const c of columns) {
      for (const x of [c.x, c.x + c.width]) {
        const sx = snap(x);
        ctx.moveTo(sx, viewport.y);
        ctx.lineTo(sx, viewport.y + viewport.height);
      }
    }
    ctx.stroke();
  }

  // Row edges.
  if (hasLayer(layers, "rows") && rows.length > 0) {
    ctx.strokeStyle = cssColor(appearance.lineColor);
    ctx.beginPath();
    for (const r of rows) {
      for (const y of [r.y, r.y + r.height]) {
        if (!visibleY(y)) continue;
        const sy = snap(y);
        ctx.moveTo(viewport.x, sy);
        ctx.lineTo(viewport.x + viewport.width, sy);
      }
    }
    ctx.stroke();
  }

  // Baseline grid.
  if (hasLayer(layers, "baseline") && config.baseline) {
    const lines = baselines(size.height, config.baseline, safeArea.top);
    ctx.strokeStyle = cssColor(appearance.lineColor, 0.55);
    ctx.beginPath();
    for (const line of lines) {
      if (line.isEmphasis || !visibleY(line.position)) continue;
      const y = snap(line.position);
      ctx.moveTo(viewport.x, y);
      ctx.lineTo(viewport.x + viewport.width, y);
    }
    ctx.stroke();
    ctx.strokeStyle = cssColor(appearance.emphasisColor);
    ctx.beginPath();
    for (const line of lines) {
      if (!line.isEmphasis || !visibleY(line.position)) continue;
      const y = snap(line.position);
      ctx.moveTo(viewport.x, y);
      ctx.lineTo(viewport.x + viewport.width, y);
    }
    ctx.stroke();
  }

  // Key lines with labels.
  if (hasLayer(layers, "keyLines")) {
    ctx.strokeStyle = cssColor(appearance.emphasisColor);
    ctx.fillStyle = cssColor(appearance.emphasisColor);
    ctx.lineWidth = Math.max(lineWidth, 1);
    ctx.setLineDash([6, 3]);
    ctx.font = "500 9px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    for (const keyLine of config.keyLines) {
      const position = snap(resolvedPosition(keyLine, size, insets, config.respectsSafeArea));
      ctx.beginPath();
      if (keyLine.axis === "horizontal") {
        if (!visibleY(position)) continue;
        ctx.moveTo(viewport.x, position);
        ctx.lineTo(viewport.x + viewport.width, position);
        ctx.stroke();
        if (labels && keyLine.name) ctx.fillText(keyLine.name, viewport.x + safeArea.leading + 6, position - 8);
      } else {
        if (!visibleX(position)) continue;
        ctx.moveTo(position, viewport.y);
        ctx.lineTo(position, viewport.y + viewport.height);
        ctx.stroke();
        if (labels && keyLine.name) ctx.fillText(keyLine.name, position + 4, viewport.y + safeArea.top + 10);
      }
    }
    ctx.setLineDash([]);
    ctx.lineWidth = lineWidth;
  }

  // Spacing ruler: ticks along the leading edge every 8 px, labels every 80 px.
  if (hasLayer(layers, "ruler")) {
    ctx.strokeStyle = cssColor(appearance.lineColor);
    ctx.fillStyle = cssColor(appearance.lineColor);
    ctx.font = "8px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    ctx.beginPath();
    const start = safeArea.top;
    const labelsToDraw: Array<[string, number]> = [];
    for (let pt = 0, y = start; y <= size.height; pt += 8, y += 8) {
      if (!visibleY(y)) continue;
      const major = pt % 80 === 0;
      const length = major ? 12 : pt % 40 === 0 ? 8 : 4;
      const sy = snap(y);
      ctx.moveTo(viewport.x, sy);
      ctx.lineTo(viewport.x + length, sy);
      if (major && pt > 0 && labels) labelsToDraw.push([String(pt), sy]);
    }
    ctx.stroke();
    for (const [text, y] of labelsToDraw) ctx.fillText(text, viewport.x + 14, y);
  }
}
