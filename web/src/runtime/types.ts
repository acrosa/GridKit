import type { GridInsets } from "../config/types";
import type { GridPreset } from "../presets";

/** How the overlay is summoned at runtime. Several may be combined. */
export type GridKitActivation =
  /** An always-available draggable pill — tap the glyph to toggle, tap the label to configure. */
  | "floatingButton"
  /** A keyboard shortcut (default `alt+shift+g`, see `hotkey`). */
  | "keyboard"
  /** `?gridkit=1` in the page URL shows the grid on load. */
  | "urlParam"
  /** Device shake via the DeviceMotion API (mobile browsers; iOS needs a permission grant). */
  | "shake"
  /** Only via the programmatic `GridKit.shared` API. */
  | "manual";

/** Whether the grid is pinned to the viewport (like the iOS overlay) or scrolls with the document. */
export type GridAnchor = "viewport" | "document";

export interface GridKitOptions {
  /** Activation mode(s). Default: `["floatingButton", "keyboard"]`. */
  activation?: GridKitActivation | GridKitActivation[];
  /**
   * Shortcut for `keyboard` activation, e.g. `"alt+shift+g"`, `"mod+shift+g"`
   * (`mod` = ⌘ on macOS, Ctrl elsewhere). Default `alt+shift+g`.
   */
  hotkey?: string;
  /** Preset applied on first launch (before the user has persisted any edits). */
  initialPreset?: GridPreset;
  /**
   * Whether GridKit is active. Defaults to `process.env.NODE_ENV !== "production"`
   * so the overlay compiles to nothing in production builds. Pass `true` to
   * force it on for internal/staging builds.
   */
  enabled?: boolean;
  /**
   * Extra insets treated as the "safe area" — e.g. the height of a fixed site
   * header so columns/rows/key lines start below it. Merged with the browser's
   * `env(safe-area-inset-*)` values (notches).
   */
  safeArea?: Partial<GridInsets>;
  /** Viewport widths below this use a preset's compact variant. Default 768. */
  compactBreakpoint?: number;
  /** Initial anchor. Default `"viewport"`. Persisted once the user changes it. */
  anchor?: GridAnchor;
  /** Stacking order of the overlay root. Default 2147483000. */
  zIndex?: number;
  /** `localStorage` key prefix. Default `"GridKit"`. */
  storageKey?: string;
}

export const DEFAULT_HOTKEY = "alt+shift+g";
export const DEFAULT_COMPACT_BREAKPOINT = 768;

export function isDevelopmentBuild(): boolean {
  try {
    // Standard bundler convention (Vite, webpack, Next, esbuild all replace this).
    // Declared loosely so the library doesn't need Node typings.
    const proc = (globalThis as { process?: { env?: { NODE_ENV?: string } } }).process;
    return proc?.env?.NODE_ENV !== "production";
  } catch {
    return true;
  }
}
