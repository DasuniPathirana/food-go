"use client";

import type { ComponentProps } from "react";
import { ExplorerAvatar } from "./explorer-avatar";
import type { MapPlayer } from "./map-player";
import styles from "./close-map-player.module.css";

export type CloseMapPlayerProps = Omit<ComponentProps<typeof MapPlayer>, "onActivate"> & {
  className?: string;
};

/** A non-interactive, cropped view of the same explorer used by the world marker. */
export function CloseMapPlayer({ avatarId, walking = false, action = "idle", actionToken = 0,
  animate = true, heading, mapBearing, distanceMetres, distanceTransitionMs, className = "",
}: CloseMapPlayerProps) {
  // With no travel bearing yet, look forward with the map instead of facing the
  // viewer. Once travel starts, the existing rig follows its geographic heading.
  const forward = Number.isFinite(heading) ? heading : Number.isFinite(mapBearing) ? mapBearing : 0;
  return <div className={`${styles.player} ${className}`} data-close-player data-walking={walking} data-animate={animate}>
    <div className={styles.character}>
      <ExplorerAvatar avatarId={avatarId} mode="map" walking={walking} action={action} actionToken={actionToken}
        animate={animate} heading={forward} mapBearing={mapBearing} distanceMetres={distanceMetres}
        distanceTransitionMs={distanceTransitionMs} />
    </div>
  </div>;
}
