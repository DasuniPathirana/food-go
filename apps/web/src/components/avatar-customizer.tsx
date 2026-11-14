"use client";

import { useEffect, useId, useState } from "react";
import { Check, Hand, PersonStanding, ScanEye, Sparkles, X } from "lucide-react";
import { AVATARS, useAvatarPreferences, type AvatarId } from "@/lib/avatar-preferences";
import { AvatarIllustration, ExplorerAvatar } from "./explorer-avatar";
import styles from "./avatar-customizer.module.css";

export type AvatarAction = "idle" | "wave" | "cheer" | "look";
const actions = [
  { id: "wave", label: "Wave", icon: Hand },
  { id: "cheer", label: "Celebrate", icon: Sparkles },
  { id: "look", label: "Look around", icon: ScanEye },
] as const;

/** Preview choices locally; nothing changes until the user applies a choice. */
export function AvatarCustomizer({ onClose, onAction, motionPaused = false }: {
  onClose?: () => void; onAction?: (action: AvatarAction) => void; motionPaused?: boolean;
}) {
  const { preferences, ready, persistent, chooseAvatar, setIdleMotion } = useAvatarPreferences();
  const [draft, setDraft] = useState<AvatarId>(preferences.avatarId);
  const [idle, setIdle] = useState(preferences.idleMotion);
  const [action, setAction] = useState<AvatarAction>("idle");
  const [token, setToken] = useState(0);
  const [notice, setNotice] = useState("");
  const titleId = useId();
  const selected = AVATARS.find((avatar) => avatar.id === draft)!;
  useEffect(() => { setDraft(preferences.avatarId); setIdle(preferences.idleMotion); }, [preferences.avatarId, preferences.idleMotion]);
  useEffect(() => {
    if (action === "idle") return;
    const timer = setTimeout(() => setAction("idle"), 2800);
    return () => clearTimeout(timer);
  }, [action, token]);
  function perform(next: AvatarAction) { setAction(next); setToken((value) => value + 1); onAction?.(next); }
  function apply() {
    chooseAvatar(draft); setIdleMotion(idle);
    setNotice(`${selected.label} applied. Your avatar preference stays on this browser.`);
    onClose?.();
  }
  return <section className={styles.customizer} aria-labelledby={titleId}>
    <div className={styles.heading}><div><h2 id={titleId}>Choose your explorer.</h2><p>Keep the original explorer, go 3D, or try an anime style.</p></div>{onClose && <button type="button" className={styles.close} onClick={onClose} aria-label="Close avatar options"><X size={20} /></button>}</div>
    <div className={styles.layout}>
      <div className={styles.stage}>
        <div className={styles.character}><ExplorerAvatar avatarId={draft} mode="preview" action={action} actionToken={token} animate={!motionPaused && (idle || action !== "idle")} onActivate={() => perform("wave")} /></div>
        <span className={styles.pedestal} aria-hidden="true" />
        <div className={styles.stageCopy}><strong>{selected.label}</strong><span>{selected.style === "illustrated" ? "Original illustration" : selected.style === "anime" ? "Anime inspired 3D" : "3D explorer"}</span></div>
      </div>
      <div className={styles.options}>
        <div className={styles.choices} role="group" aria-label="Avatar choices">{AVATARS.map((avatar) => <button type="button" key={avatar.id} onClick={() => { setDraft(avatar.id); setAction("idle"); setNotice(""); }} className={draft === avatar.id ? styles.selected : ""} aria-pressed={draft === avatar.id} aria-label={`Preview ${avatar.label}`}><span className={styles.thumbnail}><AvatarIllustration avatarId={avatar.id} /></span><strong>{avatar.label}</strong><span className={styles.choiceStyle}>{avatar.style === "anime" ? "Anime" : avatar.style === "3d" ? "3D" : "Original"}</span>{draft === avatar.id && <Check size={16} className={styles.check} />}</button>)}</div>
        <p className={styles.description}>{selected.description}</p>
        <div className={styles.actionGroup} role="group" aria-label="Try avatar actions">{actions.map(({ id, label, icon: Icon }) => <button type="button" key={id} onClick={() => perform(id)} disabled={motionPaused}><Icon size={17} />{label}</button>)}</div>
        <label className={styles.motion}><input type="checkbox" checked={idle} onChange={(event) => setIdle(event.target.checked)} /><span><strong>Idle animations</strong><small>Gentle breathing, blinking and looking around while standing.</small></span></label>
        <p className={styles.hint}>{motionPaused ? "Map motion is paused. Resume it to play avatar actions." : "Tap your explorer on the map to wave. Reduced motion uses a still pose."}</p>
        <div className={styles.footer}><button type="button" className={styles.apply} onClick={apply} disabled={!ready}><Check size={17} />Apply avatar</button>{onClose && <button type="button" className={styles.cancel} onClick={onClose}>Keep current avatar</button>}</div>
        <p className={styles.notice} role="status">{notice || (!persistent ? "Browser storage is unavailable. This choice lasts while the app stays open." : "Cosmetic choices only. Your XP and food discoveries stay the same.")}</p>
      </div>
    </div>
  </section>;
}

/** Compact entry on Passport, mounted preview only while the user edits. */
export function AvatarWardrobe() {
  const { preferences } = useAvatarPreferences();
  const [open, setOpen] = useState(false);
  const id = useId();
  const opener = useId();
  const avatar = AVATARS.find((item) => item.id === preferences.avatarId)!;
  function close() { setOpen(false); document.getElementById(opener)?.focus({ preventScroll: true }); }
  return <div className={styles.wardrobe}><div className={styles.wardrobeHeader}><span className={styles.currentPortrait}><AvatarIllustration avatarId={preferences.avatarId} /></span><div><h2>Your explorer</h2><p>{avatar.label} · {preferences.idleMotion ? "Idle motion on" : "Idle motion off"}</p></div><button id={opener} type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls={id}><PersonStanding size={18} />{open ? "Close options" : "Change avatar"}</button></div><div id={id}>{open && <AvatarCustomizer onClose={close} />}</div></div>;
}
