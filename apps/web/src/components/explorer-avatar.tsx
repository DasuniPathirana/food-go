"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { AVATARS, type AvatarId } from "@food-go/domain/avatar";
import type { AvatarAction } from "./explorer-avatar-scene";
import styles from "./explorer-avatar.module.css";

export type { AvatarAction } from "./explorer-avatar-scene";
type Props = {
  avatarId?: AvatarId; action?: AvatarAction; actionToken?: number; animate?: boolean;
  mode?: "map" | "preview" | "portrait"; walking?: boolean; onActivate?: () => void;
};

/** Static chooser/HUD artwork: deliberately does not create a WebGL context. */
export function AvatarIllustration({ avatarId = "explorer", className = "" }: { avatarId?: AvatarId; className?: string }) {
  const avatar = AVATARS.find((item) => item.id === avatarId) || AVATARS[0];
  const p = avatar.palette;
  const anime = avatar.style === "anime";
  if (avatar.id === "explorer") return <span className={`${styles.illustration} ${className}`} aria-hidden="true"><Image src="/images/adventure/explorer.svg" alt="" width={62} height={82} unoptimized /></span>;
  return <svg className={`${styles.illustration} ${className}`} viewBox="0 0 100 132" fill="none" aria-hidden="true">
    <ellipse cx="50" cy="123" rx="24" ry="6" fill="#20344d" opacity=".13" />
    <g className={`${styles.leftLeg} ${styles.illustrationLeftLeg}`}><path d="M37 91 35 117h13l3-26" fill={p.trousers} /><path d="M35 113q-8 3-8 9h23v-9" fill={p.shoes} stroke="#20344d" strokeWidth="1.4" /></g>
    <g className={`${styles.rightLeg} ${styles.illustrationRightLeg}`}><path d="M54 91 56 117h13l-5-28" fill={p.trousers} /><path d="M57 113v9h22q-2-7-13-9" fill={p.shoes} stroke="#20344d" strokeWidth="1.4" /></g>
    <g className={`${styles.leftArm} ${styles.illustrationLeftArm}`}><path d="M36 65q-9 5-12 23l7 3 10-20" fill={p.skin} /></g>
    <g className={`${styles.rightArm} ${styles.illustrationRightArm}`}><path d="M65 65q9 6 12 23l-8 3-10-20" fill={p.skin} /></g>
    <path d="M37 63q13-7 27 0l5 31q-18 8-37 0z" fill={p.shirt} />
    <path d="m38 64 2 22m22-22-2 22" stroke={p.accent} strokeWidth="4" />
    <rect x="43" y="80" width="15" height="8" rx="3" fill={p.accent} />
    <path d="M44 54h13v12q-7 6-13 0z" fill={p.skin} />
    <g className={`${styles.originalHead} ${styles.illustrationHead}`}>
    <ellipse cx="50" cy="36" rx="27" ry="28" fill={p.hair} />
    {avatar.id === "anime-violet" && <path d="M24 30q-9 20 2 37l12-4-2-32m28-3 1 35 11 3q9-23-1-39" fill={p.hair} />}
    <ellipse cx="50" cy="39" rx="23" ry="25" fill={p.skin} />
    <path d="M25 34q-6-28 25-28 29 0 26 27L65 21l-7 10-8-9-9 10-8-12Z" fill={p.hair} />
    {avatar.id === "anime-sky" && <path d="m27 19 2-15 10 7L48 0l7 11L68 3l2 17" fill={p.hair} />}
    {[-1, 1].map((side) => <g key={side}><ellipse cx={50 + side * 9} cy="41" rx={anime ? 5.5 : 4.5} ry={anime ? 8 : 6} fill="#fffdf8" /><ellipse cx={51 + side * 9} cy="42" rx="2.6" ry={anime ? 5.5 : 4} fill="#263c53" /><circle cx={50 + side * 9} cy="39" r="1.3" fill="#ffffff" /><path d={`M${46 + side * 9} 30q4-3 8 0`} stroke={p.hair} strokeWidth="2" strokeLinecap="round" /></g>)}
    <path d="M45 53q5 5 11-1" stroke="#74473b" strokeWidth="1.8" strokeLinecap="round" />
    <ellipse cx="35" cy="50" rx="4" ry="2" fill="#e58f7e" opacity=".65" /><ellipse cx="66" cy="50" rx="4" ry="2" fill="#e58f7e" opacity=".65" />
    {avatar.id === "foodie" && <><path d="M23 36q-3-31 28-31 28 0 27 31" stroke={p.accent} strokeWidth="5" /><rect x="21" y="32" width="8" height="16" rx="4" fill={p.accent} /><rect x="73" y="32" width="8" height="16" rx="4" fill={p.accent} /></>}
    {avatar.id === "trailblazer" && <><path d="M23 25q-1-24 27-24 29 0 28 24" fill={p.accent} /><ellipse cx="56" cy="25" rx="28" ry="5" fill={p.accent} /></>}
    {avatar.id === "anime-violet" && <path d="m67 14 12-6-2 14-10-3-10 3-2-14z" fill={p.accent} />}
    </g>
  </svg>;
}

