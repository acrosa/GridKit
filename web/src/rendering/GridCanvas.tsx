import { useLayoutEffect, useRef, type CSSProperties } from "react";
import type { GridConfiguration, GridInsets, Rect, Size } from "../config/types";
import { drawGrid } from "./draw";

export interface GridCanvasProps {
  configuration: GridConfiguration;
  /** Logical grid area. For viewport-anchored grids this is the viewport; for document-anchored, the document. */
  size: Size;
  /** Visible window into `size`. Defaults to the full size. */
  viewport?: Rect;
  safeArea?: GridInsets;
  /** Device pixel ratio. Default `window.devicePixelRatio`. */
  scale?: number;
  /** Draw key-line/ruler labels. Default true. */
  labels?: boolean;
  className?: string;
  style?: CSSProperties;
}

/**
 * Draws a `GridConfiguration` into a `<canvas>` sized to the visible viewport
 * at device resolution. Purely visual — `pointer-events: none` — and only
 * redraws when its inputs change. Opacity and blend mode are applied as CSS so
 * the browser composites them, exactly like the SwiftUI `Canvas` modifiers.
 */
export function GridCanvas({ configuration, size, viewport, safeArea, scale, labels, className, style }: GridCanvasProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  const view = viewport ?? { x: 0, y: 0, width: size.width, height: size.height };
  const dpr = scale ?? (typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1);

  useLayoutEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const pixelWidth = Math.max(1, Math.round(view.width * dpr));
    const pixelHeight = Math.max(1, Math.round(view.height * dpr));
    if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
    if (canvas.height !== pixelHeight) canvas.height = pixelHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, pixelWidth, pixelHeight);
    ctx.scale(dpr, dpr);
    ctx.translate(-view.x, -view.y);
    drawGrid(ctx, size, configuration, {
      scale: dpr,
      safeArea,
      viewport: view,
      labels,
    });
  }, [configuration, size.width, size.height, view.x, view.y, view.width, view.height, safeArea, dpr, labels]);

  const { appearance } = configuration;
  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      className={className}
      style={{
        display: "block",
        width: view.width,
        height: view.height,
        pointerEvents: "none",
        opacity: appearance.opacity,
        mixBlendMode: appearance.blendMode === "difference" ? "difference" : "normal",
        ...style,
      }}
    />
  );
}
