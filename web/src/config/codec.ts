import { MAGENTA, makeAppearance } from "./appearance";
import {
  STANDARD_LAYERS,
  type BaselineSpec,
  type ColumnSpec,
  type GridAppearance,
  type GridColor,
  type GridConfiguration,
  type KeyLine,
  type ModularScale,
  type RowSpec,
} from "./types";

/**
 * Forgiving JSON decoding that mirrors the Swift `init(from:)` defaults, so a
 * hand-written `brand-grid.json` may omit any optional field and decode
 * identically on both platforms.
 */

export class GridConfigurationError extends Error {
  override name = "GridConfigurationError";
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function num(obj: Record<string, unknown>, key: string, fallback: number, path: string): number {
  const v = obj[key];
  if (v === undefined || v === null) return fallback;
  if (typeof v !== "number" || !Number.isFinite(v)) {
    throw new GridConfigurationError(`${path}.${key} must be a number`);
  }
  return v;
}

function requiredNum(obj: Record<string, unknown>, key: string, path: string): number {
  const v = obj[key];
  if (typeof v !== "number" || !Number.isFinite(v)) {
    throw new GridConfigurationError(`${path}.${key} is required and must be a number`);
  }
  return v;
}

function optionalNum(obj: Record<string, unknown>, key: string, path: string): number | undefined {
  const v = obj[key];
  if (v === undefined || v === null) return undefined;
  return num(obj, key, 0, path);
}

function optionalInt(obj: Record<string, unknown>, key: string, path: string): number | undefined {
  const v = optionalNum(obj, key, path);
  return v === undefined ? undefined : Math.trunc(v);
}

function enumValue<T extends string>(
  obj: Record<string, unknown>,
  key: string,
  allowed: readonly T[],
  fallback: T,
  path: string,
): T {
  const v = obj[key];
  if (v === undefined || v === null) return fallback;
  if (typeof v !== "string" || !(allowed as readonly string[]).includes(v)) {
    throw new GridConfigurationError(`${path}.${key} must be one of ${allowed.join(", ")}`);
  }
  return v as T;
}

export function parseColor(input: unknown, path = "color"): GridColor {
  if (!isRecord(input)) throw new GridConfigurationError(`${path} must be an object`);
  return {
    red: requiredNum(input, "red", path),
    green: requiredNum(input, "green", path),
    blue: requiredNum(input, "blue", path),
    alpha: num(input, "alpha", 1, path),
  };
}

export function parseColumnSpec(input: unknown, path = "columns"): ColumnSpec {
  if (!isRecord(input)) throw new GridConfigurationError(`${path} must be an object`);
  const leading = num(input, "leadingMargin", 16, path);
  const spec: ColumnSpec = {
    count: Math.trunc(requiredNum(input, "count", path)),
    gutter: num(input, "gutter", 16, path),
    leadingMargin: leading,
    trailingMargin: num(input, "trailingMargin", leading, path),
  };
  const highlighted = input.highlightedColumns;
  if (highlighted !== undefined && highlighted !== null) {
    if (
      !Array.isArray(highlighted) ||
      highlighted.length !== 2 ||
      typeof highlighted[0] !== "number" ||
      typeof highlighted[1] !== "number"
    ) {
      throw new GridConfigurationError(`${path}.highlightedColumns must be [lower, upper]`);
    }
    spec.highlightedColumns = [Math.trunc(highlighted[0]), Math.trunc(highlighted[1])];
  }
  return spec;
}

export function parseRowSpec(input: unknown, path = "rows"): RowSpec {
  if (!isRecord(input)) throw new GridConfigurationError(`${path} must be an object`);
  const top = num(input, "topMargin", 16, path);
  return {
    count: Math.trunc(requiredNum(input, "count", path)),
    gutter: num(input, "gutter", 16, path),
    topMargin: top,
    bottomMargin: num(input, "bottomMargin", top, path),
  };
}

export function parseBaselineSpec(input: unknown, path = "baseline"): BaselineSpec {
  if (!isRecord(input)) throw new GridConfigurationError(`${path} must be an object`);
  const spec: BaselineSpec = {
    rhythm: requiredNum(input, "rhythm", path),
    offset: num(input, "offset", 0, path),
  };
  const every = optionalInt(input, "emphasisEvery", path);
  if (every !== undefined) spec.emphasisEvery = every;
  return spec;
}

export function parseKeyLine(input: unknown, path = "keyLine"): KeyLine {
  if (!isRecord(input)) throw new GridConfigurationError(`${path} must be an object`);
  const name = input.name;
  return {
    name: typeof name === "string" ? name : "Guide",
    axis: enumValue(input, "axis", ["horizontal", "vertical"] as const, "horizontal", path),
    offset: requiredNum(input, "offset", path),
    anchor: enumValue(input, "anchor", ["start", "end"] as const, "start", path),
    unit: enumValue(input, "unit", ["points", "fraction"] as const, "points", path),
  };
}

export function parseAppearance(input: unknown, path = "appearance"): GridAppearance {
  if (!isRecord(input)) throw new GridConfigurationError(`${path} must be an object`);
  const opt = (key: string) =>
    input[key] === undefined || input[key] === null ? undefined : parseColor(input[key], `${path}.${key}`);
  const lineWidth = optionalNum(input, "lineWidth", path);
  return makeAppearance({
    lineColor: opt("lineColor") ?? MAGENTA,
    emphasisColor: opt("emphasisColor"),
    marginTint: opt("marginTint"),
    moduleTint: opt("moduleTint"),
    opacity: num(input, "opacity", 0.6, path),
    ...(lineWidth !== undefined ? { lineWidth } : {}),
    blendMode: enumValue(input, "blendMode", ["normal", "difference"] as const, "normal", path),
  });
}

export function parseModularScale(input: unknown, path = "modularScale"): ModularScale {
  if (!isRecord(input)) throw new GridConfigurationError(`${path} must be an object`);
  return { ratio: requiredNum(input, "ratio", path), baseSize: requiredNum(input, "baseSize", path) };
}

/** Decodes a plain object (already `JSON.parse`d) into a `GridConfiguration`. */
export function parseConfiguration(input: unknown): GridConfiguration {
  if (!isRecord(input)) throw new GridConfigurationError("configuration must be an object");
  const config: GridConfiguration = {
    keyLines: [],
    appearance: input.appearance == null ? makeAppearance() : parseAppearance(input.appearance),
    respectsSafeArea: typeof input.respectsSafeArea === "boolean" ? input.respectsSafeArea : true,
    layers: typeof input.layers === "number" ? Math.trunc(input.layers) : STANDARD_LAYERS,
  };
  if (input.columns != null) config.columns = parseColumnSpec(input.columns);
  if (input.rows != null) config.rows = parseRowSpec(input.rows);
  if (input.baseline != null) config.baseline = parseBaselineSpec(input.baseline);
  if (input.keyLines != null) {
    if (!Array.isArray(input.keyLines)) throw new GridConfigurationError("keyLines must be an array");
    config.keyLines = input.keyLines.map((line, i) => parseKeyLine(line, `keyLines[${i}]`));
  }
  if (input.modularScale != null) config.modularScale = parseModularScale(input.modularScale);
  return config;
}

/** Decodes a JSON string into a `GridConfiguration`. */
export function parseConfigurationJSON(json: string): GridConfiguration {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch (error) {
    throw new GridConfigurationError(`invalid JSON: ${(error as Error).message}`);
  }
  return parseConfiguration(raw);
}

/** Recursively sorts object keys so exports are stable and diff-friendly (matches Swift's `.sortedKeys`). */
function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (isRecord(value)) {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort()) {
      const v = value[key];
      if (v !== undefined) out[key] = sortKeys(v);
    }
    return out;
  }
  return value;
}

/** Encodes a configuration as pretty-printed, key-sorted JSON compatible with the iOS decoder. */
export function serializeConfiguration(config: GridConfiguration): string {
  return JSON.stringify(sortKeys(config), null, 2);
}

/** Deep-clones a configuration (they're plain data, so structured cloning via JSON is exact). */
export function cloneConfiguration(config: GridConfiguration): GridConfiguration {
  return JSON.parse(JSON.stringify(config)) as GridConfiguration;
}

export function configurationsEqual(a: GridConfiguration, b: GridConfiguration): boolean {
  return serializeConfiguration(a) === serializeConfiguration(b);
}
