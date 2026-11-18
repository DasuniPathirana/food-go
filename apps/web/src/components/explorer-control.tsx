"use client";

import { useEffect, useId, useRef } from "react";
import type { AvatarId } from "@/lib/avatar-preferences";
import { AvatarIllustration } from "./explorer-avatar";
import styles from "./explorer-control.module.css";

export const EXPLORER_HOLD_MS = 520;
const dragThreshold = 8;

/** One location entry. The portrait never allocates another graphics context. */
export function ExplorerControl({ avatarId, live, requesting, following, expanded, onLocate, onCustomise }: {
  avatarId: AvatarId; live: boolean; requesting: boolean; following: boolean; expanded: boolean;
  onLocate: () => void; onCustomise: () => void;
}) {
  const description = useId();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gesture = useRef<{ id: number; x: number; y: number; cancelled: boolean; held: boolean } | null>(null);
  const suppressClick = useRef(false);
  const customise = useRef(onCustomise);
  customise.current = onCustomise;
  function clearTimer() { if (timer.current !== null) clearTimeout(timer.current); timer.current = null; }
  useEffect(() => {
    const cancel = () => { clearTimer(); if (gesture.current) gesture.current.cancelled = true; };
    window.addEventListener("blur", cancel);
    document.addEventListener("visibilitychange", cancel);
    return () => { clearTimer(); window.removeEventListener("blur", cancel); document.removeEventListener("visibilitychange", cancel); };
  }, []);
  return <div className={styles.control}>
    <button type="button" data-explorer-control data-avatar={avatarId} className={styles.portrait} aria-label="Locate explorer"
      title="Locate explorer. Hold to customise." aria-describedby={description} aria-expanded={expanded}
      aria-keyshortcuts="Shift+Enter" aria-busy={requesting} data-live={live} data-following={following}
      onPointerDown={event => {
        if (!event.isPrimary || event.button !== 0 || gesture.current) {
          clearTimer(); if (gesture.current) gesture.current.cancelled = true; return;
        }
        suppressClick.current = false;
        gesture.current = { id: event.pointerId, x: event.clientX, y: event.clientY, cancelled: false, held: false };
        event.currentTarget.setPointerCapture(event.pointerId);
        timer.current = setTimeout(() => {
          timer.current = null;
          const press = gesture.current;
          if (!press || press.cancelled) return;
          press.held = true; suppressClick.current = true; customise.current();
        }, EXPLORER_HOLD_MS);
      }}
      onPointerMove={event => {
        const press = gesture.current;
        if (!press || press.id !== event.pointerId) return;
        if (Math.hypot(event.clientX - press.x, event.clientY - press.y) > dragThreshold) {
          press.cancelled = true; suppressClick.current = true; clearTimer();
        }
      }}
      onPointerUp={event => {
        if (gesture.current?.id !== event.pointerId) return;
        clearTimer(); suppressClick.current = gesture.current.cancelled || gesture.current.held; gesture.current = null;
      }}
      onPointerCancel={() => { clearTimer(); gesture.current = null; suppressClick.current = true; }}
      onLostPointerCapture={() => { clearTimer(); if (gesture.current) suppressClick.current = true; gesture.current = null; }}
      onContextMenu={event => { event.preventDefault(); clearTimer(); suppressClick.current = true; if (gesture.current) gesture.current.held = true; onCustomise(); }}
      onKeyDown={event => {
        // A keyboard click is independent of a previously cancelled pointer.
        if (event.key === "Enter" || event.key === " ") suppressClick.current = false;
        if ((event.shiftKey && event.key === "Enter") || (event.shiftKey && event.key === "F10")) {
          event.preventDefault(); clearTimer(); onCustomise();
        }
      }}
      onClick={() => { if (suppressClick.current) { suppressClick.current = false; return; } onLocate(); }}>
      <span className={styles.art}><AvatarIllustration avatarId={avatarId}/></span>
      <span className={styles.signal} aria-hidden="true"/>
    </button>
    <span className={styles.caption} aria-hidden="true">{requesting ? "Locating" : live ? "Live" : "Explorer"}</span>
    <span id={description} className={styles.srOnly}>Tap to enable location and follow your explorer. Hold to customise, or press Shift and Enter. Dragging cancels the press.</span>
  </div>;
}
