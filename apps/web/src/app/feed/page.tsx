import type { Metadata } from "next";
import { CommunityFeed } from "@/components/community-feed";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Feed" };
export default async function FeedPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  if (params.wall === "me" && !params.post) redirect("/profile");
  return <CommunityFeed initialWall={typeof params.wall === "string" ? params.wall : "public"} initialPost={typeof params.post === "string" ? params.post : undefined} />;
}
