import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { makeAppearance, MAGENTA } from "../src/config/appearance";
import { columns, configuration } from "../src/config/builders";
import {
  configurationsEqual,
  GridConfigurationError,
  parseConfiguration,
  parseConfigurationJSON,
  serializeConfiguration,
} from "../src/config/codec";
import { GridLayers, STANDARD_LAYERS } from "../src/config/types";

// The iOS example fixture is the contract: both platforms must decode it identically.
const fixturePath = resolve(__dirname, "../../Examples/brand-grid.json");

describe("brand-grid.json fixture", () => {
  const config = parseConfigurationJSON(readFileSync(fixturePath, "utf8"));

  it("decodes the shared iOS fixture", () => {
    expect(config.columns).toEqual({ count: 12, gutter: 16, leadingMargin: 20, trailingMargin: 20 });
    expect(config.baseline).toEqual({ rhythm: 8, offset: 0, emphasisEvery: 3 });
    expect(config.keyLines).toEqual([{ name: "Hangline", axis: "horizontal", offset: 96, anchor: "start", unit: "points" }]);
    expect(config.appearance.lineColor).toEqual({ red: 0, green: 0.75, blue: 0.95, alpha: 1 });
    expect(config.appearance.opacity).toBe(0.7);
    expect(config.appearance.blendMode).toBe("difference");
    expect(config.appearance.marginTint.alpha).toBeCloseTo(0.06);
    expect(config.respectsSafeArea).toBe(true);
    expect(config.layers).toBe(STANDARD_LAYERS);
    expect(config.modularScale).toEqual({ ratio: 1.25, baseSize: 17 });
    expect(config.rows).toBeUndefined();
  });

  it("round-trips through serialize/parse", () => {
    const json = serializeConfiguration(config);
    expect(configurationsEqual(parseConfigurationJSON(json), config)).toBe(true);
    // Sorted keys: stable, diff-friendly output.
    const keys = Object.keys(JSON.parse(json) as Record<string, unknown>);
    expect(keys).toEqual([...keys].sort());
  });
});

describe("forgiving defaults", () => {
  it("fills in Swift's decode defaults for omitted fields", () => {
    const config = parseConfiguration({ columns: { count: 6 }, rows: { count: 2 }, baseline: { rhythm: 4 } });
    expect(config.columns).toEqual({ count: 6, gutter: 16, leadingMargin: 16, trailingMargin: 16 });
    expect(config.rows).toEqual({ count: 2, gutter: 16, topMargin: 16, bottomMargin: 16 });
    expect(config.baseline).toEqual({ rhythm: 4, offset: 0 });
    expect(config.keyLines).toEqual([]);
    expect(config.appearance).toEqual(makeAppearance({ lineColor: MAGENTA }));
    expect(config.layers).toBe(STANDARD_LAYERS);
  });

  it("trailing margin defaults to the leading margin", () => {
    expect(parseConfiguration({ columns: { count: 4, leadingMargin: 30 } }).columns?.trailingMargin).toBe(30);
  });

  it("key line name/anchor/unit default", () => {
    const line = parseConfiguration({ keyLines: [{ axis: "vertical", offset: 10 }] }).keyLines[0];
    expect(line).toEqual({ name: "Guide", axis: "vertical", offset: 10, anchor: "start", unit: "points" });
  });

  it("decodes highlighted column ranges", () => {
    const c = parseConfiguration({ columns: { count: 5, highlightedColumns: [1, 2] } });
    expect(c.columns?.highlightedColumns).toEqual([1, 2]);
  });

  it("empty object is a valid (empty) configuration", () => {
    const c = parseConfiguration({});
    expect(c.columns).toBeUndefined();
    expect(c.keyLines).toEqual([]);
  });
});

describe("validation", () => {
  it("rejects malformed input with a typed error", () => {
    expect(() => parseConfiguration(null)).toThrow(GridConfigurationError);
    expect(() => parseConfiguration({ columns: {} })).toThrow(/count/);
    expect(() => parseConfiguration({ baseline: { rhythm: "8" } })).toThrow(/rhythm/);
    expect(() => parseConfiguration({ keyLines: [{ axis: "diagonal", offset: 1 }] })).toThrow(/axis/);
    expect(() => parseConfiguration({ appearance: { blendMode: "multiply" } })).toThrow(/blendMode/);
    expect(() => parseConfiguration({ columns: { count: 5, highlightedColumns: [1] } })).toThrow(/highlightedColumns/);
    expect(() => parseConfigurationJSON("{not json")).toThrow(GridConfigurationError);
  });
});

describe("serialization", () => {
  it("omits undefined optionals and encodes layers as a bitmask", () => {
    const json = serializeConfiguration(configuration({ columns: columns(3, 8, 8), layers: GridLayers.columns }));
    const raw = JSON.parse(json) as Record<string, unknown>;
    expect(raw.rows).toBeUndefined();
    expect(raw.layers).toBe(1);
    expect(raw.columns).toEqual({ count: 3, gutter: 8, leadingMargin: 8, trailingMargin: 8 });
  });
});
