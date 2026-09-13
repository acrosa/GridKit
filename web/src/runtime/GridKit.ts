import { cloneConfiguration, parseConfiguration, parseConfigurationJSON, serializeConfiguration } from "../config/codec";
import type { GridConfiguration, GridInsets, GridLayer, Rect, Size } from "../config/types";
import { withLayer, ZERO_INSETS } from "../config/types";
import { drawGrid } from "../rendering/draw";
import { swissTwelveColumn, type GridPreset } from "../presets";
import type { GridAnchor, GridKitOptions } from "./types";

export interface GridKitState {
  isVisible: boolean;
  /** The active configuration (regular-width variant when the applied preset defines a compact override). */
  configuration: GridConfiguration;
  /** Compact-width variant supplied by the applied preset. Cleared on live edits so edits are WYSIWYG. */
  compactConfiguration?: GridConfiguration;
  /** ID of the most recently applied preset (for panel highlighting). */
  appliedPresetID?: string;
  /** Whether the control panel is collapsed to a pill. Persisted. */
  isPanelCollapsed: boolean;
  /** Viewport-pinned or document-scrolling grid. Persisted once changed. */
  anchor: GridAnchor;
  /** Panel position offset from its bottom-right home, in CSS px (≤ 0). Persisted. */
  panelOffset: { x: number; y: number };
}

/** What the mounted overlay last rendered with — needed for `snapshot()`. */
export interface RenderEnvironment {
  size: Size;
  viewport: Rect;
  safeArea: GridInsets;
  scale: number;
  isCompact: boolean;
}

type Listener = () => void;

interface Storage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function safeStorage(): Storage | undefined {
  try {
    if (typeof window === "undefined" || !window.localStorage) return undefined;
    const probe = "__gridkit_probe__";
    window.localStorage.setItem(probe, "1");
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    return undefined;
  }
}

/**
 * Runtime controller for the overlay — the web counterpart of the Swift
 * `GridKit.shared` singleton. It is a tiny external store (subscribe /
 * getState) so React components read it through `useSyncExternalStore`, and
 * plain scripts can drive it without React.
 */
export class GridKit {
  private static _shared: GridKit | undefined;

  static get shared(): GridKit {
    return (this._shared ??= new GridKit());
  }

  /** Test hook: replaces the singleton with a fresh instance. */
  static reset(storageKey?: string): GridKit {
    this._shared = new GridKit(storageKey);
    return this._shared;
  }

  private state: GridKitState;
  private listeners = new Set<Listener>();
  private storage: Storage | undefined;
  private prefix: string;
  private didApplyInitialPreset = false;
  private hasPersistedConfiguration: boolean;
  options: GridKitOptions = {};
  /** Updated by the overlay each render; used by `snapshot()`. */
  environment: RenderEnvironment | undefined;

  constructor(storageKey = "GridKit") {
    this.prefix = storageKey;
    this.storage = safeStorage();

    let configuration: GridConfiguration | undefined;
    let compactConfiguration: GridConfiguration | undefined;
    let appliedPresetID: string | undefined;
    const persisted = this.read("configuration");
    if (persisted) {
      try {
        configuration = parseConfigurationJSON(persisted);
        const compact = this.read("compactConfiguration");
        if (compact) {
          try {
            compactConfiguration = parseConfigurationJSON(compact);
          } catch {
            compactConfiguration = undefined;
          }
        }
        appliedPresetID = this.read("appliedPresetID") ?? undefined;
      } catch {
        configuration = undefined;
      }
    }
    this.hasPersistedConfiguration = configuration !== undefined;
    if (!configuration) {
      configuration = cloneConfiguration(swissTwelveColumn.configuration);
      compactConfiguration = swissTwelveColumn.compactConfiguration
        ? cloneConfiguration(swissTwelveColumn.compactConfiguration)
        : undefined;
      appliedPresetID = swissTwelveColumn.id;
    }

    const collapsed = this.read("panelCollapsed");
    const anchor = this.read("anchor");
    let panelOffset = { x: 0, y: 0 };
    const offsetRaw = this.read("panelOffset");
    if (offsetRaw) {
      try {
        const parsed = JSON.parse(offsetRaw) as { x?: unknown; y?: unknown };
        if (typeof parsed.x === "number" && typeof parsed.y === "number") panelOffset = { x: parsed.x, y: parsed.y };
      } catch {
        /* ignore */
      }
    }

    this.state = {
      isVisible: false,
      configuration,
      isPanelCollapsed: collapsed === null ? true : collapsed === "true",
      anchor: anchor === "document" ? "document" : "viewport",
      panelOffset,
    };
    if (compactConfiguration) this.state.compactConfiguration = compactConfiguration;
    if (appliedPresetID) this.state.appliedPresetID = appliedPresetID;
  }

  // MARK: Store protocol

  getState = (): GridKitState => this.state;

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  private setState(patch: Partial<GridKitState>): void {
    const next: GridKitState = { ...this.state, ...patch };
    // `undefined` patches must actually clear optional keys.
    for (const key of Object.keys(patch) as (keyof GridKitState)[]) {
      if (patch[key] === undefined) delete next[key];
    }
    this.state = next;
    for (const listener of this.listeners) listener();
  }

  // MARK: Public API (parity with the Swift controller)

  get isVisible(): boolean {
    return this.state.isVisible;
  }

  get configuration(): GridConfiguration {
    return this.state.configuration;
  }

  show(): void {
    if (!this.state.isVisible) this.setState({ isVisible: true });
  }

