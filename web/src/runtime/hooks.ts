import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type { GridInsets } from "../config/types";
import { GridKit, type GridKitState } from "./GridKit";

/** Subscribes to the controller's state. Re-renders on every change. */
export function useGridKitState(kit: GridKit = GridKit.shared): GridKitState {
  return useSyncExternalStore(kit.subscribe, kit.getState, kit.getState);
}

/** Convenience for host apps: `const { isVisible, toggle } = useGridKit()`. */
export function useGridKit(kit: GridKit = GridKit.shared) {
  const state = useGridKitState(kit);
  return useMemo(
    () => ({
      ...state,
      kit,
      show: () => kit.show(),
      hide: () => kit.hide(),
      toggle: () => kit.toggle(),
      apply: kit.apply.bind(kit),
      applyConfiguration: kit.applyConfiguration.bind(kit),
      exportJSON: () => kit.exportJSON(),
    }),
    [state, kit],
  );
}

export interface ViewportMetrics {
  width: number;
  height: number;
  scrollX: number;
  scrollY: number;
  documentWidth: number;
  documentHeight: number;
  scale: number;
}

function readViewport(): ViewportMetrics {
  if (typeof window === "undefined") {
    return { width: 0, height: 0, scrollX: 0, scrollY: 0, documentWidth: 0, documentHeight: 0, scale: 1 };
  }
  const doc = document.documentElement;
  const vv = window.visualViewport;
  const width = doc.clientWidth || window.innerWidth;
  const height = vv?.height ?? (doc.clientHeight || window.innerHeight);
  return {
    width,
    height,
    scrollX: window.scrollX,
    scrollY: window.scrollY,
    documentWidth: Math.max(doc.scrollWidth, width),
    documentHeight: Math.max(doc.scrollHeight, height),
    scale: window.devicePixelRatio || 1,
  };
}

function sameViewport(a: ViewportMetrics, b: ViewportMetrics): boolean {
  return (
    a.width === b.width &&
    a.height === b.height &&
    a.scrollX === b.scrollX &&
    a.scrollY === b.scrollY &&
    a.documentWidth === b.documentWidth &&
    a.documentHeight === b.documentHeight &&
    a.scale === b.scale
  );
}

/**
 * Viewport size, scroll offset, document size and device pixel ratio, updated
 * on resize/scroll/zoom (and document growth, via ResizeObserver). Scroll is
 * only tracked when `trackScroll` is set — viewport-anchored grids don't need
 * to redraw on scroll.
 */
export function useViewport(trackScroll: boolean): ViewportMetrics {
  const [metrics, setMetrics] = useState<ViewportMetrics>(readViewport);
  useEffect(() => {
    if (typeof window === "undefined") return;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const next = readViewport();
        setMetrics((prev) => (sameViewport(prev, next) ? prev : next));
      });
    };
    update();
    window.addEventListener("resize", update);
    window.visualViewport?.addEventListener("resize", update);
    if (trackScroll) window.addEventListener("scroll", update, { passive: true });
    // Device pixel ratio changes when the window moves between displays or the page zooms.
    const mq = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
    mq.addEventListener?.("change", update);
    let observer: ResizeObserver | undefined;
    if (trackScroll && typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(update);
      observer.observe(document.documentElement);
      if (document.body) observer.observe(document.body);
    }
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("resize", update);
      window.removeEventListener("scroll", update);
      mq.removeEventListener?.("change", update);
      observer?.disconnect();
    };
  }, [trackScroll]);
  return metrics;
}

/**
 * The browser's `env(safe-area-inset-*)` values (notches, home indicators),
 * measured through a hidden probe element, merged with host-supplied insets.
 */
export function useSafeAreaInsets(extra: Partial<GridInsets> | undefined, viewportKey: string): GridInsets {
  const [env, setEnv] = useState<GridInsets>({ top: 0, leading: 0, bottom: 0, trailing: 0 });
  useEffect(() => {
    if (typeof document === "undefined" || !document.body) return;
    const probe = document.createElement("div");
    probe.setAttribute("aria-hidden", "true");
    probe.style.cssText =
      "position:fixed;top:0;left:0;width:0;height:0;visibility:hidden;pointer-events:none;" +
      "padding-top:env(safe-area-inset-top,0px);padding-left:env(safe-area-inset-left,0px);" +
      "padding-bottom:env(safe-area-inset-bottom,0px);padding-right:env(safe-area-inset-right,0px);";
    document.body.appendChild(probe);
    const style = getComputedStyle(probe);
    const next: GridInsets = {
      top: parseFloat(style.paddingTop) || 0,
      leading: parseFloat(style.paddingLeft) || 0,
      bottom: parseFloat(style.paddingBottom) || 0,
      trailing: parseFloat(style.paddingRight) || 0,
    };
    probe.remove();
    setEnv((prev) =>
      prev.top === next.top && prev.leading === next.leading && prev.bottom === next.bottom && prev.trailing === next.trailing
        ? prev
        : next,
    );
  }, [viewportKey]);
  return useMemo(
    () => ({
      top: env.top + (extra?.top ?? 0),
      leading: env.leading + (extra?.leading ?? 0),
      bottom: env.bottom + (extra?.bottom ?? 0),
      trailing: env.trailing + (extra?.trailing ?? 0),
    }),
    [env, extra?.top, extra?.leading, extra?.bottom, extra?.trailing],
  );
}
