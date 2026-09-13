// gridkit-react — development-time layout grid overlays for React web apps.

// Configuration model (shared JSON format with the iOS library)
export type {
  BaselineSpec,
  ColumnSpec,
  GridAppearance,
  GridBlendMode,
  GridColor,
  GridConfiguration,
  GridInsets,
  GridLayer,
  KeyLine,
  KeyLineAnchor,
  KeyLineAxis,
  KeyLineUnit,
  ModularScale,
  Rect,
  RowSpec,
  Size,
} from "./config/types";
export { ALL_LAYERS, GridLayers, STANDARD_LAYERS, ZERO_INSETS, hasLayer, keyLineID, modularScaleSteps, withLayer } from "./config/types";
export {
  CYAN,
  CYAN_APPEARANCE,
  MAGENTA,
  MAGENTA_APPEARANCE,
  RED,
  RED_APPEARANCE,
  colorFromHex,
  colorsEqual,
  cssColor,
  gridColor,
  hexColor,
  makeAppearance,
  type AppearanceOptions,
} from "./config/appearance";
export {
  GridConfigurationError,
  cloneConfiguration,
  configurationsEqual,
  parseConfiguration,
  parseConfigurationJSON,
  serializeConfiguration,
} from "./config/codec";
export { baseline, columns, configuration, keyLine, rhythmForLineHeight, rows, type ConfigurationOptions } from "./config/builders";

// Geometry (pure, unit-tested)
export * as GridGeometry from "./geometry/GridGeometry";
export type { GridLine } from "./geometry/GridGeometry";

// Presets
export {
  PRESET_CATEGORIES,
  allPresets,
  asymmetricEditorial,
  bodyDerivedRhythm,
  bodyLineHeight,
  bootstrapContainer,
  cardFeed,
  dashboardModules,
  eightColumn,
  eightPointRhythm,
  folioGrid,
  fourColumnMobile,
  fourPointRhythm,
  heroSplit,
  modular3x5,
  modular4x6,
  presetCategoryName,
  presetWithID,
  singleColumnReader,
  sixColumn,
  swissTwelveColumn,
  webAppShell,
  type GridPreset,
  type GridPresetCategory,
} from "./presets";

// Rendering
export { GridCanvas, type GridCanvasProps } from "./rendering/GridCanvas";
export { drawGrid, type DrawOptions } from "./rendering/draw";

// Runtime
export { GridKit, type GridKitState, type RenderEnvironment } from "./runtime/GridKit";
export { useGridKit, useGridKitState } from "./runtime/hooks";
export { DEFAULT_COMPACT_BREAKPOINT, DEFAULT_HOTKEY, type GridAnchor, type GridKitActivation, type GridKitOptions } from "./runtime/types";
export { GridKitOverlay, type GridKitOverlayProps } from "./GridKitOverlay";
