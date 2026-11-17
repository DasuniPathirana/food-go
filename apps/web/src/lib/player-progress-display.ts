import { xpForLevel } from "./adventure-rules";
import type { GameProfile } from "./game-profile";

const labels = { visits: "verified places", cuisines: "cuisines", quests: "completed quests", questCategories: "quest categories",
  posts: "approved stories", harvests: "harvests", buildings: "village buildings" } as const;

export function playerProgressDisplay(profile: Pick<GameProfile,"xp" | "level" | "nextLevelXp" | "achievements" | "nextRequirements">) {
  const complete = profile.level === 250;
  const floor = xpForLevel(profile.level), span = Math.max(1, profile.nextLevelXp - floor);
  const missing = profile.achievements && profile.nextRequirements ? Object.entries(profile.nextRequirements).flatMap(([key, amount]) => {
    const name = key as keyof typeof labels, left = Math.max(0, amount - profile.achievements![name]);
    return left ? [`${left} more ${labels[name]}`] : [];
  }) : [];
  const remaining = Math.max(0, profile.nextLevelXp - profile.xp);
  return { complete, value: complete ? 1 : Math.min(span, Math.max(0, profile.xp - floor)), maximum: complete ? 1 : span, missing,
    text: complete ? "Level 250. Legendary." : remaining === 0 && missing.length ? "XP target reached. Your next milestones await."
      : `${remaining.toLocaleString("en-AU")} XP to level ${profile.level + 1}` };
}
