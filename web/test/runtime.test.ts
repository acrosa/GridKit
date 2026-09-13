import { beforeEach, describe, expect, it } from "vitest";
import { GridKit } from "../src/runtime/GridKit";
import { eightPointRhythm, swissTwelveColumn } from "../src/presets";
import { matchesHotkey, parseHotkey } from "../src/runtime/activation";
import { hasLayer } from "../src/config/types";

describe("GridKit controller", () => {
  let kit: GridKit;
  beforeEach(() => {
    kit = GridKit.reset("GridKitTest");
  });

  it("seeds the Swiss 12-column preset", () => {
    expect(kit.getState().appliedPresetID).toBe(swissTwelveColumn.id);
    expect(kit.getState().compactConfiguration?.columns?.count).toBe(4);
    expect(kit.activeConfiguration(true).columns?.count).toBe(4);
    expect(kit.activeConfiguration(false).columns?.count).toBe(12);
  });

  it("show/hide/toggle notify subscribers", () => {
    let calls = 0;
    const unsubscribe = kit.subscribe(() => calls++);
    kit.show();
    kit.show(); // no-op
    kit.toggle();
    unsubscribe();
    kit.toggle();
    expect(calls).toBe(2);
    expect(kit.isVisible).toBe(true);
  });

  it("live edits drop the compact override so edits are WYSIWYG", () => {
    kit.update((c) => {
      if (c.columns) c.columns.count = 6;
    });
    expect(kit.getState().compactConfiguration).toBeUndefined();
    expect(kit.activeConfiguration(true).columns?.count).toBe(6);
  });

  it("layer toggles keep the compact variant", () => {
    kit.setLayer("columns", false);
    expect(hasLayer(kit.configuration.layers, "columns")).toBe(false);
    expect(kit.getState().compactConfiguration).toBeDefined();
  });

  it("applying a preset replaces configuration, compact variant and id", () => {
    kit.apply(eightPointRhythm);
    expect(kit.getState().appliedPresetID).toBe(eightPointRhythm.id);
    expect(kit.getState().compactConfiguration).toBeUndefined();
    expect(kit.configuration.baseline?.rhythm).toBe(8);
    // Presets are copied, never aliased.
    kit.update((c) => void (c.baseline && (c.baseline.rhythm = 12)));
    expect(eightPointRhythm.configuration.baseline?.rhythm).toBe(8);
  });

  it("loads and exports iOS-compatible JSON", () => {
    kit.loadJSON('{"columns":{"count":3},"baseline":{"rhythm":4}}');
    expect(kit.getState().appliedPresetID).toBeUndefined();
    const exported = JSON.parse(kit.exportJSON()) as { columns: { count: number }; baseline: { rhythm: number } };
    expect(exported.columns.count).toBe(3);
    expect(exported.baseline.rhythm).toBe(4);
  });

  it("initial preset only seeds when nothing is persisted", () => {
    kit.install({ initialPreset: eightPointRhythm });
    expect(kit.getState().appliedPresetID).toBe(eightPointRhythm.id);
    kit.install({ initialPreset: swissTwelveColumn });
    expect(kit.getState().appliedPresetID).toBe(eightPointRhythm.id);
  });
});

describe("hotkeys", () => {
  const event = (init: Partial<KeyboardEvent>): KeyboardEvent =>
    ({ altKey: false, shiftKey: false, ctrlKey: false, metaKey: false, code: "", key: "", ...init }) as KeyboardEvent;

  it("matches modifier combos on key code", () => {
    const parsed = parseHotkey("alt+shift+g");
    expect(matchesHotkey(event({ altKey: true, shiftKey: true, code: "KeyG", key: "˝" }), parsed)).toBe(true);
    expect(matchesHotkey(event({ altKey: true, code: "KeyG", key: "g" }), parsed)).toBe(false);
    expect(matchesHotkey(event({ altKey: true, shiftKey: true, ctrlKey: true, code: "KeyG" }), parsed)).toBe(false);
  });

  it("matches non-letter keys by name", () => {
    const parsed = parseHotkey("ctrl+f1");
    expect(matchesHotkey(event({ ctrlKey: true, key: "F1" }), parsed)).toBe(true);
  });
});
