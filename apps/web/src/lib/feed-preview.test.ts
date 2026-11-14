import assert from "node:assert/strict";
import { test } from "node:test";
import { createFeedPreview, parseFeedPost, previewViewer, readFeedPreview, visiblePreviewPosts } from "./feed-preview";

test("community examples round-trip without contact or arbitrary image fields", () => {
  const preview = createFeedPreview();
  const first = preview.posts[0]!;
  const parsed = parseFeedPost({ ...first, email: "private@example.invalid", photo: { src: "https://untrusted.example/tracker.png", alt: "Untrusted image" } });
  assert.ok(parsed);
  assert.equal(parsed.photo, undefined);
  assert.equal("email" in parsed, false);
  assert.deepEqual(readFeedPreview(JSON.stringify(preview)), preview);
});

test("damaged or oversized local social stores fail closed", () => {
  for (const value of [null, "not JSON", "x".repeat(400001), JSON.stringify({ ...createFeedPreview(), version: 2 }), JSON.stringify({ ...createFeedPreview(), blocked: ["not-an-id"] })]) {
    assert.equal(readFeedPreview(value), null);
  }
  const preview = createFeedPreview();
  assert.equal(readFeedPreview(JSON.stringify({ ...preview, posts: new Array(101).fill(preview.posts[0]) })), null);
  assert.equal(readFeedPreview(JSON.stringify({ ...preview, posts: [preview.posts[0], preview.posts[0]] })), null);
});

test("social preview parsing bounds nested replies and rejects duplicate identities", () => {
  const preview = createFeedPreview();
  const first = preview.posts[0]!;
  const comment = first.comments[0]!;
  assert.equal(parseFeedPost({ ...first, body: "x".repeat(2001) }), null);
  assert.equal(parseFeedPost({ ...first, comments: [{ ...comment, body: "x".repeat(1001) }] }), null);
  assert.equal(parseFeedPost({ ...first, createdAt: "not a date" }), null);
  assert.equal(readFeedPreview(JSON.stringify({ ...preview, posts: [{ ...first, comments: [comment, comment] }] })), null);
});

test("preview wall privacy and blocked replies match the connected presentation", () => {
  const preview = createFeedPreview();
  const original = preview.posts[0]!;
  const ownPrivate = { ...original, id: "90000000-0000-4000-8000-000000000009", author: previewViewer, visibility: "private" as const, status: "private" as const, comments: [] };
  preview.posts.unshift(ownPrivate);
  assert.equal(visiblePreviewPosts(preview, "public").some((post) => post.id === ownPrivate.id), false);
  assert.equal(visiblePreviewPosts(preview, "me")[0]?.id, ownPrivate.id);
  assert.equal(visiblePreviewPosts(preview, "public", ownPrivate.id)[0]?.id, ownPrivate.id);
  assert.equal(visiblePreviewPosts(preview, original.author.id).some((post) => post.id === ownPrivate.id), false);
  preview.blocked.push(original.comments[0]!.author.id);
  const filtered = visiblePreviewPosts(preview, "public");
  assert.equal(filtered.find((post) => post.id === original.id)?.comments.length, 0);
  assert.equal(filtered.find((post) => post.id === original.id)?.commentCount, original.commentCount - 1);
  assert.equal(original.comments.length, 1);
});
