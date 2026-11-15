"use client";

import { createContext, useContext, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Expand, X } from "lucide-react";
import styles from "./map-frame.module.css";

const MapFrameContext = createContext<{
  expanded: boolean;
  toggle: () => void;
} | null>(null);

// The same canvas stays mounted. The inline slot reserves its original height
// while the native modal owns focus, the Escape key and background interaction.
export function MapFrame({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
  const slot = useRef<HTMLDivElement>(null);
  const surface = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const [expanded, setExpanded] = useState(false);

  function toggle() {
    const dialog = surface.current;
    if (!dialog || !slot.current) return;
    if (expanded) { dialog.close(); return; }
    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    slot.current.style.height = `${dialog.getBoundingClientRect().height}px`;
    dialog.removeAttribute("open");
    dialog.showModal();
    setExpanded(true);
  }

  function restore() {
    if (!surface.current || !slot.current) return;
    surface.current.open = true;
    slot.current.style.removeProperty("height");
    setExpanded(false);
    opener.current?.focus({ preventScroll: true });
  }

  useLayoutEffect(() => {
    if (!expanded) return;
    const body = document.body;
    const previous = body.style.overflow;
    body.style.overflow = "hidden";
    surface.current?.querySelector<HTMLButtonElement>("[data-expand-map]")?.focus({ preventScroll: true });
    return () => { body.style.overflow = previous; };
  }, [expanded]);

  return <div className={className} ref={slot}>
    <dialog ref={surface} open aria-label={label} className={styles.surface} onClose={restore}>
      <MapFrameContext.Provider value={{ expanded, toggle }}>{children}</MapFrameContext.Provider>
    </dialog>
  </div>;
}

export function MapExpandButton() {
  const frame = useContext(MapFrameContext);
  if (!frame) return null;
  const label = frame.expanded ? "Close full map" : "Explore full map";
  return <button type="button" data-expand-map className={styles.expand} aria-label={label} title={label}
    aria-expanded={frame.expanded} aria-haspopup="dialog" onClick={frame.toggle}>
    {frame.expanded ? <X size={20} /> : <Expand size={19} />}
  </button>;
}
