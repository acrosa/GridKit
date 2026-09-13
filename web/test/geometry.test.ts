import { describe, expect, it } from "vitest";
import { baseline, columns, keyLine, rows } from "../src/config/builders";
import * as G from "../src/geometry/GridGeometry";

const close = (a: number, b: number, eps = 1e-4) => expect(Math.abs(a - b)).toBeLessThan(eps);

describe("pixel snapping", () => {
  it("hairline width matches display scale", () => {
    expect(G.hairlineWidth(2)).toBe(0.5);
    close(G.hairlineWidth(3), 1 / 3);
    expect(G.hairlineWidth(0)).toBe(1);
  });

  it("odd-pixel strokes snap to pixel centers", () => {
    expect(G.snappedLinePosition(10.3, 2, 0.5)).toBe(10.25);
    close(G.snappedLinePosition(10.3, 3, 1 / 3), 30.5 / 3);
  });

  it("even-pixel strokes snap to pixel boundaries", () => {
    expect(G.snappedLinePosition(10.3, 2, 1)).toBe(10.5);
  });
});

describe("content span", () => {
  it("respects safe area and margins", () => {
    expect(G.contentSpan(390, 16, 16, 0, 0, true)).toEqual([16, 374]);
    expect(G.contentSpan(390, 16, 16, 44, 34, true)).toEqual([60, 340]);
    expect(G.contentSpan(390, 16, 16, 44, 34, false)).toEqual([16, 374]);
  });

  it("is undefined when no space remains", () => {
    expect(G.contentSpan(20, 16, 16, 0, 0, true)).toBeUndefined();
  });
});

describe("columns", () => {
  it("12 column frames tile the content width exactly", () => {
    const frames = G.columnFrames({ width: 390, height: 844 }, columns(12, 16, 16));
    expect(frames).toHaveLength(12);
    const expectedWidth = (358 - 176) / 12;
    for (const f of frames) {
      close(f.width, expectedWidth);
      expect(f.height).toBe(844);
    }
    close(frames[0]!.x, 16);
    close(frames[11]!.x + frames[11]!.width, 374);
    for (let i = 1; i < frames.length; i++) close(frames[i]!.x - (frames[i - 1]!.x + frames[i - 1]!.width), 16);
  });

  it("returns nothing when columns would be non-positive", () => {
    expect(G.columnFrames({ width: 100, height: 100 }, columns(12, 16, 16))).toEqual([]);
    expect(G.columnFrames({ width: 390, height: 100 }, columns(0, 16, 16))).toEqual([]);
  });

  it("applies safe area only when requested", () => {
    const safe = { top: 0, leading: 44, bottom: 0, trailing: 34 };
    const with_ = G.columnFrames({ width: 390, height: 100 }, columns(1, 0, 16), safe, true);
    const without = G.columnFrames({ width: 390, height: 100 }, columns(1, 0, 16), safe, false);
    close(with_[0]!.x, 60);
    close(with_[0]!.width, 280);
    close(without[0]!.x, 16);
    close(without[0]!.width, 358);
  });
});

describe("rows and modules", () => {
  it("row frames tile the content height", () => {
    const frames = G.rowFrames({ width: 390, height: 844 }, rows(5, 16, 24));
    expect(frames).toHaveLength(5);
    close(frames[0]!.y, 24);
    close(frames[4]!.y + frames[4]!.height, 820);
  });

  it("modules are columns × rows", () => {
    const c = G.columnFrames({ width: 390, height: 844 }, columns(3, 16, 24));
    const r = G.rowFrames({ width: 390, height: 844 }, rows(5, 16, 24));
    const modules = G.moduleFrames(c, r);
    expect(modules).toHaveLength(15);
    expect(modules[0]).toEqual({ x: c[0]!.x, y: r[0]!.y, width: c[0]!.width, height: r[0]!.height });
    expect(modules[14]).toEqual({ x: c[2]!.x, y: r[4]!.y, width: c[2]!.width, height: r[4]!.height });
  });
});

describe("baselines", () => {
  it("steps by the rhythm from the top inset and emphasizes every Nth line", () => {
    const lines = G.baselines(40, baseline(8, 3), 4);
    expect(lines.map((l) => l.position)).toEqual([4, 12, 20, 28, 36]);
    expect(lines.map((l) => l.isEmphasis)).toEqual([true, false, false, true, false]);
  });

  it("includes a line landing exactly on the bottom edge", () => {
    expect(G.baselines(32, baseline(8)).map((l) => l.position)).toEqual([0, 8, 16, 24, 32]);
  });

  it("rejects degenerate rhythms", () => {
    expect(G.baselines(100, baseline(0.25))).toEqual([]);
  });

  it("never emphasizes without emphasisEvery", () => {
    expect(G.baselines(24, baseline(8)).every((l) => !l.isEmphasis)).toBe(true);
  });
});

describe("key lines", () => {
  const size = { width: 390, height: 844 };
  const safe = { top: 47, leading: 0, bottom: 34, trailing: 0 };

  it("resolves point offsets from either edge, safe-area relative", () => {
    expect(G.resolvedPosition(keyLine("Nav", "horizontal", 44, "start"), size, safe, true)).toBe(91);
    expect(G.resolvedPosition(keyLine("Tab", "horizontal", 49, "end"), size, safe, true)).toBe(844 - 34 - 49);
    expect(G.resolvedPosition(keyLine("Nav", "horizontal", 44, "start"), size, safe, false)).toBe(44);
  });

  it("resolves fractions of the available extent", () => {
    const line = keyLine("Golden", "horizontal", 0.5, "start", "fraction");
    expect(G.resolvedPosition(line, size, safe, true)).toBe(47 + (844 - 47 - 34) / 2);
    expect(G.resolvedPosition(keyLine("v", "vertical", 0.25, "end", "fraction"), size, safe, true)).toBe(390 - 97.5);
  });
});

describe("measurement helpers", () => {
  it("rhythm deviation is distance to the nearest multiple", () => {
    expect(G.rhythmDeviation(17, 8)).toBe(1);
    expect(G.rhythmDeviation(23, 8)).toBe(1);
    expect(G.rhythmDeviation(16, 8)).toBe(0);
    expect(G.rhythmDeviation(16, undefined)).toBeUndefined();
    expect(G.rhythmDeviation(16, 0)).toBeUndefined();
  });

  it("nearest line delta is signed", () => {
    expect(G.nearestLineDelta(10, [0, 8, 16])).toBe(2);
    expect(G.nearestLineDelta(15, [0, 8, 16])).toBe(-1);
    expect(G.nearestLineDelta(15, [])).toBeUndefined();
  });
});