  hide(): void {
    if (this.state.isVisible) this.setState({ isVisible: false });
  }

  toggle(): void {
    this.state.isVisible ? this.hide() : this.show();
  }

  apply(preset: GridPreset): void {
    this.setState({
      configuration: cloneConfiguration(preset.configuration),
      compactConfiguration: preset.compactConfiguration ? cloneConfiguration(preset.compactConfiguration) : undefined,
      appliedPresetID: preset.id,
    });
    this.write("appliedPresetID", preset.id);
    this.persistConfiguration();
  }

  applyConfiguration(configuration: GridConfiguration): void {
    this.setState({
      configuration: cloneConfiguration(configuration),
      compactConfiguration: undefined,
      appliedPresetID: undefined,
    });
    this.remove("appliedPresetID");
    this.persistConfiguration();
  }

  /** Applies a configuration from a JSON string or an already-parsed object. */
  loadJSON(json: string | unknown): void {
    this.applyConfiguration(typeof json === "string" ? parseConfigurationJSON(json) : parseConfiguration(json));
  }

  /** Fetches and applies a JSON grid definition, e.g. a shared team grid committed to the repo. */
  async load(url: string | URL): Promise<void> {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`GridKit: failed to load ${String(url)} (${response.status})`);
    this.loadJSON(await response.text());
  }

  /** Exports the active configuration as pretty-printed JSON (iOS-compatible). */
  exportJSON(): string {
    return serializeConfiguration(this.state.configuration);
  }

  /**
   * Updates the configuration in place. Live edits target the visible
   * (regular) configuration, so the preset's compact override is dropped first
   * to keep editing WYSIWYG — unless `keepCompact` is set.
   */
  update(mutate: (config: GridConfiguration) => void, keepCompact = false): void {
    const configuration = cloneConfiguration(this.state.configuration);
    mutate(configuration);
    this.setState(keepCompact ? { configuration } : { configuration, compactConfiguration: undefined });
    this.persistConfiguration();
  }

  /** Call before live parameter edits: drops the compact override so edits are WYSIWYG. */
  willLiveEdit(): void {
    if (this.state.compactConfiguration) {
      this.setState({ compactConfiguration: undefined });
      this.persistConfiguration();
    }
  }

  setLayer(layer: GridLayer, on: boolean): void {
    this.update((c) => {
      c.layers = withLayer(c.layers, layer, on);
    }, true);
  }

  setPanelCollapsed(collapsed: boolean): void {
    this.setState({ isPanelCollapsed: collapsed });
    this.write("panelCollapsed", String(collapsed));
  }

  setAnchor(anchor: GridAnchor): void {
    this.setState({ anchor });
    this.write("anchor", anchor);
  }

  setPanelOffset(offset: { x: number; y: number }): void {
    this.setState({ panelOffset: offset });
    this.write("panelOffset", JSON.stringify(offset));
  }

  /** The configuration to render for a given width class. */
  activeConfiguration(isCompact: boolean): GridConfiguration {
    if (isCompact && this.state.compactConfiguration) return this.state.compactConfiguration;
    return this.state.configuration;
  }

  /**
   * Renders the grid overlay (as last laid out on screen) to a transparent
   * PNG at device resolution, for layering over a screenshot in design review.
   * Browsers can't composite the page itself without a screen-capture
   * permission, so the overlay layer is exported on its own.
   */
  async snapshot(): Promise<Blob | null> {
    const env = this.environment;
    if (!env || typeof document === "undefined") return null;
    const canvas = document.createElement("canvas");
    const { viewport, scale } = env;
    canvas.width = Math.round(viewport.width * scale);
    canvas.height = Math.round(viewport.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.scale(scale, scale);
    ctx.translate(-viewport.x, -viewport.y);
    ctx.globalAlpha = this.state.configuration.appearance.opacity;
    drawGrid(ctx, env.size, this.activeConfiguration(env.isCompact), {
      scale,
      safeArea: env.safeArea,
      viewport,
    });
    return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), "image/png"));
  }

  // MARK: Installation (called by the overlay component)

  install(options: GridKitOptions): void {
    this.options = options;
    // The initial preset only SEEDS a first launch — once the user has edited (and thus
    // persisted) a configuration, their edits win over the compile-time preset.
    if (!this.didApplyInitialPreset) {
      this.didApplyInitialPreset = true;
      if (!this.hasPersistedConfiguration && options.initialPreset) this.apply(options.initialPreset);
      if (options.anchor && this.read("anchor") === null) this.setState({ anchor: options.anchor });
    }
  }

  // MARK: Persistence

  private key(name: string): string {
    return `${this.prefix}.${name}`;
  }
  private read(name: string): string | null {
    try {
      return this.storage?.getItem(this.key(name)) ?? null;
    } catch {
      return null;
    }
  }
  private write(name: string, value: string): void {
    try {
      this.storage?.setItem(this.key(name), value);
    } catch {
      /* quota / private mode — persistence is best-effort */
    }
  }
  private remove(name: string): void {
    try {
      this.storage?.removeItem(this.key(name));
    } catch {
      /* ignore */
    }
  }

  private persistConfiguration(): void {
    this.hasPersistedConfiguration = true;
    this.write("configuration", serializeConfiguration(this.state.configuration));
    if (this.state.compactConfiguration) {
      this.write("compactConfiguration", serializeConfiguration(this.state.compactConfiguration));
    } else {
      this.remove("compactConfiguration");
    }
  }
}

export { ZERO_INSETS };
