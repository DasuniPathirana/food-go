import type { Metadata } from "next";
import { CommunityFeed } from "@/components/community-feed";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Feed preview" };
export default async function FeedPreviewPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  if (params.wall === "me" && !params.post) redirect("/demo/passport");
  return <CommunityFeed preview initialWall={typeof params.wall === "string" ? params.wall : "public"} initialPost={typeof params.post === "string" ? params.post : undefined} />;
}
