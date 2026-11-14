import type { Metadata } from "next";
import { CommunityFeed } from "@/components/community-feed";

export const metadata: Metadata = { title: "Community feed" };
export default async function FeedPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  return <CommunityFeed initialWall={typeof params.wall === "string" ? params.wall : "public"} initialPost={typeof params.post === "string" ? params.post : undefined} />;
}
