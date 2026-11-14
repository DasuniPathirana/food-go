import type { Metadata } from "next";
import { CommunityFeed } from "@/components/community-feed";

export const metadata: Metadata = { title: "Community experience preview" };
export default async function FeedPreviewPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  return <CommunityFeed preview initialWall={typeof params.wall === "string" ? params.wall : "public"} initialPost={typeof params.post === "string" ? params.post : undefined} />;
}
