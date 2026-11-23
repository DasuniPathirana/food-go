import { z } from "zod";
import { avatarMetadataSchema, type AvatarId } from "@food-go/domain/avatar";

export const AVATAR_ANIMATION_STATES = ["idle", "walk", "jog", "turnLeft", "turnRight", "stop", "interact", "celebrate", "discover"] as const;
export type AvatarAnimationState = typeof AVATAR_ANIMATION_STATES[number];
export const MAX_AVATAR_ASSET_BYTES = 12 * 1024 * 1024;
export const AVATAR_MODEL_LIMITS = { triangles: 25_000, bones: 65, materials: 4, textures: 8, textureEdge: 2048, nodes: 500 } as const;

const localAssetPath = (extension: string) => z.string().max(180)
  .regex(new RegExp(`^/models/avatars/[a-z0-9][a-z0-9/_-]*\\.${extension}$`, "u"))
  .refine(value => !value.includes("//"), "Use a canonical local asset path.");
const clip = z.string().trim().min(1).max(80);

/** A reviewed manifest is an admission record, not evidence that art was made.
 * Every model is an embedded GLB, shipped with its redistribution notice.
 */
export const avatarAssetManifestSchema = z.strictObject({
  version: z.literal(1), avatarId: avatarMetadataSchema.shape.id,
  path: localAssetPath("glb"), byteLength: z.int().min(20).max(MAX_AVATAR_ASSET_BYTES),
  sha256: z.string().regex(/^[a-f0-9]{64}$/u),
  licence: z.strictObject({
    name: z.string().trim().min(1).max(120), author: z.string().trim().min(1).max(120),
    sourceUrl: z.url().max(500).refine(value => { const url = new URL(value); return url.protocol === "https:" && !url.username && !url.password; }),
    noticePath: localAssetPath("(?:txt|md)"), commercialUse: z.literal(true), redistribution: z.literal(true), attributionRequired: z.boolean(),
  }),
  metrics: z.strictObject({
    heightMetres: z.number().min(1.2).max(2.4), eyeHeightMetres: z.number().min(1).max(2.2),
    walkCycleMetres: z.number().min(.4).max(3), jogCycleMetres: z.number().min(.6).max(4),
    forwardAxis: z.enum(["+z", "-z"]), units: z.literal("metres"), rootMotion: z.literal("in-place"),
  }).refine(value => value.eyeHeightMetres < value.heightMetres, "Eyes must be below the top of the character."),
  clips: z.strictObject({ idle: clip, walk: clip, jog: clip, turnLeft: clip, turnRight: clip, stop: clip, interact: clip, celebrate: clip, discover: clip })
    .refine(value => new Set(Object.values(value)).size === AVATAR_ANIMATION_STATES.length, "Each state needs a distinct authored clip."),
});
export type AvatarAssetManifest = z.infer<typeof avatarAssetManifestSchema>;

export function parseAvatarAssetManifest(value: unknown): AvatarAssetManifest | null {
  const result = avatarAssetManifestSchema.safeParse(value);
  return result.success ? result.data : null;
}

/** Embedded approved 3D rigged character catalog. */
export const AVATAR_ASSET_CATALOGUE: Readonly<Partial<Record<AvatarId, AvatarAssetManifest>>> = Object.freeze({
  explorer: {
    version: 1,
    avatarId: "explorer",
    path: "/models/avatars/pathfinder.glb",
    byteLength: 10011160,
    sha256: "a11b05ea865f9cf87487fec0f531f0775a3f8fa3bbce4d9775e5ae1438ad59b2",
    licence: {
      name: "CC0 1.0 Universal",
      author: "Quaternius / Food Go",
      sourceUrl: "https://quaternius.com",
      noticePath: "/models/avatars/notice.txt",
      commercialUse: true,
      redistribution: true,
      attributionRequired: false,
    },
    metrics: {
      heightMetres: 1.78,
      eyeHeightMetres: 1.65,
      walkCycleMetres: 0.9,
      jogCycleMetres: 1.44,
      forwardAxis: "+z",
      units: "metres",
      rootMotion: "in-place",
    },
    clips: {
      idle: "idle",
      walk: "walk",
      jog: "jog",
      turnLeft: "turnLeft",
      turnRight: "turnRight",
      stop: "stop",
      interact: "interact",
      celebrate: "celebrate",
      discover: "discover",
    },
  },
});

/** Maps existing gestures to an asset's explicit clip mapping; no XP or identity. */
export function avatarAnimationForMotion(input: { walking: boolean; action: "idle" | "wave" | "cheer" | "look" }): AvatarAnimationState {
  if (input.action === "wave") return "interact";
  if (input.action === "cheer") return "celebrate";
  if (input.action === "look") return "discover";
  return input.walking ? "walk" : "idle";
}
