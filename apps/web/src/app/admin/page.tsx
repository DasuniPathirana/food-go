import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { OperatorBoard } from "@/components/operator-board";
import { sectionSchema, sections } from "@/lib/operator";
import { operatorQueue } from "@/lib/operator-server";
import styles from "./operator.module.css";

export const metadata: Metadata = { title: "Operations", robots: { index: false, follow: false } };
export default async function AdminPage({ searchParams }: { searchParams: Promise<{ section?: string; page?: string }> }) {
  const params = await searchParams;
  const section = sectionSchema.safeParse(params.section).data ?? "venues";
  const page = /^\d{1,6}$/u.test(params.page ?? "") ? Math.min(Number(params.page), 100000) : 0;
  const result = await operatorQueue(section, page);
  const titles = { venues:"Restaurants", promotions:"Promotions", posts:"Posts", comments:"Comments", reports:"Reports", audit:"Decision history" };
  if (result.state !== "ready") {
    const messages = {
      "signed-out":"Sign in with your Food Go operator account to continue.",
      unconfigured:"Account services are unavailable on this deployment.",
      forbidden:"Your account does not have operator access.",
      mfa:"Confirm your identity with your authenticator to open operations.",
      unavailable:"Operator services are temporarily unavailable.",
    };
    return <section className="empty-state"><ShieldCheck size={32}/><h1>Food Go operations</h1><p>{messages[result.state]}</p>
      {result.state==="signed-out" && <Link className="primary-button" href="/auth/sign-in?next=/admin">Sign in</Link>}
      {result.state==="mfa" && <Link className="primary-button" href="/admin/security">Open authenticator</Link>}
      {result.state==="unavailable" && <Link className="primary-button" href="/admin">Try again</Link>}
    </section>;
  }
  return <section className={styles.page}>
    <header className={styles.heading}><ShieldCheck size={30}/><h1>Operations</h1></header>
    <p className={styles.help}><Link href="/encounters">Review restaurant encounter pools</Link></p>
    <nav className={styles.tabs} aria-label="Operator sections">{sections.map(item=><Link aria-current={item===section ? "page" : undefined}
      key={item} href={`/admin?section=${item}`}>{titles[item]}</Link>)}</nav>
    <h2>{titles[section]}</h2>
    {section==="promotions" && <p className={styles.help}>Choose a published restaurant under <Link href="/admin?section=venues">Restaurants</Link> to create an offer.</p>}
    <OperatorBoard section={section} rows={result.queue.items} key={section+page} />
    {(page>0 || result.queue.hasMore) && <nav aria-label="Queue pages" className={styles.pagination}>
      {page>0 && <Link href={`/admin?section=${section}&page=${page-1}`}>Previous page</Link>}
      <span>Page {page+1}</span>
      {result.queue.hasMore && <Link href={`/admin?section=${section}&page=${page+1}`}>Next page</Link>}
    </nav>}
  </section>;
}
