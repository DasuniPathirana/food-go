import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { OperatorBoard } from "@/components/operator-board";
import { sectionSchema, sections, type OperatorSection } from "@/lib/operator";
import { operatorQueue } from "@/lib/operator-server";
import { loadLiveMalls } from "@/lib/world-server";
import styles from "./operator.module.css";

export const metadata: Metadata = { title: "Food Go Admin Portal", robots: { index: false, follow: false } };

const SECTION_TITLES: Record<OperatorSection, string> = {
  analytics: "Reports & Analytics",
  venues: "Restaurants",
  buildings: "3D Buildings & Pins",
  malls: "Malls Directory",
  loots: "Game Rewards & Loots",
  promotions: "Deals Approval",
  quests: "Quests",
  posts: "Feed Posts",
  comments: "Comments",
  reports: "Safety Reports",
  audit: "Audit Log",
};

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ section?: string; page?: string }>;
}) {
  const params = await searchParams;
  const section: OperatorSection = sectionSchema.safeParse(params.section).data ?? "analytics";
  const page = /^\d{1,6}$/u.test(params.page ?? "") ? Math.min(Number(params.page), 100000) : 0;
  const result = await operatorQueue(section, page);

  if (result.status !== "ready") {
    const messages = {
      signed_out: "Sign in with your Food Go operator account to continue.",
      denied: "Your account does not have operator administrator access.",
      mfa_required: "Confirm your identity with your authenticator to open Admin operations.",
      unavailable: "Operator services are temporarily unavailable.",
    } as const;
    return (
      <section className="empty-state">
        <ShieldCheck size={32} />
        <h1>Food Go Admin Portal</h1>
        <p>{messages[result.status]}</p>
        {result.status === "signed_out" && (
          <Link className="primary-button" href="/auth/sign-in?next=/admin">Sign in</Link>
        )}
        {result.status === "mfa_required" && (
          <Link className="primary-button" href="/admin/security">Open authenticator</Link>
        )}
        {result.status === "unavailable" && (
          <Link className="primary-button" href="/admin">Try again</Link>
        )}
      </section>
    );
  }

  const malls = section === "loots" || section === "malls" || section === "venues" ? await loadLiveMalls() : [];

  return (
    <section className={styles.page}>
      <header className={styles.heading}>
        <div className={styles.headingTitle}>
          <ShieldCheck size={34} />
          <div>
            <h1>Food Go Admin Portal</h1>
            <p>Approve restaurants, 3D buildings, malls, deals & quests, place Special Game Rewards on the Melbourne map, and export live reports.</p>
          </div>
        </div>
        <Link href="/" className="secondary-button">Open 3D Explorer</Link>
      </header>

      <nav className={styles.tabs} aria-label="Admin sections">
        {sections.map(item => (
          <Link
            aria-current={item === section ? "page" : undefined}
            key={item}
            href={`/admin?section=${item}`}
          >
            {SECTION_TITLES[item]}
          </Link>
        ))}
      </nav>

      <h2>{SECTION_TITLES[section]}</h2>
      {section === "promotions" && (
        <p className={styles.help}>
          Choose a published restaurant under <Link href="/admin?section=venues">Restaurants</Link> to create an official offer, or approve/edit submitted restaurant deals below.
        </p>
      )}
      <OperatorBoard section={section} rows={result.items} malls={malls} key={section + page} />

      {section !== "analytics" && (page > 0 || result.hasMore) && (
        <nav aria-label="Queue pages" className={styles.pagination}>
          {page > 0 && <Link href={`/admin?section=${section}&page=${page - 1}`}>Previous page</Link>}
          <span>Page {page + 1}</span>
          {result.hasMore && <Link href={`/admin?section=${section}&page=${page + 1}`}>Next page</Link>}
        </nav>
      )}
    </section>
  );
}
