import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { GridConfiguration } from "../src/config/types";
import { allPresets } from "../src/presets";

// The grid-align Claude Code skill (skills/grid-align) carries its own copy of
// the preset table so its Python scripts stay dependency-free. Keep it in sync.
interface SkillVariant {
  columns?: Record<string, unknown>;
  rows?: Record<string, unknown>;
  baseline?: Record<string, unknown>;
  keyLines?: Record<string, unknown>[];
}
interface SkillPreset {
  id: string;
  platforms: string[];
  derived?: string;
  regular: SkillVariant;
  compact?: SkillVariant;
  web?: { regular: SkillVariant; compact?: SkillVariant };
}

const skillPresets: SkillPreset[] = JSON.parse(
  readFileSync(fileURLToPath(new URL("../../skills/grid-align/assets/presets.json", import.meta.url)), "utf8"),
).presets;

function layout(c: GridConfiguration | SkillVariant | undefined) {
  if (!c) return undefined;
  return {
    columns: c.columns ?? null,
    rows: c.rows ?? null,
    baseline: c.baseline ?? null,
    keyLines: c.keyLines?.length ? c.keyLines : [],
  };
}

describe("grid-align skill preset table", () => {
  const webPresets = allPresets();
  const webSkillPresets = skillPresets.filter((p) => p.platforms.includes("web"));

  it("lists exactly the web library's presets", () => {
    expect(webSkillPresets.map((p) => p.id).sort()).toEqual(webPresets.map((p) => p.id).sort());
  });

  for (const preset of webPresets) {
    if (preset.id === "body-derived-rhythm") continue; // rhythm is measured at runtime
    it(`matches ${preset.id}`, () => {
      const skill = webSkillPresets.find((p) => p.id === preset.id)!;
      const regular = skill.web?.regular ?? skill.regular;
      const compact = skill.web ? skill.web.compact : skill.compact;
      expect(layout(regular)).toEqual(layout(preset.configuration));
      expect(layout(compact)).toEqual(layout(preset.compactConfiguration));
    });
  }
});
