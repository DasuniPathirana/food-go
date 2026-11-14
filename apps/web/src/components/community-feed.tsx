"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowRight, BookOpen, Check, ChevronDown, Clock3, Compass, Copy, Flag, Globe2, Heart, LockKeyhole, MessageCircle, MoreHorizontal, RotateCcw, Send, Share2, ShieldCheck, Trash2, UserRound, Users, X } from "lucide-react";
import type { CommunityAuthor, CommunityFeed as FeedResult } from "@/lib/community";
import { communityFeedSchema, communityWriteResultSchema } from "@/lib/community";
import { createFeedPreview, PREVIEW_FEED_KEY, previewViewer, readFeedPreview, visiblePreviewPosts, type FeedPost, type FeedPreview } from "@/lib/feed-preview";
import styles from "./community-feed.module.css";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const validWall = (value: string) => value === "me" || uuid.test(value) ? value : "public";
const emptyFeed: FeedResult = { status: "disabled", posts: [], viewer: null, nextCursor: null };
const timeLabel = (value: string) => new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Australia/Melbourne" }).format(new Date(value));
type Action = { action: string; [field: string]: string | boolean };

export function CommunityFeed({ preview = false, initialWall = "public", initialPost, basePath, previewName, presentation = "feed" }: { preview?: boolean; initialWall?: string; initialPost?: string; basePath?: string; previewName?: string; presentation?: "feed" | "passport" }) {
  const passport = presentation === "passport";
  const [wall, setWall] = useState(passport ? "me" : validWall(initialWall));
  const [postFilter, setPostFilter] = useState(!passport && initialPost && uuid.test(initialPost) ? initialPost : undefined);
  const [example, setExample] = useState<FeedPreview>(createFeedPreview);
  const [feed, setFeed] = useState<FeedResult>(emptyFeed);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(!preview);
  const [refresh, setRefresh] = useState(0);
  const [pending, setPending] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [body, setBody] = useState("");
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [commentsOpen, setCommentsOpen] = useState<string[]>([]);
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [sharing, setSharing] = useState<string | null>(null);
  const [reporting, setReporting] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState("spam");
  const [shareUrl, setShareUrl] = useState("");
  const controllers = useRef(new Set<AbortController>());
  const viewEpoch = useRef(0);
  const mounted = useRef(true);
  const writeLock = useRef(false);
  const createRetry = useRef<{ fingerprint: string; id: string } | null>(null);
  const commentRetries = useRef<Record<string, { fingerprint: string; id: string }>>({});
  const feedColumn = useRef<HTMLDivElement>(null);
  const recordedViews = useRef(new Set<string>());
  const previousInitial = useRef({ initialWall, initialPost, presentation });
  const path = basePath || (preview ? "/feed-preview" : "/feed");
  const demo = path.startsWith("/demo/");
  const explorePath = demo ? "/demo/explore" : "/";
  const questPath = demo ? "/demo/quests" : "/quests";
  const foodDexPath = demo ? "/demo/food-dex" : "/food-dex";
  const viewer = preview ? { ...previewViewer, name: previewName || previewViewer.name } : feed.viewer;
  function social(kind: string, post: FeedPost, eventId?: string) {
    if (preview && post.visibility === "public" && post.status === "published")
      window.dispatchEvent(new CustomEvent("food-go:demo-social", { detail: { kind, postId: post.id, authorId: post.author.id, eventId } }));
  }

  useEffect(() => {
    if (!preview) return;
    const clear = () => { setExample(createFeedPreview()); setBody(""); setCommentDrafts({}); setCommentsOpen([]); };
    window.addEventListener("food-go:demo-reset", clear);
    return () => window.removeEventListener("food-go:demo-reset", clear);
  }, [preview]);

  useEffect(() => {
    mounted.current = true;
    if (preview) {
      try { setExample(readFeedPreview(localStorage.getItem(PREVIEW_FEED_KEY)) || createFeedPreview()); }
      catch { setNotice("Browser storage is unavailable. Your example changes will last while this page is open."); }
    }
    setLoaded(true);
    const history = () => {
      // Passport is always the owner's wall, irrespective of the surrounding page query.
      if (passport) return;
      viewEpoch.current += 1;
      if (!preview) { setFeed((value) => ({ ...value, posts: [], nextCursor: null, wallOwner: null })); setLoading(true); setRefresh((value) => value + 1); }
      const params = new URL(location.href).searchParams;
      setWall(validWall(params.get("wall") || "public"));
      const post = params.get("post"); setPostFilter(post && uuid.test(post) ? post : undefined);
    };
    addEventListener("popstate", history);
    return () => { mounted.current = false; controllers.current.forEach((controller) => controller.abort()); removeEventListener("popstate", history); };
  }, [preview, passport]);

  useEffect(() => {
    if (previousInitial.current.initialWall === initialWall && previousInitial.current.initialPost === initialPost && previousInitial.current.presentation === presentation) return;
    previousInitial.current = { initialWall, initialPost, presentation };
    viewEpoch.current += 1;
    if (!preview) { setFeed((value) => ({ ...value, posts: [], nextCursor: null, wallOwner: null })); setRefresh((value) => value + 1); }
    setWall(passport ? "me" : validWall(initialWall));
    setPostFilter(!passport && initialPost && uuid.test(initialPost) ? initialPost : undefined);
  }, [initialWall, initialPost, passport]);

  useEffect(() => {
    if (preview) return;
    const controller = new AbortController();
    controllers.current.add(controller);
    setLoading(true);
    const params = new URLSearchParams({ wall });
    if (postFilter) params.set("post", postFilter);
    fetch(`/api/community?${params}`, { cache: "no-store", credentials: "same-origin", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]) })
      .then(async (response) => {
        const parsed = communityFeedSchema.safeParse(await response.json());
        if (!parsed.success || (!response.ok && parsed.data.status === "ready")) throw new Error("invalid");
        if (!controller.signal.aborted) setFeed(parsed.data);
      })
      .catch(() => { if (!controller.signal.aborted) setFeed({ ...emptyFeed, status: "unavailable" }); })
      .finally(() => { controllers.current.delete(controller); if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [preview, wall, postFilter, refresh]);

  // Visible for three continuous seconds, in a foreground tab. This qualifies a
  // browser impression; the database independently verifies and deduplicates it.
  useEffect(() => {
    if (preview || !feed.viewer || !feedColumn.current || typeof IntersectionObserver === "undefined") return;
    const timers = new Map<string, ReturnType<typeof setTimeout>>();
    const visible = new Set<string>();
    const controller = new AbortController(); controllers.current.add(controller);
    const cancel = (id: string) => { const timer = timers.get(id); if (timer) clearTimeout(timer); timers.delete(id); };
    const schedule = (id: string) => {
      if (document.visibilityState !== "visible" || recordedViews.current.has(id) || timers.has(id)) return;
      timers.set(id, setTimeout(async () => {
        timers.delete(id);
        if (controller.signal.aborted || !visible.has(id) || document.visibilityState !== "visible") return;
        recordedViews.current.add(id);
        try {
          const response = await fetch("/api/community", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "view", postId: id }), signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]) });
          const parsed = communityWriteResultSchema.safeParse(await response.json());
          if (!response.ok || !parsed.success) { recordedViews.current.delete(id); return; }
          if (!controller.signal.aborted && parsed.data.reachCount !== undefined) setFeed((value) => ({ ...value, posts: value.posts.map((post) => post.id === id ? { ...post, reachCount: parsed.data.reachCount } : post) }));
        } catch { recordedViews.current.delete(id); }
      }, 3000));
    };
    const observer = new IntersectionObserver((entries) => entries.forEach((entry) => {
      const id = (entry.target as HTMLElement).dataset.viewPost;
      if (!id) return;
      if (entry.isIntersecting && entry.intersectionRatio >= .5) { visible.add(id); schedule(id); }
      else { visible.delete(id); cancel(id); }
    }), { threshold: [.5] });
    feedColumn.current.querySelectorAll<HTMLElement>("[data-view-post]").forEach((node) => {
      const post = feed.posts.find((item) => item.id === node.dataset.viewPost);
      if (post?.status === "published" && post.visibility === "public" && post.author.id !== feed.viewer?.id) observer.observe(node);
    });
    const visibility = () => { if (document.visibilityState !== "visible") timers.forEach((_, id) => cancel(id)); else visible.forEach(schedule); };
    document.addEventListener("visibilitychange", visibility);
    return () => { observer.disconnect(); timers.forEach(clearTimeout); controller.abort(); controllers.current.delete(controller); document.removeEventListener("visibilitychange", visibility); };
  }, [preview, feed.posts, feed.viewer]);

  function navigate(nextWall: string, nextPost?: string) {
    viewEpoch.current += 1;
    if (!preview) { setFeed((value) => ({ ...value, posts: [], nextCursor: null, wallOwner: null })); setLoading(true); setRefresh((value) => value + 1); }
    if (!writeLock.current) setPending(null);
    setWall(passport ? "me" : nextWall); setPostFilter(passport ? undefined : nextPost); setSharing(null); setReporting(null); setNotice("");
    if (passport) return;
    const params = new URLSearchParams();
    if (nextWall !== "public") params.set("wall", nextWall);
    if (nextPost) params.set("post", nextPost);
    window.history.pushState(null, "", `${path}${params.size ? `?${params}` : ""}`);
  }
  function saveExample(next: FeedPreview) {
    setExample(next);
    try { localStorage.setItem(PREVIEW_FEED_KEY, JSON.stringify(next)); }
    catch { setNotice("Your example changed on this page, but could not be saved in this browser."); }
  }
  async function request(data: Action, key: string) {
    if (writeLock.current) return false;
    writeLock.current = true; setPending(key); setNotice("");
    const controller = new AbortController(); controllers.current.add(controller);
    try {
      const response = await fetch("/api/community", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data), signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]) });
      const parsed = communityWriteResultSchema.safeParse(await response.json());
      if (!response.ok || !parsed.success) throw new Error("unavailable");
      const result = parsed.data;
      if (mounted.current) {
        setRefresh((value) => value + 1);
        setNotice(result.status === "pending" ? "Sent for review. You can see it on My wall while it waits for approval." : result.status === "private" ? "Saved to your private wall. Only you can see it." : "Your change has been saved.");
      }
      return true;
    } catch {
      if (mounted.current && !controller.signal.aborted) setNotice("We could not confirm that change. Your text is still here. Try again shortly.");
      return false;
    } finally { controllers.current.delete(controller); writeLock.current = false; if (mounted.current) setPending(null); }
  }
  const source: FeedPost[] = preview ? example.posts : feed.posts;
  const posts = preview ? visiblePreviewPosts(example, wall, postFilter) : source;
  const wallOwner = wall === "me" ? viewer : (feed as FeedResult & { wallOwner?: CommunityAuthor | null }).wallOwner || source.find((post) => post.author.id === wall)?.author;
  const wallTitle = wall === "public" ? "Public wall" : wall === "me" ? "My wall" : `${wallOwner?.name || "Explorer"}'s wall`;
  const isOwnWall = wall === "me" || wall === viewer?.id;

  async function publish(event: FormEvent) {
    event.preventDefault();
    const content = body.trim();
    if (!content || content.length > 2000 || pending) return;
    if (preview) {
      if (example.posts.length >= 100) { setNotice("This example has reached 100 posts. Reset the preview to start again."); return; }
      const post: FeedPost = { id: crypto.randomUUID(), author: viewer || previewViewer, body: content, createdAt: new Date().toISOString(), visibility, status: visibility === "public" ? "published" : "private", likeCount: 0, commentCount: 0, shareCount: 0, liked: false, shared: false, comments: [], commentsNextCursor: null };
      saveExample({ ...example, posts: [post, ...example.posts] });
      social("post", post);
      setBody(""); if (visibility === "private") navigate("me");
      setNotice("Your example post is saved in this browser. It has not been published to Food Go."); return;
    }
    const fingerprint = `${visibility}:${content}`;
    if (createRetry.current?.fingerprint !== fingerprint) createRetry.current = { fingerprint, id: crypto.randomUUID() };
    if (await request({ action: "create", body: content, visibility, requestId: createRetry.current.id }, "create")) { setBody(""); createRetry.current = null; navigate("me"); setNotice(visibility === "private" ? "Saved privately to My wall." : "Sent for review. Your post is on My wall while it waits for approval."); }
  }
  async function like(post: FeedPost) {
    if (preview) { saveExample({ ...example, posts: example.posts.map((item) => item.id === post.id ? { ...item, liked: !item.liked, likeCount: Math.max(0, item.likeCount + (item.liked ? -1 : 1)) } : item) }); if (!post.liked) social("like", post); }
    else await request({ action: "like", postId: post.id, liked: !post.liked }, post.id);
  }
  async function comment(event: FormEvent, post: FeedPost) {
    event.preventDefault(); const content = (commentDrafts[post.id] || "").trim();
    if (!content || content.length > 1000 || pending) return;
    if (preview) {
      if (post.comments.length >= 100) { setNotice("This example post has reached its comment limit."); return; }
      const eventId = crypto.randomUUID();
      saveExample({ ...example, posts: example.posts.map((item) => item.id === post.id ? { ...item, commentCount: item.commentCount + 1, comments: [...item.comments, { id: eventId, author: previewViewer, body: content, createdAt: new Date().toISOString(), status: "published" }] } : item) });
      social("comment", post, eventId);
      setCommentDrafts((drafts) => ({ ...drafts, [post.id]: "" })); return;
    }
    if (commentRetries.current[post.id]?.fingerprint !== content) commentRetries.current[post.id] = { fingerprint: content, id: crypto.randomUUID() };
    if (await request({ action: "comment", postId: post.id, body: content, requestId: commentRetries.current[post.id].id }, post.id)) { setCommentDrafts((drafts) => ({ ...drafts, [post.id]: "" })); delete commentRetries.current[post.id]; }
  }
  async function share(post: FeedPost) {
    if (preview) {
      saveExample({ ...example, posts: example.posts.map((item) => item.id === post.id ? { ...item, shared: !item.shared, shareCount: Math.max(0, item.shareCount + (item.shared ? -1 : 1)) } : item) });
      setNotice(post.shared ? "The example share was removed from your wall." : "Shared to your example wall in this browser.");
      if (!post.shared) social("share", post);
    } else await request({ action: "share", postId: post.id, shared: !post.shared }, post.id);
    setSharing(null);
  }
  async function copy(post: FeedPost) {
    const url = new URL(path, location.origin); url.searchParams.set("post", post.id); setShareUrl(url.href);
    try { await navigator.clipboard.writeText(url.href); setNotice("Post link copied. Choose where you would like to share it."); }
    catch { setNotice("Select the post link below to copy it."); }
  }
  async function remove(post: FeedPost) {
    if (preview) { saveExample({ ...example, posts: example.posts.filter((item) => item.id !== post.id) }); social("remove-post", post); setNotice("Your example post has been removed from this browser."); }
    else await request({ action: "delete", postId: post.id }, post.id);
  }
  async function report(post: FeedPost) {
    if (preview) { saveExample({ ...example, reports: [...new Set([...example.reports, post.id])].slice(0, 100) }); setNotice("Report recorded in this example and the post hidden. No report was sent to a real moderator."); }
    else await request({ action: "report", postId: post.id, reason: reportReason }, post.id);
    setReporting(null);
  }
  async function block(author: CommunityAuthor) {
    if (preview) { saveExample({ ...example, blocked: [...new Set([...example.blocked, author.id])].slice(0, 100) }); setNotice(`${author.name} is hidden from this example feed. Reset the preview to undo it.`); }
    else await request({ action: "block", authorId: author.id }, author.id);
  }
  async function moreComments(post: FeedPost) {
    if (!post.commentsNextCursor || pending) return;
    const epoch = viewEpoch.current;
    setPending(post.id); const controller = new AbortController(); controllers.current.add(controller);
    try {
      const params = new URLSearchParams({ post: post.id, commentsCursor: post.commentsNextCursor });
      const response = await fetch(`/api/community?${params}`, { cache: "no-store", credentials: "same-origin", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]) });
      const parsed = communityFeedSchema.safeParse(await response.json());
      const next = parsed.success ? parsed.data.posts.find((item) => item.id === post.id) : undefined;
      if (!response.ok || !next) throw new Error("unavailable");
      if (mounted.current && epoch === viewEpoch.current) setFeed((value) => ({ ...value, posts: value.posts.map((item) => item.id === post.id ? { ...item, comments: [...new Map([...item.comments, ...next.comments].map((entry) => [entry.id, entry])).values()], commentsNextCursor: next.commentsNextCursor } : item) }));
    } catch { if (mounted.current && epoch === viewEpoch.current) setNotice("More comments could not load. Try again shortly."); }
    finally { controllers.current.delete(controller); if (mounted.current && epoch === viewEpoch.current) setPending(null); }
  }
  async function morePosts() {
    if (!feed.nextCursor || loading) return;
    const epoch = viewEpoch.current;
    setLoading(true); const controller = new AbortController(); controllers.current.add(controller);
    try {
      const params = new URLSearchParams({ wall, cursor: feed.nextCursor });
      const response = await fetch(`/api/community?${params}`, { cache: "no-store", credentials: "same-origin", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]) });
      const parsed = communityFeedSchema.safeParse(await response.json());
      if (!response.ok || !parsed.success) throw new Error("unavailable");
      if (mounted.current && epoch === viewEpoch.current) setFeed((value) => ({ ...parsed.data, posts: [...new Map([...value.posts, ...parsed.data.posts].map((post) => [post.id, post])).values()] }));
    } catch { if (mounted.current && epoch === viewEpoch.current) setNotice("More stories could not load. Try again shortly."); }
    finally { controllers.current.delete(controller); if (mounted.current && epoch === viewEpoch.current) setLoading(false); }
  }
  function reset() {
    saveExample(createFeedPreview()); setBody(""); setCommentDrafts({}); setCommentsOpen([]); setSharing(null); setReporting(null); navigate("public"); setNotice("The example feed has been reset in this browser.");
  }
  const canWrite = Boolean(viewer) && (preview || feed.status === "ready");

  return <div className={`${styles.community} ${demo ? styles.embedded : ""} ${passport ? styles.passportWall : ""}`}>
    {passport ? <div className={styles.passportHeading}><h2>My wall</h2><Link href={path}>Public feed<ArrowRight size={15} /></Link></div> : <div className={styles.pageHeading}><div><h1>Community</h1><p>Food finds and stories from the neighbourhood.</p></div><Link href={explorePath} className={styles.exploreLink}><Compass size={18} />Explore the map<ArrowRight size={16} /></Link></div>}
    {preview && !demo && !passport && <div className={styles.previewNotice}><ShieldCheck size={18} /><p><strong>Example community.</strong> People, posts and activity are fictional. Changes stay in this browser.</p><button type="button" onClick={reset} aria-label="Reset community preview" title="Reset community preview"><RotateCcw size={15} />Reset</button>{!demo && <Link href="/feed">Public feed<ArrowRight size={14} /></Link>}</div>}
    <div className={styles.layout}>
      <div className={styles.feedColumn} ref={feedColumn}>
        {!passport && <div className={styles.mobileTabs}><WallTabs wall={wall} onWall={navigate} /></div>}
        {!passport && (wall !== "public" || postFilter) && <section className={styles.wallIdentity}><Avatar author={wallOwner || { id: wall, name: isOwnWall ? viewer?.name || "Your wall" : "Food explorer" }} /><div><h2>{postFilter ? "A story worth sharing" : wallTitle}</h2><p>{isOwnWall ? "Your stories, shared discoveries and private thoughts." : "Public stories and discoveries shared by this explorer."}</p></div><button type="button" onClick={() => navigate("public")} aria-label="Return to public wall"><X size={18} /></button></section>}
        {!postFilter && (wall === "public" || isOwnWall) && <form className={styles.composer} onSubmit={publish}>
          <div className={styles.composerTop}><Avatar author={viewer || { id: "guest", name: "Guest explorer" }} /><div><strong>{viewer?.name || "Share a food find"}</strong><label className={styles.visibility}><span className={styles.srOnly}>Post audience</span>{visibility === "public" ? <Globe2 size={13} /> : <LockKeyhole size={13} />}<select value={visibility} onChange={(event) => setVisibility(event.target.value as "public" | "private")} disabled={!canWrite || Boolean(pending)} aria-label="Post audience"><option value="public">Public wall</option><option value="private">Only me</option></select></label></div></div>
          <label className={styles.srOnly} htmlFor="community-post">Your food story</label><textarea id="community-post" value={body} onChange={(event) => setBody(event.target.value)} maxLength={2000} rows={2} placeholder="A new favourite? Tell the table." disabled={!canWrite || pending === "create"} aria-describedby="post-audience-note" />
          <div className={styles.composerFooter}><p id="post-audience-note">{preview ? "Example post. Saved on this browser." : visibility === "private" ? "Only you can see this post." : "Public posts are reviewed before appearing."}<span>{body.length}/2000</span></p>{canWrite ? <button className={styles.primary} type="submit" disabled={!body.trim() || Boolean(pending)}><Send size={16} />{pending === "create" ? "Sharing…" : "Share a story"}</button> : <Link href="/auth/sign-in" className={styles.primary}>Sign in to share<ArrowRight size={15} /></Link>}</div>
        </form>}
        <div className={styles.feedHeading}>{passport ? <h3>Your stories</h3> : <h2>{postFilter ? "Story" : wallTitle}</h2>}<span><Clock3 size={14} />Latest stories</span></div>
        {notice && <div className={styles.notice} role="status"><p>{notice}</p><button type="button" onClick={() => { setNotice(""); setShareUrl(""); }} aria-label="Dismiss message"><X size={17} /></button></div>}
        {shareUrl && <label className={styles.copyField}>Post link<input readOnly value={shareUrl} onFocus={(event) => event.target.select()} /></label>}
        {(!loaded || (loading && !posts.length)) && <div className={styles.loading} role="status"><span /><p>Loading stories…</p></div>}
        {loaded && !loading && !preview && feed.status !== "ready" && <section className={styles.empty}><Users size={30} /><h3>{feed.status === "disabled" ? "The community is getting ready" : "Stories are temporarily unavailable"}</h3><p>{feed.status === "disabled" ? "Public sharing will open after account and moderation setup. You can try the complete example experience now." : "Try again shortly. Your text stays on this page while you retry."}</p><div><Link className={styles.primary} href="/feed-preview">Try the community preview<ArrowRight size={16} /></Link>{feed.status === "unavailable" && <button type="button" className={styles.outline} onClick={() => setRefresh((value) => value + 1)}>Try again</button>}</div></section>}
        {loaded && !loading && (preview || feed.status === "ready") && !posts.length && <section className={styles.empty}><MessageCircle size={29} /><h3>{postFilter ? "This story is not available" : isOwnWall ? "Your wall is ready for its first story" : "There is room for your story"}</h3><p>{postFilter ? "It may have been removed, made private or still be waiting for review." : isOwnWall ? "Share a thought, post an experience or share someone else's discovery to find it here." : "Public stories appear here after review. Explore a place and bring back something worth sharing."}</p>{!preview && !viewer && <Link href="/auth/sign-in" className={styles.outline}>Sign in<ArrowRight size={15} /></Link>}{!preview && <Link href="/feed-preview" className={styles.textLink}>See the example community<ArrowRight size={15} /></Link>}</section>}
        {loaded && posts.map((entry) => { const post = preview && previewName ? { ...entry, author: entry.author.id === previewViewer.id ? { ...entry.author, name: previewName } : entry.author, comments: entry.comments.map(comment => comment.author.id === previewViewer.id ? { ...comment, author: { ...comment.author, name: previewName } } : comment) } : entry; return <article key={post.id} id={`post-${post.id}`} data-view-post={post.id} className={`${styles.post} ${postFilter === post.id ? styles.permalinkPost : ""}`}>
          {(post.sharedBy || (preview && isOwnWall && post.shared && post.author.id !== previewViewer.id)) && <p className={styles.sharedBy}><Share2 size={13} />{post.sharedBy?.name || "You"} shared this story</p>}
          <header className={styles.postHeader}><Avatar author={post.author} /><div className={styles.authorCopy}><a href={`${path}?wall=${post.author.id}`} onClick={(event) => { if (!passport && !event.ctrlKey && !event.metaKey && !event.shiftKey) { event.preventDefault(); navigate(post.author.id); } }}>{post.author.name}</a><p><time dateTime={post.createdAt}>{timeLabel(post.createdAt)}</time><span aria-hidden="true">·</span>{post.visibility === "private" ? <LockKeyhole size={12} aria-label="Only me" /> : <Globe2 size={12} aria-label="Public" />}{post.status !== "published" && <span className={styles.status}>{post.status === "pending" ? "Awaiting review" : "Only me"}</span>}</p></div>
            <details className={styles.options}><summary aria-label={`Post options for ${post.author.name}`}><MoreHorizontal size={20} /></summary><div onClick={(event) => { if ((event.target as HTMLElement).closest("button")) event.currentTarget.closest("details")?.removeAttribute("open"); }}>{post.author.id === viewer?.id ? <button type="button" disabled={Boolean(pending)} onClick={() => remove(post)}><Trash2 size={15} />Remove my post</button> : <><button type="button" disabled={!canWrite || Boolean(pending)} onClick={() => { setReporting(post.id); setSharing(null); }}><Flag size={15} />Report post</button><button type="button" disabled={!canWrite || Boolean(pending)} onClick={() => block(post.author)}><ShieldCheck size={15} />Block {post.author.name}</button></>}</div></details>
          </header>
          <p className={styles.postBody}>{post.body}</p>{post.photo && <Image className={styles.postPhoto} src={post.photo.src} alt={post.photo.alt} width={900} height={620} sizes="(max-width:700px) 100vw, 650px" />}
          <div className={styles.postCounts}><span><Heart size={14} />{post.likeCount} {post.likeCount === 1 ? "like" : "likes"}</span><span>{post.commentCount} {post.commentCount === 1 ? "comment" : "comments"}<span aria-hidden="true"> · </span>{post.shareCount} {post.shareCount === 1 ? "share" : "shares"}{!preview && post.reachCount !== undefined && <><span aria-hidden="true"> · </span><span title="Distinct verified signed-in accounts, excluding the author">{post.reachCount} reached</span></>}</span></div>
          <div className={styles.postActions}><button type="button" onClick={() => like(post)} disabled={!canWrite || Boolean(pending) || post.status !== "published"} aria-pressed={post.liked} aria-label={`${post.liked ? "Unlike" : "Like"} post by ${post.author.name}`}><Heart size={18} fill={post.liked ? "currentColor" : "none"} />Like</button><button type="button" aria-expanded={commentsOpen.includes(post.id)} aria-controls={`comments-${post.id}`} onClick={() => setCommentsOpen((open) => open.includes(post.id) ? open.filter((id) => id !== post.id) : [...open, post.id])}><MessageCircle size={18} />Comment</button><button type="button" aria-expanded={sharing === post.id} aria-controls={`share-${post.id}`} onClick={() => { setSharing(sharing === post.id ? null : post.id); setReporting(null); }}><Share2 size={18} />Share</button></div>
          {post.status !== "published" && <p className={styles.privateNote}>{post.status === "private" ? "Only you can see this post. Private posts do not receive public likes, comments or shares." : "Only you can see this post while it waits for review. Public reactions open after approval."}</p>}
          {sharing === post.id && <div className={styles.sharePanel} id={`share-${post.id}`}><button type="button" onClick={() => copy(post)}><Copy size={16} />Copy post link</button><button type="button" disabled={!canWrite || Boolean(pending) || post.status !== "published" || post.author.id === viewer?.id} onClick={() => share(post)}>{post.shared ? <Check size={16} /> : <Share2 size={16} />}{post.shared ? "Remove from my wall" : "Share to my wall"}</button></div>}
          {reporting === post.id && <form className={styles.reportPanel} onSubmit={(event) => { event.preventDefault(); report(post); }}><label>Why are you reporting this post?<select value={reportReason} onChange={(event) => setReportReason(event.target.value)}><option value="spam">Spam or misleading content</option><option value="abuse">Abuse or harassment</option><option value="other">Something else</option></select></label><div><button className={styles.outline} type="submit" disabled={Boolean(pending)}>Send report</button><button type="button" onClick={() => setReporting(null)}>Cancel</button></div></form>}
          <section id={`comments-${post.id}`} className={styles.comments} hidden={!commentsOpen.includes(post.id)} aria-label={`Comments on ${post.author.name}'s post`}>
            {post.comments.length ? post.comments.map((entry) => <div className={styles.comment} key={entry.id}><Avatar author={entry.author} small /><div><a href={`${path}?wall=${entry.author.id}`} onClick={(event) => { if (!passport && !event.ctrlKey && !event.metaKey && !event.shiftKey) { event.preventDefault(); navigate(entry.author.id); } }}>{entry.author.name}</a><p>{entry.body}</p><span>{timeLabel(entry.createdAt)}{entry.status === "pending" ? " · Awaiting review" : ""}</span></div></div>) : <p className={styles.noComments}>Start a kind conversation.</p>}
            {!preview && post.commentsNextCursor && <button type="button" className={styles.moreComments} onClick={() => moreComments(post)} disabled={Boolean(pending)}>View more comments<ChevronDown size={15} /></button>}
            <form onSubmit={(event) => comment(event, post)} className={styles.commentForm}><Avatar author={viewer || { id: "guest", name: "Guest explorer" }} small /><label className={styles.srOnly} htmlFor={`reply-${post.id}`}>Comment on {post.author.name}&apos;s post</label><textarea id={`reply-${post.id}`} rows={1} maxLength={1000} value={commentDrafts[post.id] || ""} onChange={(event) => setCommentDrafts((drafts) => ({ ...drafts, [post.id]: event.target.value }))} disabled={!canWrite || Boolean(pending) || post.status !== "published"} placeholder={canWrite ? "Add a kind thought…" : "Sign in to join the conversation"} /><button type="submit" aria-label={`Send comment on ${post.author.name}'s post`} disabled={!canWrite || Boolean(pending) || !commentDrafts[post.id]?.trim() || post.status !== "published"}><Send size={17} /></button></form>
          </section>
        </article>; })}
        {!preview && feed.nextCursor && <button className={styles.loadMore} type="button" disabled={loading} onClick={morePosts}>{loading ? "Loading stories…" : "More stories"}<ChevronDown size={16} /></button>}
      </div>
      {!passport && <aside className={styles.discoveryRail} aria-label="More to explore"><div className={styles.railStory}><Image src="/images/coffee.jpg" alt="Coffee and a golden pastry" width={350} height={260} /><h2>Plan your next stop.</h2><p>Keep the places and dishes you want to try together.</p><Link href={foodDexPath}><BookOpen size={16} />Open your FoodDex<ArrowRight size={15} /></Link><Link href={questPath}><Flag size={16} />Find a food trail<ArrowRight size={15} /></Link></div><div className={styles.communityNote}><ShieldCheck size={19} /><p>Share kindly. Keep personal details private. A story is not a verified check-in.</p></div><div className={styles.railLinks}><Link href="/help">Community and privacy<ArrowRight size={14} /></Link>{preview ? <Link href={demo ? "/demo/passport" : "/feed"}>{demo ? "Open your passport" : "Go to the public feed"}<ArrowRight size={14} /></Link> : <Link href="/feed-preview">Try the community preview<ArrowRight size={14} /></Link>}</div></aside>}
    </div>
  </div>;
}

function Avatar({ author, small = false }: { author: CommunityAuthor; small?: boolean }) {
  const tone = author.id.charCodeAt(0) % 3;
  return <span className={`${styles.avatar} ${small ? styles.smallAvatar : ""} ${styles[`tone${tone}`]}`} aria-hidden="true">{author.name.trim().slice(0, 1).toLocaleUpperCase("en-AU")}</span>;
}
function WallTabs({ wall, onWall }: { wall: string; onWall: (wall: string) => void }) {
  return <div className={styles.wallTabs} aria-label="Choose a wall"><button type="button" aria-pressed={wall === "public"} onClick={() => onWall("public")}><Globe2 size={19} />Public wall<ArrowRight size={15} /></button><button type="button" aria-pressed={wall === "me"} onClick={() => onWall("me")}><UserRound size={19} />My wall<ArrowRight size={15} /></button></div>;
}
