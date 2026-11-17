"use client";

import Link from "next/link";
import { createContext, useContext, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ageStatusSchema, recordBirthDateSchema, sydneyToday, type AgeStatus } from "@/lib/age-contracts";
import { CommunityFeed } from "./community-feed";

const Access = createContext<{ signedIn: boolean; age: AgeStatus | null }>({ signedIn: false, age: null });
export function FeedAccessProvider({ signedIn, age, children }: { signedIn: boolean; age: AgeStatus | null; children: ReactNode }) {
  return <Access.Provider value={{ signedIn, age }}>{children}</Access.Provider>;
}
export const useFeedAccess = () => useContext(Access);

export function AgeRestrictedFeed(props: Parameters<typeof CommunityFeed>[0]) {
  const access = useFeedAccess();
  return access.signedIn && access.age?.feedEligible ? <CommunityFeed {...props}/> : <FeedAgeNotice/>;
}
export function FeedAgeNotice() {
  const { signedIn, age } = useFeedAccess(), router = useRouter();
  const [birthDate, setBirthDate] = useState(""), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const [today, setToday] = useState<string>();
  useEffect(() => setToday(sydneyToday()), []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return;
    const input = recordBirthDateSchema.safeParse({ birthDate });
    if (!input.success) { setError(input.error.issues[0].message); return; }
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/account/age", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input.data), signal: AbortSignal.timeout(12000) });
      const data = await response.json();
      if (!response.ok || !ageStatusSchema.safeParse(data).success) throw new Error(typeof data.error === "string" ? data.error : "Your date of birth could not be saved. Please try again.");
      setBirthDate(""); router.refresh();
    } catch (failure) { setError(failure instanceof Error && failure.name === "Error" ? failure.message : "Your change could not be confirmed. Refresh Passport before trying again."); }
    finally { setBusy(false); }
  }
  return <section className="content-panel feed-age-notice" aria-labelledby="feed-age-heading">
    <h2 id="feed-age-heading">{signedIn && age?.status === "unknown" ? "A quick age check" : "Feed is for ages 16 and over"}</h2>
    {!signedIn ? <><p>Sign in to an eligible account to read and share food stories. You can keep exploring places and deals without an account.</p><Link className="primary-button" href="/auth/sign-in?next=/feed">Sign in</Link></> :
      age?.status === "under16" ? <><p>Your Feed and personal wall will open automatically when you turn 16. Explore, Deals, Quests and Outback remain available.</p><Link className="secondary-button" href="/">Back to Explore</Link></> :
      age?.status === "unknown" ? <><p>Add your date of birth to check Feed access. It stays private and can only be recorded once.</p><form onSubmit={submit}>
        <label htmlFor="account-birth-date">Date of birth</label><input id="account-birth-date" name="birthDate" type="date" autoComplete="bday" max={today} required value={birthDate} onChange={event => setBirthDate(event.target.value)} disabled={busy} aria-describedby="age-save-error"/>
        <p className="field-hint">Check the date carefully. It cannot be changed in the app.</p><button className="primary-button" disabled={busy}>{busy ? "Saving…" : "Save date of birth"}</button>
      </form>{error && <p role="alert" className="field-error" id="age-save-error">{error}</p>}</> :
      <><p>Your Feed access could not be checked. Refresh to try again. Your other sections are still available.</p><button className="secondary-button" onClick={() => router.refresh()}>Try again</button></>}
  </section>;
}
