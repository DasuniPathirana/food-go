import type { Metadata } from "next";
import { AgeRestrictedFeed } from "@/components/feed-access";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Feed" };
export default async function FeedPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  if (params.wall === "me" && !params.post) redirect("/profile");
  return <AgeRestrictedFeed initialWall={typeof params.wall === "string" ? params.wall : "public"} initialPost={typeof params.post === "string" ? params.post : undefined} />;
}
