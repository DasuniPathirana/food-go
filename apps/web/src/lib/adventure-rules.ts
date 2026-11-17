import type { z } from "zod";
import type { achievementSchema } from "./adventure-contracts";

export type AdventureAchievements = z.infer<typeof achievementSchema>;
export const questRewards = { explore: 50, try: 100, feedback: 75, community: 75, promo: 50 } as const;
export const questDailyXpCap = 300;
export const clearCost = { wood: 10, coins: 10 } as const;
export const maximumStructureLevel = 3;
export function upgradeRules(currentLevel: number) {
  return { wood: 20 * currentLevel, stone: 15 * currentLevel, coins: 20 * currentLevel, seconds: 60 * currentLevel };
}
export const structureRules = {
  garden: { wood: 15, stone: 5, coins: 10, seconds: 30 },
  shed: { wood: 30, stone: 20, coins: 20, seconds: 45 },
  tank: { wood: 25, stone: 20, coins: 15, seconds: 60 },
  bakery: { wood: 70, stone: 50, coins: 80, seconds: 120 },
} as const;
export const cropRules = {
  carrot: { water: 4, seeds: 1, seconds: 45, coins: 12 },
  wheat: { water: 3, seeds: 1, seconds: 60, coins: 10 },
  tomato: { water: 5, seeds: 1, seconds: 90, coins: 18 },
} as const;
export function xpForLevel(level: number) {
  if (!Number.isInteger(level) || level < 1 || level > 250) throw new RangeError("Level must be between 1 and 250.");
  let total = 0;
  for (let next = 2; next <= level; next++) total += next <= 50 ? 250 + (next - 2) * 20
    : next <= 100 ? 1500 + (next - 51) * 70 : 8000 + (next - 101) * 350 + (next - 101) ** 2 * 15;
  return total;
}
export function levelRequirements(level: number): AdventureAchievements {
  if (!Number.isInteger(level) || level < 1 || level > 250) throw new RangeError("Level must be between 1 and 250.");
  if (level <= 100) return { visits: 0, cuisines: 0, quests: 0, questCategories: 0, posts: 0, harvests: 0, buildings: 0 };
  const step = level - 101;
  return { visits: 5 + Math.floor(step / 25) * 5, cuisines: 3 + Math.floor(step / 50), quests: 3 + Math.floor(step / 10),
    questCategories: Math.min(5, 2 + Math.floor(step / 50)), posts: 1 + Math.floor(step / 50),
    harvests: 1 + Math.floor(step / 25), buildings: Math.min(6, 1 + Math.floor(step / 50)) };
}
export function levelFromAchievements(xp: number, achievements: AdventureAchievements) {
  if (!Number.isSafeInteger(xp) || xp < 0 || Object.values(achievements).some(value => !Number.isSafeInteger(value) || value < 0))
    throw new RangeError("Progress must be non-negative whole numbers.");
  let level = 1, xpLevel = 1;
  for (let next = 2; next <= 250 && xp >= xpForLevel(next); next++) {
    xpLevel = next;
    const required = levelRequirements(next);
    if (Object.entries(required).every(([key, value]) => achievements[key as keyof AdventureAchievements] >= value)) level = next;
  }
  return { level, xpLevel, nextLevelXp: xpForLevel(Math.min(250, level + 1)), nextRequirements: levelRequirements(Math.min(250, level + 1)),
    tier: level === 250 ? "legendary" : level > 200 ? "golden" : level > 150 ? "mighty" : level > 100 ? "advanced" : level > 50 ? "community" : "foundation" };
}
