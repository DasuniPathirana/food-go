"use client";

import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { ShieldCheck } from "lucide-react";
import { COMMUNITY_POLICY_VERSION, communityPolicyStatusSchema } from "@/lib/community-policy";
import { acknowledgementCheckbox } from "@/lib/community-policy-copy";
import { CommunityAcknowledgement } from "./community-acknowledgement";
import styles from "./community-consent.module.css";

type Consent = { accepted: boolean; loading: boolean; open: () => void; refresh: () => void };
const Context = createContext<Consent | null>(null);
export const useCommunityConsent = () => useContext(Context);

/** Verified account acceptance is read from the server, never from browser storage. */
export function CommunityConsentProvider({ signedIn, children }: { signedIn: boolean; children: ReactNode }) {
  const [accepted, setAccepted] = useState(false), [loading, setLoading] = useState(signedIn);
  const [open, setOpen] = useState(false), [checked, setChecked] = useState(false), [pending, setPending] = useState(false);
  const [error, setError] = useState(""), [revision, setRevision] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null), opener = useRef<HTMLElement | null>(null);
  const request = useRef<AbortController | null>(null);
  const statusRequest = useRef<AbortController | null>(null);
  const prompted = useRef(false), title = useId();
  const refresh = useCallback(() => setRevision(value => value + 1), []);
  const show = useCallback(() => { opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; setOpen(true); }, []);
  function close() { if (pending) return; setOpen(false); setChecked(false); dialog.current?.close(); opener.current?.focus({ preventScroll: true }); }
  useEffect(() => {
    if (!signedIn) { setAccepted(false); setLoading(false); return; }
    const controller = new AbortController();
    statusRequest.current = controller;
    setLoading(true);
    fetch("/api/community/policy", { credentials: "same-origin", cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(12000)]) })
      .then(async response => {
        const parsed = communityPolicyStatusSchema.safeParse(await response.json());
        if (!response.ok || !parsed.success) throw new Error("unavailable");
        if (controller.signal.aborted) return;
        setError(""); setAccepted(Boolean(parsed.data.acceptedAt));
        if (!parsed.data.acceptedAt && !prompted.current) { prompted.current = true; show(); }
      }).catch(() => { if (!controller.signal.aborted) { setAccepted(false); setError("We could not check your acknowledgement. Please try again before posting."); } })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [signedIn, revision, show]);
  useEffect(() => {
    if (!open || !dialog.current) return;
    const node = dialog.current;
    if (!node.open) node.showModal();
    node.querySelector<HTMLHeadingElement>("h2")?.focus({ preventScroll: true }); node.scrollTop = 0;
    const previous = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [open]);
  useEffect(() => () => request.current?.abort(), []);
  async function accept() {
    if (!checked || pending) return;
    statusRequest.current?.abort(); setLoading(false);
    const controller = new AbortController(); request.current = controller;
    setPending(true); setError("");
    try {
      const response = await fetch("/api/community/policy", { method: "POST", credentials: "same-origin", cache: "no-store",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify({ version: COMMUNITY_POLICY_VERSION, accepted: true }),
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(12000)]) });
      const parsed = communityPolicyStatusSchema.safeParse(await response.json());
      if (!response.ok || !parsed.success || !parsed.data.acceptedAt) throw new Error("unavailable");
      if (controller.signal.aborted) return;
      setAccepted(true); setOpen(false); setChecked(false); dialog.current?.close(); opener.current?.focus({ preventScroll: true });
    } catch { if (!controller.signal.aborted) setError("Your acceptance could not be saved. Try again. Posting stays unavailable until it is saved."); }
    finally { if (!controller.signal.aborted) setPending(false); }
  }
  return <Context.Provider value={{ accepted, loading, open: show, refresh }}>{children}
    {signedIn && <dialog ref={dialog} className={styles.dialog} aria-labelledby={title} onCancel={event => { event.preventDefault(); close(); }}>
      <div className={styles.content}><header className={styles.heading}><ShieldCheck aria-hidden="true"/><div><h2 id={title} tabIndex={-1}>Our community acknowledgement</h2><p>Please confirm these rules for your verified account before taking part.</p></div></header>
        <CommunityAcknowledgement/>
        <label className={styles.check}><input type="checkbox" checked={checked} onChange={event => setChecked(event.target.checked)} disabled={pending}/><span>{acknowledgementCheckbox}</span></label>
        {error && <p className={styles.error} role="alert">{error}</p>}
        <div className={styles.actions}><button type="button" className={styles.accept} disabled={!checked || pending} onClick={() => void accept()}>{pending ? "Saving acknowledgement…" : "Accept and continue"}</button>
          <button type="button" disabled={pending} onClick={close}>Continue browsing</button><Link className={styles.link} href="/acknowledgement" onClick={close}>Read full acknowledgement</Link></div>
        <p className={styles.note}>Version {COMMUNITY_POLICY_VERSION}. We save the version and acceptance time against your account. You can browse, report misuse, block an account or remove your own post without accepting.</p>
      </div>
    </dialog>}
  </Context.Provider>;
}

export function CommunityConsentNotice() {
  const consent = useCommunityConsent();
  if (!consent || consent.accepted) return null;
  return <div className={styles.banner}><p>{consent.loading ? "Checking your acknowledgement…" : "Accept the community acknowledgement to post, comment, like or share. Safety reports and blocking remain available."}</p><button type="button" className={styles.review} onClick={consent.open}>Review acknowledgement</button></div>;
}
