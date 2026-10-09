import { baseline, columns, configuration, keyLine, rhythmForLineHeight, rows } from "../config/builders";
import type { GridConfiguration } from "../config/types";

export type GridPresetCategory = "columnSystems" | "rhythm" | "editorial" | "appLayouts";

export const PRESET_CATEGORIES: readonly GridPresetCategory[] = ["columnSystems", "rhythm", "editorial", "appLayouts"];

export function presetCategoryName(category: GridPresetCategory): string {
  switch (category) {
    case "columnSystems":
      return "Column Systems";
    case "rhythm":
      return "Baseline & Rhythm";
    case "editorial":
      return "Editorial & Magazine";
    case "appLayouts":
      return "Web Layouts";
  }
}

/** A curated grid definition with metadata documenting its origin and intended use. */
export interface GridPreset {
  id: string;
  name: string;
  category: GridPresetCategory;
  /** Configuration used at regular (≥ compact breakpoint) widths, and as the fallback everywhere. */
  configuration: GridConfiguration;
  /** Optional variant applied below the compact-width breakpoint (phones). */
  compactConfiguration?: GridConfiguration;
  /** Historical/practical notes and recommended use. */
  notes: string;
}

// MARK: - Column systems

/** 12 columns, 16 px gutter, 16 px margins. The versatile default. */
export const swissTwelveColumn: GridPreset = {
  id: "swiss-12-column",
  name: "Swiss 12-Column",
  category: "columnSystems",
  configuration: configuration({ columns: columns(12, 16, 16), baseline: baseline(8, 3) }),
  compactConfiguration: configuration({ columns: columns(4, 16, 16), baseline: baseline(8, 3) }),
  notes:
    "The workhorse of Swiss-school layout: 12 divides into halves, thirds, quarters and sixths, making almost any arrangement possible. Renders 4 columns at compact widths, over an 8 px baseline grid for vertical rhythm.",
};

/** 8 columns for tablet/wide layouts. */
export const eightColumn: GridPreset = {
  id: "eight-column",
  name: "8-Column",
  category: "columnSystems",
  configuration: configuration({ columns: columns(8, 16, 24), baseline: baseline(8, 3) }),
  compactConfiguration: configuration({ columns: columns(4, 16, 16), baseline: baseline(8, 3) }),
  notes: "A tablet-friendly system: 8 columns pair naturally with split views and two-up layouts. 8 px baseline rhythm.",
};

/** 6 columns with generous 24 px gutters. */
export const sixColumn: GridPreset = {
  id: "six-column",
  name: "6-Column Airy",
  category: "columnSystems",
  configuration: configuration({ columns: columns(6, 24, 24), baseline: baseline(8, 3) }),
  compactConfiguration: configuration({ columns: columns(3, 20, 20), baseline: baseline(8, 3) }),
  notes:
    "Fewer, wider columns with generous gutters — suits content-forward marketing and gallery layouts where breathing room matters. 8 px baseline rhythm.",
};

/** 4 columns, 8 px gutter, 16 px margins — Material-style phone grid. */
export const fourColumnMobile: GridPreset = {
  id: "four-column-mobile",
  name: "4-Column Mobile",
  category: "columnSystems",
  configuration: configuration({ columns: columns(4, 8, 16), baseline: baseline(4, 2) }),
  notes:
    "The Material Design phone grid: 4 columns, tight 8 px gutters, 16 px margins. A pragmatic default for mobile-first sites. Type sits on a 4 px baseline; every 2nd line marks the 8 px component grid.",
};

/** One measure-limited text column, centered, for long-form reading. */
export const singleColumnReader: GridPreset = {
  id: "single-column-reader",
  name: "Single-Column Reader",
  category: "columnSystems",
  configuration: configuration({ columns: columns(1, 0, 96), baseline: baseline(8, 3) }),
  compactConfiguration: configuration({ columns: columns(1, 0, 24), baseline: baseline(8, 3) }),
  notes:
    "A single measure-limited column (~66 characters at body size) with comfortable margins — the classic ideal for long-form reading. Pair with the 8 px rhythm for paragraph spacing.",
};

// MARK: - Baseline / rhythm systems

