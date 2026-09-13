import type { GridAppearance, GridBlendMode, GridColor } from "./types";

export function gridColor(red: number, green: number, blue: number, alpha = 1): GridColor {
  return { red, green, blue, alpha };
}

/** Classic layout-guide magenta. */
export const MAGENTA: GridColor = gridColor(1.0, 0.1, 0.65);
export const CYAN: GridColor = gridColor(0.0, 0.75, 0.95);
export const RED: GridColor = gridColor(0.95, 0.2, 0.15);

export function colorsEqual(a: GridColor, b: GridColor): boolean {
  return a.red === b.red && a.green === b.green && a.blue === b.blue && a.alpha === b.alpha;
}

/** CSS `rgba()` string for a GridColor, optionally multiplying its alpha. */
export function cssColor(color: GridColor, alphaMultiplier = 1): string {
  const c = (v: number) => Math.round(Math.min(1, Math.max(0, v)) * 255);
  const a = Math.min(1, Math.max(0, color.alpha * alphaMultiplier));
  return `rgba(${c(color.red)}, ${c(color.green)}, ${c(color.blue)}, ${a})`;
}

/** `#rrggbb` hex for `<input type="color">`; alpha is dropped. */
export function hexColor(color: GridColor): string {
  const h = (v: number) =>
    Math.round(Math.min(1, Math.max(0, v)) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${h(color.red)}${h(color.green)}${h(color.blue)}`;
}

/** Parses `#rgb` / `#rrggbb` into a GridColor (alpha 1). Returns `undefined` when malformed. */
export function colorFromHex(hex: string): GridColor | undefined {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m || !m[1]) return undefined;
  let s = m[1];
  if (s.length === 3) s = s.split("").map((ch) => ch + ch).join("");
  const n = parseInt(s, 16);
  return gridColor(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

export interface AppearanceOptions {
  lineColor?: GridColor;
  emphasisColor?: GridColor;
  marginTint?: GridColor;
  moduleTint?: GridColor;
  opacity?: number;
  lineWidth?: number;
  blendMode?: GridBlendMode;
}

/**
 * Builds an appearance from a line color, deriving emphasis/margin/module
 * colors the same way the Swift initializer does.
 */
export function makeAppearance(options: AppearanceOptions = {}): GridAppearance {
  const line = options.lineColor ?? MAGENTA;
  const derived = (alpha: number): GridColor => gridColor(line.red, line.green, line.blue, alpha);
  const appearance: GridAppearance = {
    lineColor: line,
    emphasisColor: options.emphasisColor ?? derived(1),
    marginTint: options.marginTint ?? derived(0.06),
    moduleTint: options.moduleTint ?? derived(0.1),
    opacity: options.opacity ?? 0.6,
    blendMode: options.blendMode ?? "normal",
  };
  if (options.lineWidth !== undefined) appearance.lineWidth = options.lineWidth;
  return appearance;
}

export const MAGENTA_APPEARANCE: GridAppearance = makeAppearance({ lineColor: MAGENTA });
export const CYAN_APPEARANCE: GridAppearance = makeAppearance({ lineColor: CYAN });
export const RED_APPEARANCE: GridAppearance = makeAppearance({ lineColor: RED });
