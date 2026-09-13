import { useCallback, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

export interface Offset {
  x: number;
  y: number;
}

/**
 * Pointer-based dragging for the control. The control is anchored
 * bottom-right, so valid offsets pull it left/up (≤ 0), clamped so a corner
 * always stays on screen. Movement under `threshold` px is a tap, not a drag,
 * so buttons inside the drag handle keep working.
 */
export function useDrag(
  offset: Offset,
  onCommit: (offset: Offset) => void,
  container: { width: number; height: number },
  threshold = 4,
) {
  const [translation, setTranslation] = useState<Offset>({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const start = useRef<{ x: number; y: number; pointerId: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);

  const clamp = useCallback(
    (proposed: Offset): Offset => {
      if (!(container.width > 0) || !(container.height > 0)) return proposed;
      return {
        x: Math.min(0, Math.max(-(container.width - 90), proposed.x)),
        y: Math.min(0, Math.max(-(container.height - 140), proposed.y)),
      };
    },
    [container.width, container.height],
  );

  const onPointerDown = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0) return;
    start.current = { x: event.clientX, y: event.clientY, pointerId: event.pointerId, moved: false };
    suppressClick.current = false;
  }, []);

  const onPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      const s = start.current;
      if (!s || s.pointerId !== event.pointerId) return;
      const dx = event.clientX - s.x;
      const dy = event.clientY - s.y;
      if (!s.moved) {
        if (Math.abs(dx) < threshold && Math.abs(dy) < threshold) return;
        s.moved = true;
        setDragging(true);
        event.currentTarget.setPointerCapture?.(event.pointerId);
      }
      setTranslation({ x: dx, y: dy });
    },
    [threshold],
  );

  const onPointerUp = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      const s = start.current;
      if (!s || s.pointerId !== event.pointerId) return;
      start.current = null;
      if (s.moved) {
        suppressClick.current = true;
        onCommit(clamp({ x: offset.x + (event.clientX - s.x), y: offset.y + (event.clientY - s.y) }));
        event.currentTarget.releasePointerCapture?.(event.pointerId);
      }
      setTranslation({ x: 0, y: 0 });
      setDragging(false);
    },
    [clamp, offset.x, offset.y, onCommit],
  );

  /** Swallows the click that follows a drag so the handle's buttons don't fire. */
  const onClickCapture = useCallback((event: React.MouseEvent<HTMLElement>) => {
    if (suppressClick.current) {
      suppressClick.current = false;
      event.stopPropagation();
      event.preventDefault();
    }
  }, []);

  return {
    dragging,
    transform: `translate(${clamp({ x: offset.x + translation.x, y: offset.y + translation.y }).x}px, ${
      clamp({ x: offset.x + translation.x, y: offset.y + translation.y }).y
    }px)`,
    handleProps: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp, onClickCapture },
  };
}
