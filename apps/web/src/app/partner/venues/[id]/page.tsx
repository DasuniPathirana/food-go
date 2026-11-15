import { redirect, notFound } from "next/navigation";
import { z } from "zod";
import { getAuthState } from "@/lib/auth/server";
import { OwnerWorkspace } from "@/components/owner-workspace";
export default async function ManageVenue({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  if (!(await getAuthState()).user) redirect("/auth/sign-in?next=/partner/dashboard");
  return <OwnerWorkspace venueId={id}/>;
}
