import type { CommunityAuthor, CommunityPost } from "./community";

export type FeedPost = CommunityPost & { photo?: { src: string; alt: string } };
export type FeedPreview = { version: 1; posts: FeedPost[]; blocked: string[]; reports: string[] };
export const PREVIEW_FEED_KEY = "food-go:community-preview:v1";
export const previewViewer: CommunityAuthor = { id: "40000000-0000-4000-8000-000000000004", name: "You" };

/** Keep private thoughts and blocked replies out of the public example wall. */
export function visiblePreviewPosts(preview: FeedPreview, wall: string, postId?: string): FeedPost[] {
  return preview.posts.filter((post) => {
    if (preview.blocked.includes(post.author.id) || preview.reports.includes(post.id)) return false;
    const own = post.author.id === previewViewer.id;
    const published = post.visibility === "public" && post.status === "published";
    if (!published && !own) return false;
    if (postId && post.id !== postId) return false;
    if (wall === "public") return published || Boolean(postId && own);
    if (wall === "me" || wall === previewViewer.id) return own || (published && post.shared);
    return post.author.id === wall && published;
  }).map((post) => {
    const comments = post.comments.filter((comment) => !preview.blocked.includes(comment.author.id));
    return { ...post, comments, commentCount: Math.max(0, post.commentCount - (post.comments.length - comments.length)) };
  });
}
const photos = new Set(["/images/brunch.jpg", "/images/pizza.jpg", "/images/coffee.jpg"]);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const date = (value: unknown): value is string => typeof value === "string" && value.length < 40 && Number.isFinite(Date.parse(value));
const text = (value: unknown, max: number): value is string => typeof value === "string" && value.length > 0 && value.length <= max;
const id = (value: unknown): value is string => typeof value === "string" && uuid.test(value);
const author = (value: unknown): value is CommunityAuthor => typeof value === "object" && value !== null && "id" in value && "name" in value && id(value.id) && text(value.name, 80);
const count = (value: unknown): value is number => Number.isInteger(value) && Number(value) >= 0 && Number(value) <= 10000000;

/** Bounded parser for the local example store and the public presentation contract. */
export function parseFeedPost(value: unknown): FeedPost | null {
  if (!value || typeof value !== "object") return null;
  const post = value as Record<string, unknown>;
  if (!id(post.id) || !author(post.author) || !text(post.body, 2000) || !date(post.createdAt) ||
    !["public", "private"].includes(String(post.visibility)) || !["published", "pending", "private"].includes(String(post.status)) ||
    !count(post.likeCount) || !count(post.commentCount) || !count(post.shareCount) || typeof post.liked !== "boolean" || typeof post.shared !== "boolean" ||
    !Array.isArray(post.comments) || post.comments.length > 200 || !(post.commentsNextCursor === null || text(post.commentsNextCursor, 512))) return null;
  const comments = [];
  for (const entry of post.comments) {
    if (!entry || typeof entry !== "object") return null;
    const comment = entry as Record<string, unknown>;
    if (!id(comment.id) || !author(comment.author) || !text(comment.body, 1000) || !date(comment.createdAt) || !["published", "pending"].includes(String(comment.status))) return null;
    comments.push({ id: comment.id, author: { id: comment.author.id, name: comment.author.name }, body: comment.body, createdAt: comment.createdAt, status: comment.status as "published" | "pending" });
  }
  const photo = post.photo && typeof post.photo === "object" ? post.photo as Record<string, unknown> : null;
  return {
    id: post.id, author: { id: post.author.id, name: post.author.name }, body: post.body, createdAt: post.createdAt,
    visibility: post.visibility as "public" | "private", status: post.status as CommunityPost["status"],
    likeCount: post.likeCount, commentCount: post.commentCount, shareCount: post.shareCount,
    liked: post.liked, shared: post.shared, comments, commentsNextCursor: post.commentsNextCursor as string | null,
    ...(author(post.sharedBy) ? { sharedBy: { id: post.sharedBy.id, name: post.sharedBy.name } } : {}),
    ...(photo && typeof photo.src === "string" && photos.has(photo.src) && text(photo.alt, 200) ? { photo: { src: photo.src, alt: photo.alt } } : {}),
  };
}

export function createFeedPreview(): FeedPreview {
  const yesterday = Date.now() - 86400000;
  const aisha = { id: "10000000-0000-4000-8000-000000000001", name: "Aisha M." };
  const theo = { id: "20000000-0000-4000-8000-000000000002", name: "Theo L." };
  const mia = { id: "30000000-0000-4000-8000-000000000003", name: "Mia R." };
  const basic = { visibility: "public" as const, status: "published" as const, liked: false, shared: false, commentsNextCursor: null };
  return { version: 1, blocked: [], reports: [], posts: [
    { ...basic, id: "50000000-0000-4000-8000-000000000005", author: aisha,
      body: "A slow morning, a very good coffee, and this little brunch stop. The best discoveries are the ones you share. What is your go-to weekend breakfast?",
      createdAt: new Date(yesterday + 72000000).toISOString(), likeCount: 12, commentCount: 1, shareCount: 2,
      photo: { src: "/images/brunch.jpg", alt: "Avocado toast with bright greens and roasted vegetables" },
      comments: [{ id: "60000000-0000-4000-8000-000000000006", author: mia, body: "Anything with a good sourdough. This looks like a lovely morning.", createdAt: new Date(yesterday + 73000000).toISOString(), status: "published" }],
    },
    { ...basic, id: "70000000-0000-4000-8000-000000000007", author: theo,
      body: "A table full of pizza and absolutely no rush to leave. Sometimes a food adventure is just making time for your favourite people.",
      createdAt: new Date(yesterday + 54000000).toISOString(), likeCount: 8, commentCount: 0, shareCount: 1, comments: [],
      photo: { src: "/images/pizza.jpg", alt: "Fresh pizza with tomatoes and basil" },
    },
    { ...basic, id: "80000000-0000-4000-8000-000000000008", author: mia,
      body: "What is the small local place you keep going back to? Mine is the cafe with the warmest welcome, not the longest menu. Tell me yours.",
      createdAt: new Date(yesterday + 36000000).toISOString(), likeCount: 6, commentCount: 0, shareCount: 0, comments: [],
    },
  ] };
}

export function readFeedPreview(raw: string | null): FeedPreview | null {
  if (!raw || raw.length > 400000) return null;
  try {
    const value = JSON.parse(raw);
    if (!value || value.version !== 1 || !Array.isArray(value.posts) || value.posts.length > 100 ||
      !Array.isArray(value.blocked) || value.blocked.length > 100 || !value.blocked.every(id) ||
      !Array.isArray(value.reports) || value.reports.length > 100 || !value.reports.every(id)) return null;
    const posts = value.posts.map(parseFeedPost);
    if (posts.some((post: FeedPost | null) => !post)) return null;
    if (new Set(posts.map((post: FeedPost) => post.id)).size !== posts.length || posts.some((post: FeedPost) => new Set(post.comments.map((comment) => comment.id)).size !== post.comments.length)) return null;
    return { version: 1, posts: posts as FeedPost[], blocked: [...new Set<string>(value.blocked)], reports: [...new Set<string>(value.reports)] };
  } catch { return null; }
}
