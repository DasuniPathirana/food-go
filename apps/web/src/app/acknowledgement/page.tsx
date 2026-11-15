import Link from "next/link";
import { CommunityAcknowledgement } from "@/components/community-acknowledgement";
import { COMMUNITY_POLICY_VERSION } from "@/lib/community-policy";
import styles from "@/components/community-consent.module.css";

export const metadata = { title: "Community acknowledgement" };
export default function AcknowledgementPage() {
  return <article className={styles.page}><h1>Community acknowledgement</h1><p>A welcoming place for food discoveries and respectful, truthful experiences.</p><CommunityAcknowledgement/>
    <p className={styles.receipt}>Version {COMMUNITY_POLICY_VERSION}. Acceptance is recorded for a verified account before posting, commenting, liking or sharing. Browsing and safety tools remain available without acceptance.</p>
    <Link href="/help">Help and information</Link></article>;
}
