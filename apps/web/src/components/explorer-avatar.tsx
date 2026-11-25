"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { AVATARS, type AvatarId } from "@food-go/domain/avatar";
import { AVATAR_ASSET_CATALOGUE } from "@/lib/avatar-assets";
import type { AvatarAction } from "./explorer-avatar-scene";
import styles from "./explorer-avatar.module.css";

export type { AvatarAction } from "./explorer-avatar-scene";
type Props = {
  avatarId?: AvatarId; action?: AvatarAction; actionToken?: number; animate?: boolean;
  mode?: "map" | "preview" | "portrait"; walking?: boolean; onActivate?: () => void;
  heading?: number; mapBearing?: number; distanceMetres?: number; distanceTransitionMs?: number;
};

/** Static chooser/HUD artwork: deliberately does not create a WebGL context. */
export function AvatarIllustration({ avatarId = "explorer", className = "" }: { avatarId?: AvatarId; className?: string }) {
  const avatar = AVATARS.find((item) => item.id === avatarId) || AVATARS[0];
  const p = avatar.palette;
  const anime = avatar.style === "anime";
  if (avatar.id === "explorer") return <span className={`${styles.illustration} ${className}`} aria-hidden="true"><Image src="/images/adventure/explorer.svg" alt="" width={62} height={82} unoptimized /></span>;
  return <svg className={`${styles.illustration} ${className}`} viewBox="0 0 100 150" fill="none" aria-hidden="true">
    <ellipse cx="50" cy="142" rx="24" ry="5" fill="#20344d" opacity=".13" />
    <rect x="27" y="60" width="46" height="35" rx="9" fill={p.accent} />
    <g className={`${styles.leftLeg} ${styles.illustrationLeftLeg}`}><path d="m37 88-1 46h12l4-46" fill={p.trousers} /><path d="m40 98-1 26" stroke="#ffffff" strokeOpacity=".18" strokeWidth="2" /><path d="M35 129h13l1 11H28q0-7 7-11" fill={p.shoes} /><path d="M28 139h21v4H28z" fill="#23394a" /><path d="M35 131h12v3H35z" fill={p.accent} /></g>
    <g className={`${styles.rightLeg} ${styles.illustrationRightLeg}`}><path d="m52 88 2 46h12l-2-46" fill={p.trousers} /><path d="m59 98 2 26" stroke="#ffffff" strokeOpacity=".18" strokeWidth="2" /><path d="M54 129h13q7 4 7 11H53z" fill={p.shoes} /><path d="M53 139h21v4H53z" fill="#23394a" /><path d="M55 131h12v3H55z" fill={p.accent} /></g>
    <g className={`${styles.leftArm} ${styles.illustrationLeftArm}`}><path d="M34 59q-8 2-10 13l-4 23q1 7 7 4l9-30" fill={avatar.id === "foodie" ? p.skin : p.shirt} /><path d="M34 59q-9 1-11 15l10 3 6-13" fill={p.shirt} /><path d="m23 74 10 3" stroke={p.accent} strokeWidth="3" /><path d="m21 93 7 2" stroke={p.trousers} strokeWidth="3" /><ellipse cx="23" cy="100" rx="4" ry="5.5" fill={p.skin} /></g>
    <g className={`${styles.rightArm} ${styles.illustrationRightArm}`}><path d="M66 59q8 2 10 13l4 23q-1 7-7 4l-9-30" fill={avatar.id === "foodie" ? p.skin : p.shirt} /><path d="M66 59q9 1 11 15l-10 3-6-13" fill={p.shirt} /><path d="m67 77 10-3" stroke={p.accent} strokeWidth="3" /><path d="m72 95 7-2" stroke={p.trousers} strokeWidth="3" /><ellipse cx="77" cy="100" rx="4" ry="5.5" fill={p.skin} /></g>
    <path d="M44 48h12v14H44z" fill={p.skin} />
    <path d="M34 59q15-7 32 0l2 32q-18 5-36 0z" fill={p.shirt} />
    <path d="m44 57 6 7 6-7-1 28H45z" fill="#fff6e5" />
    <path d="m35 61 4 25m26-25-4 25" stroke={p.trousers} strokeWidth="3" />
    <path d="m41 78 6 1m7 0 6-1" stroke={p.accent} strokeWidth="2.5" strokeLinecap="round" />
    <rect x="33" y="88" width="34" height="4" rx="1" fill={p.trousers} /><rect x="47" y="88" width="6" height="4" rx="1" fill={p.accent} />
    <rect x="38" y="66" width="5" height="6" rx="1" fill="#fff6e5" />
    {anime && <path d="M41 54q9 5 17 0l1 6-7 2 5 14-6 2-6-17-5-2z" fill={p.accent} />}
    <g className={`${styles.originalHead} ${styles.illustrationHead}`}>
    <ellipse cx="50" cy="29" rx="19" ry="23" fill={p.hair} />
    {avatar.id === "anime-violet" && <path d="M32 23q-6 16 0 30l8-3-2-23m24-1-1 24 7 4q7-16 0-31" fill={p.hair} />}
    <ellipse cx="33" cy="32" rx="3.5" ry="5" fill={p.skin} /><ellipse cx="67" cy="32" rx="3.5" ry="5" fill={p.skin} />
    <ellipse cx="50" cy="31" rx="16.5" ry="21" fill={p.skin} />
    <path d="M32 27q-3-22 18-22 22 0 19 22l-8-10-4 9-8-10-6 9-7-9z" fill={p.hair} />
    {avatar.id === "anime-sky" && <path d="m33 15-1-12 10 6 8-9 6 10 11-6-1 15" fill={p.hair} />}
    {[-1, 1].map((side) => <g key={side}><ellipse cx={50 + side * 6.5} cy="32" rx={anime ? 4 : 3.2} ry={anime ? 5.5 : 4.2} fill="#fffdf8" /><ellipse cx={50.5 + side * 6.5} cy="32.5" rx="2" ry={anime ? 4 : 3} fill={anime ? "#395b88" : "#35585a"} /><circle cx={50 + side * 6.5} cy="31" r=".9" fill="#ffffff" /><path d={`M${47 + side * 6.5} 24q3-2 6 0`} stroke={p.hair} strokeWidth="1.5" strokeLinecap="round" /></g>)}
    <path d="m50 35-1 3h2m-5 4q4 4 8-1" stroke="#925d4e" strokeWidth="1.2" strokeLinecap="round" />
    <ellipse cx="39" cy="39" rx="3" ry="1.5" fill="#df9987" opacity=".65" /><ellipse cx="61" cy="39" rx="3" ry="1.5" fill="#df9987" opacity=".65" />
    {avatar.id === "foodie" && <><path d="M30 29q-2-24 20-24 22 0 21 24" stroke={p.accent} strokeWidth="3.5" /><rect x="28" y="26" width="6" height="12" rx="2.5" fill={p.accent} /><rect x="66" y="26" width="6" height="12" rx="2.5" fill={p.accent} /></>}
    {avatar.id === "trailblazer" && <><path d="M31 20q-1-17 19-17 21 0 20 17" fill={p.accent} /><ellipse cx="55" cy="20" rx="22" ry="3.5" fill={p.accent} /><rect x="46" y="9" width="8" height="7" rx="2" fill="#fff2d5" /></>}
    {avatar.id === "anime-violet" && <path d="m62 13 8-4-1 9-7-2-6 2-1-9z" fill={p.accent} />}
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

export function ExplorerAvatar({ avatarId = "explorer", action = "idle", actionToken = 0, animate = true, mode = "map", walking = false, heading, mapBearing, distanceMetres, distanceTransitionMs, onActivate }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const engine = useRef<ReturnType<typeof import("./explorer-avatar-scene").createAvatarScene> | null>(null);
  const latest = useRef({ animate, action, actionToken, walking, heading, mapBearing, distanceMetres, distanceTransitionMs });
  const synchronise = useRef<() => void>(() => {});
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [assetLoaded, setAssetLoaded] = useState(false);
  const [motionAllowed, setMotionAllowed] = useState(false);
  const [reduced, setReduced] = useState(false);
  const avatar = AVATARS.find((item) => item.id === avatarId) || AVATARS[0];
  const uses3D = Boolean((avatar.id in AVATAR_ASSET_CATALOGUE || avatar.id !== "explorer") && mode !== "portrait");

  useEffect(() => {
    latest.current = { animate, action, actionToken, walking, heading, mapBearing, distanceMetres, distanceTransitionMs };
    synchronise.current();
  }, [animate, action, actionToken, walking, heading, mapBearing, distanceMetres, distanceTransitionMs]);

  useEffect(() => {
    const node = container.current;
    if (!node) return;
    let disposed = false, visible = false, loading = false;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReady(false); setFailed(false); setAssetLoaded(false);
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
        engine.current = createAvatarScene(canvas.current, avatar.id, () => { if (!disposed) { setReady(false); setFailed(true); } }, loaded => { if (!disposed) setAssetLoaded(loaded); });
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

  const facingLeft = Number.isFinite(heading) && Math.sin((heading! - (mapBearing || 0)) * Math.PI / 180) < -0.2;
  const art = <div ref={container} className={`${styles.avatar} ${styles[mode]} ${motionAllowed ? styles.moving : ""} ${walking ? styles.walking : ""} ${reduced ? styles.reduced : ""}`} data-avatar={avatar.id} data-renderer={uses3D ? ready && !failed ? "3d" : "illustration" : "illustration"} data-asset={uses3D && ready && !failed ? assetLoaded ? "glb" : "procedural" : "illustration"} data-action={action} style={{ "--avatar-direction": facingLeft ? -1 : 1 } as CSSProperties}>
    {uses3D && <canvas ref={canvas} className={`${styles.canvas} ${ready && !failed ? styles.canvasReady : ""}`} aria-hidden="true" />}
    <span key={`${avatar.id}-${action}-${actionToken}`} className={`${styles.artwork} ${uses3D && ready && !failed ? styles.artworkHidden : ""}`} aria-hidden="true">{avatar.id === "explorer" && mode !== "portrait" ? <OriginalExplorer /> : <AvatarIllustration avatarId={avatar.id} />}</span>
    {failed && <span className={styles.srOnly}>3D is unavailable. Showing the illustrated avatar.</span>}
  </div>;
  return onActivate ? <button type="button" className={styles.trigger} onClick={onActivate} aria-label={`Interact with ${avatar.label} avatar`}>{art}</button> : <div className={styles.presentation} role="img" aria-label={`${avatar.label} avatar`}>{art}</div>;
}
