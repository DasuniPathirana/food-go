"use client";

import type { ARCollectibleItem } from "@food-go/domain";

/** Until a server-authorized location reward exists, never show a claim success
 * or request camera permissions for a fabricated reward. */
export function ARRewardView({ collectible, onClose }: {
  collectible: ARCollectibleItem;
  playerLocation: { longitude: number; latitude: number; accuracyMetres: number };
  onClose: () => void;
  onClaimSuccess?: (reward: { name: string; rewardXp: number }) => void;
}) {
  return <section role="dialog" aria-label="Camera rewards">
    <h2>{collectible.name}</h2>
    <p>Camera reward collection is not available yet. No XP or reward has been awarded.</p>
    <button type="button" onClick={onClose}>Close</button>
  </section>;
}