/** 4 px baseline grid, emphasis every 4th line. */
export const fourPointRhythm: GridPreset = {
  id: "four-point-rhythm",
  name: "4 px Rhythm",
  category: "rhythm",
  configuration: configuration({ baseline: baseline(4, 4) }),
  notes:
    "A fine 4 px baseline grid; every 4th line marks the 16 px beat. Use for dense UI where components sit on a 4 px spacing system.",
};

/** 8 px baseline grid, emphasis every 3rd line. */
export const eightPointRhythm: GridPreset = {
  id: "eight-point-rhythm",
  name: "8 px Rhythm",
  category: "rhythm",
  configuration: configuration({ baseline: baseline(8, 3) }),
  notes:
    "Matches the ubiquitous 8-px spacing system; every 3rd line marks the 24 px beat. The most common vertical rhythm on the web.",
};

/**
 * Reads the document's computed body line-height (px). Falls back to 24 when
 * there is no DOM or the line-height is `normal`.
 */
export function bodyLineHeight(doc: Document | undefined = typeof document === "undefined" ? undefined : document): number {
  if (!doc?.body) return 24;
  const style = doc.defaultView?.getComputedStyle(doc.body);
  if (!style) return 24;
  const lh = parseFloat(style.lineHeight);
  if (Number.isFinite(lh) && lh > 0) return lh;
  const fs = parseFloat(style.fontSize);
  return Number.isFinite(fs) && fs > 0 ? fs * 1.2 : 24;
}

/**
 * Rhythm derived from the document body's computed line-height; evaluated when
 * the preset is applied, so re-apply after changing the site's type scale.
 */
export function bodyDerivedRhythm(): GridPreset {
  const rhythm = rhythmForLineHeight(bodyLineHeight(), 1, 1);
  return {
    id: "body-derived-rhythm",
    name: "Body-Derived Rhythm",
    category: "rhythm",
    configuration: configuration({
      baseline: baseline(rhythm, 4),
      modularScale: { ratio: 1.25, baseSize: 16 },
    }),
    notes:
      "Rhythm derived from the body's computed line-height, so the grid tracks your type scale. Re-apply the preset after a font-size change to re-derive.",
  };
}

// MARK: - Editorial / magazine grids

/** 3 × 5 modular grid with a hangline at the top module. */
export const modular3x5: GridPreset = {
  id: "modular-3x5",
  name: "Modular 3×5",
  category: "editorial",
  configuration: configuration({
    columns: columns(3, 16, 24),
    rows: rows(5, 16, 24),
    baseline: baseline(8, 3),
    keyLines: [keyLine("Hangline", "horizontal", 0.2, "start", "fraction")],
  }),
  notes:
    "A Müller-Brockmann-style modular grid: 3 columns × 5 rows with a hangline one module down, where feature headlines and images hang. Classic magazine feature layout; the 8 px baseline keeps text in adjacent modules on the same lines.",
};

/** Denser modular grid for image-rich, catalog-like layouts. */
export const modular4x6: GridPreset = {
  id: "modular-4x6",
  name: "Modular 4×6",
  category: "editorial",
  configuration: configuration({ columns: columns(4, 12, 20), rows: rows(6, 12, 20), baseline: baseline(4, 3) }),
  notes:
    "A denser modular grid for image-rich, catalog-like layouts — product grids, photo indexes, and dashboards with many small units. A 4 px baseline whose 12 px beat matches the gutters.",
};

/** 5-column grid used asymmetrically: 2-column sidebar + 3-column body. */
export const asymmetricEditorial: GridPreset = {
  id: "asymmetric-editorial",
  name: "Asymmetric Editorial",
  category: "editorial",
  configuration: configuration({
    columns: columns(5, 16, { leading: 24, trailing: 24 }, [1, 2]),
    baseline: baseline(8, 3),
  }),
  notes:
    "A 5-column grid used asymmetrically: the tinted 2-column zone carries captions, pull quotes and sidebars; body copy sits on the remaining 3 columns. A staple of contemporary editorial design.",
};

/** Golden-ratio vertical split with key lines. */
export const heroSplit: GridPreset = {
  id: "hero-split",
  name: "Hero Split (Golden)",
  category: "editorial",
  configuration: configuration({
    keyLines: [
      keyLine("Golden section", "horizontal", 0.382, "start", "fraction"),
      keyLine("Golden section (inverse)", "horizontal", 0.618, "start", "fraction"),
    ],
  }),
  notes:
    "Horizontal key lines at the golden sections (0.382 / 0.618 of the height) for hero-image + content splits. Align the image bottom or content top to a section for a naturally balanced composition.",
};