function OriginalExplorer() {
  return <svg className={styles.original} viewBox="0 0 62 82" fill="none" aria-hidden="true">
    <ellipse cx="31" cy="76" rx="15" ry="5" fill="#416346" opacity=".2" />
    <g className={styles.leftLeg}><path d="m23 53-2 18q3 6 8 1l3-17" fill="#354e43" /><path d="m20 73-3 5h13l-1-6" fill="#faf6e3" stroke="#476349" strokeWidth="1.5" /></g>
    <g className={styles.rightLeg}><path d="m34 54 4 18q5 5 8 0l-5-22" fill="#354e43" /><path d="m37 73-1 5h13l-5-6" fill="#faf6e3" stroke="#476349" strokeWidth="1.5" /></g>
    <g className={styles.leftArm}><path d="M22 31q-7 5-8 18l6 3 4-13" fill="#c59d76" /></g>
    <g className={styles.rightArm}><path d="M40 31q7 7 10 16l-6 4-8-13" fill="#c59d76" /></g>
    <path d="M23 30q8-4 16 0l4 25q-11 6-23 0Z" fill="#cf946a" /><path d="m25 31 2 12h10l2-12" fill="#edc298" /><path d="M21 36q-7 4-6 18l9 3 1-22" fill="#e5d8b7" stroke="#ab9e7d" strokeWidth="1.3" />
    <g className={styles.originalHead}><path d="M28 21h10v12q-5 5-10 0Z" fill="#c59d76" /><ellipse cx="32" cy="19" rx="10" ry="12" fill="#dbb18a" /><path d="M21 19q-2-13 11-14 14 0 12 15l-7-6-14 6Z" fill="#334f3e" /><path d="M18 14q1-9 14-10 13 0 15 11Z" fill="#d4c9a2" /><ellipse cx="33" cy="15" rx="18" ry="4" fill="#c4b78d" /><path d="M23 10q8-3 18 0" stroke="#64785a" strokeWidth="3" /></g>
  </svg>;
}

export function ExplorerAvatar({ avatarId = "explorer", action = "idle", actionToken = 0, animate = true, mode = "map", walking = false, onActivate }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const engine = useRef<ReturnType<typeof import("./explorer-avatar-scene").createAvatarScene> | null>(null);
  const latest = useRef({ animate, action, actionToken, walking });
  const synchronise = useRef<() => void>(() => {});
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [motionAllowed, setMotionAllowed] = useState(false);
  const [reduced, setReduced] = useState(false);
  const avatar = AVATARS.find((item) => item.id === avatarId) || AVATARS[0];
  const uses3D = avatar.id !== "explorer" && mode !== "portrait";

  useEffect(() => {
    latest.current = { animate, action, actionToken, walking };
    synchronise.current();
  }, [animate, action, actionToken, walking]);

  useEffect(() => {
    const node = container.current;
    if (!node) return;
    let disposed = false, visible = false, loading = false;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReady(false); setFailed(false);
    const measure = () => {
      const bounds = node.getBoundingClientRect();
      engine.current?.resize(bounds.width, bounds.height);
    };
    const sync = () => {
      if (disposed) return;
      const foreground = document.visibilityState !== "hidden" && visible;
      const allowed = latest.current.animate && foreground && !media.matches;
      setMotionAllowed(allowed); setReduced(media.matches);
      engine.current?.setMotion({ ...latest.current, animate: allowed, reduced: media.matches });
      if (!uses3D || !foreground || loading || engine.current) return;
      loading = true;
      import("./explorer-avatar-scene").then(({ createAvatarScene }) => {
        if (disposed || !canvas.current) return;
        engine.current = createAvatarScene(canvas.current, avatar.id, () => { if (!disposed) { setReady(false); setFailed(true); } });
        measure(); engine.current.setMotion({ ...latest.current, animate: latest.current.animate && visible && document.visibilityState !== "hidden" && !media.matches, reduced: media.matches });
        if (!disposed) setReady(true);
      }).catch(() => { if (!disposed) { setReady(false); setFailed(true); } });
    };
    synchronise.current = sync;
    const observer = new IntersectionObserver(([entry]) => { visible = Boolean(entry?.isIntersecting); sync(); });
    observer.observe(node);
    const resize = new ResizeObserver(measure); resize.observe(node);
    media.addEventListener("change", sync); document.addEventListener("visibilitychange", sync);
    sync();
    return () => {
      disposed = true; synchronise.current = () => {}; observer.disconnect(); resize.disconnect();
      media.removeEventListener("change", sync); document.removeEventListener("visibilitychange", sync);
      engine.current?.dispose(); engine.current = null;
    };
  }, [avatar.id, mode, uses3D]);

  const art = <div ref={container} className={`${styles.avatar} ${styles[mode]} ${motionAllowed ? styles.moving : ""} ${walking ? styles.walking : ""} ${reduced ? styles.reduced : ""}`} data-avatar={avatar.id} data-renderer={uses3D ? ready && !failed ? "3d" : "illustration" : "illustration"} data-action={action}>
    {uses3D && <canvas ref={canvas} className={`${styles.canvas} ${ready && !failed ? styles.canvasReady : ""}`} aria-hidden="true" />}
    <span key={`${avatar.id}-${action}-${actionToken}`} className={`${styles.artwork} ${uses3D && ready && !failed ? styles.artworkHidden : ""}`} aria-hidden="true">{avatar.id === "explorer" && mode !== "portrait" ? <OriginalExplorer /> : <AvatarIllustration avatarId={avatar.id} />}</span>
    {failed && <span className={styles.srOnly}>3D is unavailable. Showing the illustrated avatar.</span>}
  </div>;
  return onActivate ? <button type="button" className={styles.trigger} onClick={onActivate} aria-label={`Interact with ${avatar.label} avatar`}>{art}</button> : <div className={styles.presentation} role="img" aria-label={`${avatar.label} avatar`}>{art}</div>;
}
