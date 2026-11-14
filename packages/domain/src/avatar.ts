import { z } from "zod";

/** Cosmetic browser preferences. They never identify a person or award game progress. */
export const AVATAR_PREFERENCES_KEY = "food-go:avatar:v1";
export const AVATAR_FALLBACK_IMAGE = "/images/adventure/explorer.svg";
const colour = z.string().regex(/^#[0-9a-f]{6}$/iu);
export const avatarPaletteSchema = z.strictObject({
  skin: colour, hair: colour, shirt: colour, trousers: colour, shoes: colour, accent: colour,
});
export const avatarMetadataSchema = z.strictObject({
  id: z.enum(["explorer", "foodie", "trailblazer", "anime-sky", "anime-violet"]),
  label: z.string().min(1).max(32), description: z.string().min(1).max(160),
  style: z.enum(["illustrated", "3d", "anime"]), fallbackImage: z.literal(AVATAR_FALLBACK_IMAGE), palette: avatarPaletteSchema,
});

export const AVATARS = [
  { id: "explorer", label: "Original explorer", description: "The familiar illustrated explorer from the Food Go neighbourhood.", style: "illustrated", fallbackImage: AVATAR_FALLBACK_IMAGE,
    palette: { skin: "#d6aa7b", hair: "#6b7652", shirt: "#c98d66", trousers: "#59694b", shoes: "#34483e", accent: "#f1d295" } },
  { id: "foodie", label: "Foodie", description: "A playful 3D explorer with a coral outfit and a bright appetite for discovery.", style: "3d", fallbackImage: AVATAR_FALLBACK_IMAGE,
    palette: { skin: "#e7b890", hair: "#513d35", shirt: "#ff7b5c", trousers: "#304d67", shoes: "#fff4dc", accent: "#ffc642" } },
  { id: "trailblazer", label: "Trailblazer", description: "A cheerful 3D adventurer in teal, ready for the next food trail.", style: "3d", fallbackImage: AVATAR_FALLBACK_IMAGE,
    palette: { skin: "#9e6347", hair: "#2e2930", shirt: "#28bdb0", trousers: "#3e5863", shoes: "#f8e9cd", accent: "#ffc642" } },
  { id: "anime-sky", label: "Sky", description: "An anime inspired 3D explorer with sky blue hair and a bold blue outfit.", style: "anime", fallbackImage: AVATAR_FALLBACK_IMAGE,
    palette: { skin: "#f0c9a9", hair: "#75c8ed", shirt: "#4388de", trousers: "#293e68", shoes: "#fff2de", accent: "#ffc642" } },
  { id: "anime-violet", label: "Violet", description: "An anime inspired 3D explorer with violet hair and a colourful adventure outfit.", style: "anime", fallbackImage: AVATAR_FALLBACK_IMAGE,
    palette: { skin: "#c58b6b", hair: "#925fd6", shirt: "#b782ed", trousers: "#414161", shoes: "#fff2e4", accent: "#ffab77" } },
] as const satisfies readonly z.infer<typeof avatarMetadataSchema>[];

export type AvatarId = typeof AVATARS[number]["id"];
export const avatarPreferencesSchema = z.strictObject({
  version: z.literal(1), avatarId: z.enum(["explorer", "foodie", "trailblazer", "anime-sky", "anime-violet"]), idleMotion: z.boolean(),
});
export type AvatarPreferences = z.infer<typeof avatarPreferencesSchema>;
export function isAvatarId(value: unknown): value is AvatarId {
  return typeof value === "string" && AVATARS.some((avatar) => avatar.id === value);
}
export function createAvatarPreferences(): AvatarPreferences {
  return { version: 1, avatarId: "explorer", idleMotion: true };
}
/** Unknown IDs, schema versions and malformed stores restore the original explorer. */
export function parseAvatarPreferences(value: unknown): AvatarPreferences {
  const result = avatarPreferencesSchema.safeParse(value);
  return result.success ? result.data : createAvatarPreferences();
}