/** Modular grid with reserved folio/header and footer key lines. */
export const folioGrid: GridPreset = {
  id: "folio-grid",
  name: "Folio Grid",
  category: "editorial",
  configuration: configuration({
    columns: columns(3, 16, 24),
    rows: rows(4, 16, { top: 72, bottom: 56 }),
    baseline: baseline(8, 3),
    keyLines: [keyLine("Running head", "horizontal", 48, "start"), keyLine("Folio", "horizontal", 40, "end")],
  }),
  notes:
    "A book-like modular grid with reserved zones for running heads and folios (page furniture). Useful for reader and documentation sites where chrome must clear the content block. Text sits on an 8 px baseline.",
};

// MARK: - Web layouts

/** Bootstrap-style container: 12 columns, 24 px gutters, 12 px margins, 8 px rhythm. */
export const bootstrapContainer: GridPreset = {
  id: "bootstrap-container",
  name: "Bootstrap 12 / 24",
  category: "appLayouts",
  configuration: configuration({ columns: columns(12, 24, 12), baseline: baseline(8, 3) }),
  compactConfiguration: configuration({ columns: columns(4, 24, 12), baseline: baseline(8, 3) }),
  notes:
    "Bootstrap 5's default grid: 12 columns with a 1.5 rem (24 px) gutter and half-gutter container padding, plus an 8 px rhythm for spacing utilities.",
};

/** Web app chrome: 64 px header key line, 8 px rhythm, 24 px margins. */
export const webAppShell: GridPreset = {
  id: "web-app-shell",
  name: "App Shell",
  category: "appLayouts",
  configuration: configuration({
    columns: columns(1, 0, 24),
    baseline: baseline(8, 3),
    keyLines: [keyLine("Header", "horizontal", 64, "start"), keyLine("Sidebar", "vertical", 256, "start")],
  }),
  compactConfiguration: configuration({
    columns: columns(1, 0, 16),
    baseline: baseline(8, 3),
    keyLines: [keyLine("Header", "horizontal", 56, "start")],
  }),
  notes:
    "Typical SaaS chrome: a 64 px top bar and a 256 px sidebar as key lines, 24 px content margins and an 8 px rhythm. The sidebar guide drops out at compact widths.",
};

/** Feed layout: full-width card zone with 16 px insets, 12 px inter-card rhythm. */
export const cardFeed: GridPreset = {
  id: "card-feed",
  name: "Card Feed",
  category: "appLayouts",
  configuration: configuration({ columns: columns(1, 0, 16), baseline: baseline(12, 2) }),
  notes:
    "For scrolling card feeds: a full-width card zone with 16 px side insets and a 12 px rhythm to check inter-card spacing.",
};

/** 2×N module grid with 12 px gutters for widget/dashboard layouts. */
export const dashboardModules: GridPreset = {
  id: "dashboard-modules",
  name: "Dashboard Modules",
  category: "appLayouts",
  configuration: configuration({ columns: columns(4, 12, 16), rows: rows(6, 12, 16), baseline: baseline(4, 3) }),
  compactConfiguration: configuration({ columns: columns(2, 12, 16), rows: rows(6, 12, 16), baseline: baseline(4, 3) }),
  notes:
    "A 4-across module grid (2 at compact widths) with 12 px gutters, matching widget/dashboard layouts. Modules shade the cells your tiles should fill; a 4 px baseline (12 px beat) aligns the text inside them.",
};

// MARK: - Registry

/** All built-in presets. `bodyDerivedRhythm` is re-derived on each access so it tracks the live type scale. */
export function allPresets(): GridPreset[] {
  return [
    // Column systems
    swissTwelveColumn,
    eightColumn,
    sixColumn,
    fourColumnMobile,
    singleColumnReader,
    // Rhythm
    fourPointRhythm,
    eightPointRhythm,
    bodyDerivedRhythm(),
    // Editorial
    modular3x5,
    modular4x6,
    asymmetricEditorial,
    heroSplit,
    folioGrid,
    // Web layouts
    bootstrapContainer,
    webAppShell,
    cardFeed,
    dashboardModules,
  ];
}

export function presetWithID(id: string): GridPreset | undefined {
  return allPresets().find((p) => p.id === id);
}
