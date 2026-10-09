import { describe, expect, it } from "vitest";
import { serializeConfiguration, parseConfigurationJSON, configurationsEqual } from "../src/config/codec";
import { hasLayer } from "../src/config/types";
import { columnFrames, rowFrames } from "../src/geometry/GridGeometry";
import { allPresets, PRESET_CATEGORIES, presetWithID, swissTwelveColumn, bodyDerivedRhythm } from "../src/presets";

describe("preset library", () => {
  const presets = allPresets();

  it("has unique ids", () => {
    const ids = presets.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("covers every category", () => {
    for (const category of PRESET_CATEGORIES) {
      expect(presets.some((p) => p.category === category)).toBe(true);
    }
  });

  // Horizontal baseline lines are what vertical rhythm is checked against, so
  // every grid ships with one — except the pure key-line golden split.
  it("every preset has a baseline grid", () => {
    for (const p of presets) {
      if (p.id === "hero-split") continue;
      for (const c of [p.configuration, p.compactConfiguration]) {
        if (!c) continue;
        expect(c.baseline, p.id).toBeDefined();
        expect(hasLayer(c.layers, "baseline"), p.id).toBe(true);
      }
    }
  });

  it("modular row gutters and margins sit on the baseline rhythm", () => {
    for (const p of presets) {
      for (const c of [p.configuration, p.compactConfiguration]) {
        if (!c?.rows || !c.baseline) continue;
        for (const v of [c.rows.gutter, c.rows.topMargin, c.rows.bottomMargin]) expect(v % c.baseline.rhythm, p.id).toBe(0);
      }
    }
  });

  it("every preset has at least one drawable layer with a backing spec", () => {
    for (const p of presets) {
      const c = p.configuration;
      const drawable =
        (c.columns && hasLayer(c.layers, "columns")) ||
        (c.rows && hasLayer(c.layers, "rows")) ||
        (c.baseline && hasLayer(c.layers, "baseline")) ||
        (c.keyLines.length > 0 && hasLayer(c.layers, "keyLines"));
      expect(drawable, p.id).toBeTruthy();
    }
  });

  it("every preset lays out on a phone and a desktop viewport", () => {
    for (const p of presets) {
      for (const [config, size] of [
        [p.compactConfiguration ?? p.configuration, { width: 390, height: 844 }],
        [p.configuration, { width: 1440, height: 900 }],
      ] as const) {
        if (config.columns) expect(columnFrames(size, config.columns), p.id).toHaveLength(config.columns.count);
        if (config.rows) expect(rowFrames(size, config.rows), p.id).toHaveLength(config.rows.count);
      }
    }
  });

  it("every preset round-trips through JSON", () => {
    for (const p of presets) {
      expect(configurationsEqual(parseConfigurationJSON(serializeConfiguration(p.configuration)), p.configuration), p.id).toBe(true);
    }
  });

  it("has non-empty notes", () => {
    for (const p of presets) expect(p.notes.length, p.id).toBeGreaterThan(20);
  });

  it("looks up presets by id", () => {
    expect(presetWithID("swiss-12-column")).toBe(swissTwelveColumn);
    expect(presetWithID("nope")).toBeUndefined();
  });

  it("body-derived rhythm falls back sensibly without a DOM", () => {
    expect(bodyDerivedRhythm().configuration.baseline?.rhythm).toBe(24);
  });
});
