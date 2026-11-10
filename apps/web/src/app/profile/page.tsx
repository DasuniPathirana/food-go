import type { Metadata } from "next";
import { ExplorerProfile } from "@/components/profile";

export const metadata: Metadata = { title: "My passport" };

export default function ProfilePage() {
  return <ExplorerProfile />;
}
