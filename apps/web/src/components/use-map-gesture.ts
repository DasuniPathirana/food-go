"use client";

import { useRef, type PointerEvent } from "react";

type Point = { x: number; y: number };
type Touch = { start: Point; current: Point; moved: boolean };
const position = (event: PointerEvent) => ({ x: event.clientX, y: event.clientY });
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

/** Both illustrated and low-graphics maps use the same single-finger pan and two-finger pinch. */
export function useMapGesture(onPan: (dx: number, dy: number) => void, onZoom: (ratio: number) => void, onTap: (point: Point) => void) {
  const touches = useRef(new Map<number, Touch>());
  return {
    onPointerDown(event: PointerEvent<HTMLDivElement>) {
      if (event.button !== 0 || (event.target as Element).closest("button,a,input,select,textarea,[data-map-overlay]")) return;
      const point = position(event);
      const contact = { start: point, current: point, moved: false };
      touches.current.set(event.pointerId, contact);
      if (touches.current.size > 1) for (const touch of touches.current.values()) touch.moved = true;
      event.currentTarget.focus({ preventScroll: true });
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    onPointerMove(event: PointerEvent<HTMLDivElement>) {
      const touch = touches.current.get(event.pointerId);
      if (!touch) return;
      const point = position(event);
      const previous = touch.current;
      touch.current = point;
      const other = Array.from(touches.current.values()).find(contact => contact !== touch);
      if (other) {
        const before = distance(other.current, previous);
        const after = distance(other.current, point);
        if (before > 1 && after > 1) onZoom(after / before);
        return;
      }
      if (touch.moved || distance(point, touch.start) > 4) {
        const last = touch.moved ? previous : touch.start;
        touch.moved = true;
        onPan(point.x - last.x, point.y - last.y);
      }
    },
    onPointerUp(event: PointerEvent<HTMLDivElement>) {
      const touch = touches.current.get(event.pointerId);
      touches.current.delete(event.pointerId);
      if (touch && !touch.moved && distance(position(event), touch.start) <= 4) onTap(position(event));
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    },
    onPointerCancel(event: PointerEvent<HTMLDivElement>) { touches.current.delete(event.pointerId); },
    onLostPointerCapture(event: PointerEvent<HTMLDivElement>) { touches.current.delete(event.pointerId); },
  };
}
