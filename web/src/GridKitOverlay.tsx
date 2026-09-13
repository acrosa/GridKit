import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type { Rect, Size } from "./config/types";
import { GridControlPanel } from "./panel/GridControlPanel";
import { injectStyles } from "./panel/styles";
import { GridCanvas } from "./rendering/GridCanvas";
import { activationList, installActivation } from "./runtime/activation";
import { GridKit } from "./runtime/GridKit";
import { useGridKitState, useSafeAreaInsets, useViewport } from "./runtime/hooks";
import { DEFAULT_COMPACT_BREAKPOINT, DEFAULT_HOTKEY, isDevelopmentBuild, type GridKitOptions } from "./runtime/types";

export interface GridKitOverlayProps extends GridKitOptions {
  /** Controller instance. Defaults to `GridKit.shared`. */
  kit?: GridKit;
}

function hotkeyLabel(hotkey: string): string {
  const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform ?? "");
  return hotkey
    .split("+")
    .map((part) => {
      const p = part.trim().toLowerCase();
      if (p === "mod") return isMac ? "⌘" : "Ctrl";
      if (p === "alt" || p === "option") return isMac ? "⌥" : "Alt";
      if (p === "shift") return isMac ? "⇧" : "Shift";
      if (p === "meta" || p === "cmd" || p === "command") return "⌘";
      if (p === "ctrl" || p === "control") return isMac ? "⌃" : "Ctrl";
      return p.toUpperCase();
    })
    .join(isMac ? "" : "+");
}

/**
 * Mounts the GridKit overlay: a passthrough layer above the page (grid canvas
 * + floating control) rendered into a portal on `document.body`, exactly like
 * the iOS overlay window. Place it once at the app root:
 *
 *     <GridKitOverlay activation={["floatingButton", "keyboard"]} />
 *
 * Renders nothing in production builds unless `enabled` is set.
 */
export function GridKitOverlay(props: GridKitOverlayProps) {
  const enabled = props.enabled ?? isDevelopmentBuild();
  // Hooks can't be conditional, so the inert branch is a separate component.
  return enabled ? <ActiveOverlay {...props} /> : null;
}

function ActiveOverlay(props: GridKitOverlayProps) {
  const kit = props.kit ?? GridKit.shared;
  const {
    activation,
    hotkey = DEFAULT_HOTKEY,
    initialPreset,
    safeArea: extraSafeArea,
    compactBreakpoint = DEFAULT_COMPACT_BREAKPOINT,
    anchor: initialAnchor,
    zIndex = 2147483000,
    storageKey,
  } = props;

  const options = useMemo<GridKitOptions>(
    () => ({
      ...(activation !== undefined ? { activation } : {}),
      hotkey,
      ...(initialPreset ? { initialPreset } : {}),
      ...(initialAnchor ? { anchor: initialAnchor } : {}),
      ...(storageKey ? { storageKey } : {}),
      compactBreakpoint,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- arrays compared by identity are fine here; users pass literals
    [JSON.stringify(activation), hotkey, initialPreset?.id, initialAnchor, storageKey, compactBreakpoint],
  );

  // Install once per option set: seeds the initial preset and wires activation triggers.
  useLayoutEffect(() => {
    kit.install(options);
    return installActivation(kit, options);
  }, [kit, options]);

  const [host, setHost] = useState<HTMLDivElement | null>(null);
  useLayoutEffect(() => {
    injectStyles();
    const el = document.createElement("div");
    el.className = "gk-root";
    el.setAttribute("data-gridkit", "");
    el.style.zIndex = String(zIndex);
    document.body.appendChild(el);
    setHost(el);
    return () => {
      el.remove();
      setHost(null);
    };
  }, [zIndex]);

  const state = useGridKitState(kit);
  const showsControl = state.isVisible || activationList(options).includes("floatingButton");
  const anchor = state.anchor;
  const viewport = useViewport(state.isVisible && anchor === "document");
  const safeArea = useSafeAreaInsets(extraSafeArea, `${viewport.width}x${viewport.height}@${viewport.scale}`);
  const isCompact = viewport.width > 0 && viewport.width < compactBreakpoint;
  const configuration = kit.activeConfiguration(isCompact);

  const size: Size = useMemo(
    () =>
      anchor === "document"
        ? { width: viewport.width, height: viewport.documentHeight }
        : { width: viewport.width, height: viewport.height },
    [anchor, viewport.width, viewport.height, viewport.documentHeight],
  );
  const view: Rect = useMemo(
    () =>
      anchor === "document"
        ? { x: 0, y: viewport.scrollY, width: viewport.width, height: viewport.height }
        : { x: 0, y: 0, width: viewport.width, height: viewport.height },
    [anchor, viewport.scrollY, viewport.width, viewport.height],
  );

  // Report the render environment so `GridKit.shared.snapshot()` can reproduce the frame.
  useEffect(() => {
    kit.environment = { size, viewport: view, safeArea, scale: viewport.scale, isCompact };
  }, [kit, size, view, safeArea, viewport.scale, isCompact]);

  if (!host) return null;
  return createPortal(
    <>
      {state.isVisible && viewport.width > 0 && (
        <GridCanvas
          className="gk-canvas"
          configuration={configuration}
          size={size}
          viewport={view}
          safeArea={safeArea}
          scale={viewport.scale}
        />
      )}
      {showsControl && (
        <GridControlPanel
          kit={kit}
          containerSize={{ width: viewport.width, height: viewport.height }}
          isCompact={isCompact}
          hotkeyLabel={activationList(options).includes("keyboard") ? hotkeyLabel(hotkey) : undefined}
        />
      )}
    </>,
    host,
  );
}
