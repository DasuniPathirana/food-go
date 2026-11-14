import { z } from "zod";

const body = (maximum: number) => z.string().trim().min(1).max(maximum)
  .refine(value => !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value), "Use ordinary text.");
export const communityAuthorSchema = z.object({ id: z.uuid(), name: z.string().min(1).max(80) });
export const communityCommentSchema = z.object({
  id: z.uuid(), author: communityAuthorSchema, body: body(1000), createdAt: z.iso.datetime({ offset: true }),
  status: z.enum(["published", "pending"]),
});
export const communityPostSchema = z.object({
  id: z.uuid(), author: communityAuthorSchema, body: body(2000), createdAt: z.iso.datetime({ offset: true }),
  visibility: z.enum(["public", "private"]), status: z.enum(["published", "pending", "private"]),
  likeCount: z.number().int().min(0), commentCount: z.number().int().min(0), shareCount: z.number().int().min(0),
  reachCount: z.number().int().min(0).optional(),
  liked: z.boolean(), shared: z.boolean(), comments: z.array(communityCommentSchema).max(20),
  commentsNextCursor: z.string().max(200).nullable(), sharedBy: communityAuthorSchema.optional(),
});
export const communityFeedSchema = z.object({
  status: z.enum(["ready", "unavailable", "disabled"]), posts: z.array(communityPostSchema).max(20),
  viewer: communityAuthorSchema.nullable(), nextCursor: z.string().max(200).nullable(),
  wallOwner: communityAuthorSchema.nullable().optional(),
});
export type CommunityAuthor = z.infer<typeof communityAuthorSchema>;
export type CommunityComment = z.infer<typeof communityCommentSchema>;
export type CommunityPost = z.infer<typeof communityPostSchema>;
export type CommunityFeed = z.infer<typeof communityFeedSchema>;
export const communityWriteSchema = z.discriminatedUnion("action", [
  z.strictObject({ action: z.literal("create"), body: body(2000), visibility: z.enum(["public", "private"]), requestId: z.uuid() }),
  z.strictObject({ action: z.literal("comment"), postId: z.uuid(), body: body(1000), requestId: z.uuid() }),
  z.strictObject({ action: z.literal("like"), postId: z.uuid(), liked: z.boolean() }),
  z.strictObject({ action: z.literal("view"), postId: z.uuid() }),
  z.strictObject({ action: z.literal("share"), postId: z.uuid(), shared: z.boolean().optional() }),
  z.strictObject({ action: z.literal("delete"), postId: z.uuid() }),
  z.strictObject({ action: z.literal("report"), postId: z.uuid(), reason: z.enum(["spam", "abuse", "other"]) }),
  z.strictObject({ action: z.literal("block"), authorId: z.uuid() }),
]);
export type CommunityWrite = z.infer<typeof communityWriteSchema>;
export const communityWriteResultSchema = z.object({ ok: z.literal(true), id: z.uuid().optional(), status: z.enum(["pending", "private"]).optional(), reachCount: z.number().int().nonnegative().optional() });
export type CommunityWriteResult = z.infer<typeof communityWriteResultSchema>;
export type CommunityQuery = { wall: "public" | "me" | string; post?: string; cursor?: string; commentsCursor?: string };

/** Cursors are database timestamp+UUID tuples. No offset scanning or unbounded result request. */
export function parseCommunityQuery(url: URL): CommunityQuery | null {
  const allowed = new Set(["wall", "post", "cursor", "commentsCursor"]);
  if (url.search.length > 1024 || [...url.searchParams.keys()].some(key => !allowed.has(key) || url.searchParams.getAll(key).length !== 1)) return null;
  const wall = url.searchParams.get("wall") || "public";
  const post = url.searchParams.get("post") || undefined;
  const cursor = url.searchParams.get("cursor") || undefined;
  const commentsCursor = url.searchParams.get("commentsCursor") || undefined;
  if (!["public", "me"].includes(wall) && !z.uuid().safeParse(wall).success) return null;
  if (post && !z.uuid().safeParse(post).success) return null;
  const validCursor = (value: string | undefined) => !value || (value.length <= 200 && /^[0-9T:.+Z -]+\|[0-9a-f-]{36}$/iu.test(value));
  if (!validCursor(cursor) || !validCursor(commentsCursor) || (commentsCursor && !post) || (post && cursor)) return null;
  return { wall, post, cursor, commentsCursor };
}
