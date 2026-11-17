"use client";

import type { AvatarId } from "@/lib/avatar-preferences";
import { ExplorerAvatar, type AvatarAction } from "./explorer-avatar";
import styles from "./map-player.module.css";

export function MapPlayer({ avatarId, walking = false, action = "idle", actionToken = 0, animate = true, heading, mapBearing, distanceMetres, distanceTransitionMs, onActivate }: {
  avatarId?: AvatarId; walking?: boolean; action?: AvatarAction; actionToken?: number; animate?: boolean;
  heading?: number; mapBearing?: number; distanceMetres?: number; distanceTransitionMs?: number; onActivate?: () => void;
}) {
  return <div className={styles.player} data-walking={walking} data-animate={animate} data-heading={heading == null ? undefined : Math.round(heading)}>
    <span className={styles.radar} aria-hidden="true" />
    <span className={styles.shadow} aria-hidden="true" />
    <div className={styles.avatar}><ExplorerAvatar avatarId={avatarId} walking={walking} action={action}
      actionToken={actionToken} animate={animate} heading={heading} mapBearing={mapBearing} distanceMetres={distanceMetres} distanceTransitionMs={distanceTransitionMs} mode="map" onActivate={onActivate}/></div>
    <span className={styles.label}>Your explorer</span>
  </div>;
}
