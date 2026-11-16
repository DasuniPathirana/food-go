"use client";

import type { AvatarId } from "@/lib/avatar-preferences";
import { ExplorerAvatar, type AvatarAction } from "./explorer-avatar";
import styles from "./map-player.module.css";

export function MapPlayer({ avatarId, walking = false, action = "idle", actionToken = 0, animate = true, onActivate }: {
  avatarId?: AvatarId; walking?: boolean; action?: AvatarAction; actionToken?: number; animate?: boolean; onActivate?: () => void;
}) {
  return <div className={styles.player} data-walking={walking} data-animate={animate}>
    <span className={styles.radar} aria-hidden="true" />
    <span className={styles.shadow} aria-hidden="true" />
    <div className={styles.avatar}><ExplorerAvatar avatarId={avatarId} walking={walking} action={action}
      actionToken={actionToken} animate={animate} mode="map" onActivate={onActivate}/></div>
    <span className={styles.label}>Your explorer</span>
  </div>;
}
