"use client";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { useJourney } from "./journey-provider";
import { CheckCircle2, ScanLine } from "lucide-react";

export function CollectDiscovery() {
  const journey = useJourney();
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  useEffect(() => {
    const value = new URLSearchParams(location.hash.slice(1)).get("code");
    if (value && /^[a-f0-9]{32}$/u.test(value)) {
      setCode(value);
      history.replaceState(null, "", location.pathname);
    } else {
      try { setCode(sessionStorage.getItem("food-go:pending-visit") || ""); sessionStorage.removeItem("food-go:pending-visit"); } catch {}
    }
  }, []);
  async function redeem(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    setPending(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/journey", { method: "POST", credentials: "same-origin",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "redeem", code: code.trim().toLowerCase() }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "The code could not be collected.");
      setMessage(data.alreadyCollected ? "You have already collected this discovery." : `Discovery confirmed. You earned ${data.points} XP.`);
      window.dispatchEvent(new Event("food-go:progress"));
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Please try again."); }
    finally { setPending(false); }
  }
  return <section className="content-panel"><ScanLine size={28}/><h1>Collect your discovery</h1>
    <p>Ask the venue for its visit QR or a code for the dish you tried. Each place earns 50 XP once and each dish earns 100 XP once.</p>
    {journey?.signedIn ? <form onSubmit={redeem}><div className="form-field"><label htmlFor="discovery-code">Venue code</label>
      <input id="discovery-code" required minLength={32} maxLength={32} autoCapitalize="none" autoComplete="off" spellCheck={false}
        pattern="[a-fA-F0-9]{32}" value={code} onChange={e => setCode(e.target.value)} /></div>
      <button className="primary-button" disabled={pending}>{pending ? "Checking code…" : "Collect XP"}</button>
    </form> : <Link className="primary-button" href="/auth/sign-in?next=/collect" onClick={() => {
      try { sessionStorage.setItem("food-go:pending-visit", code); } catch {}
    }}>Sign in to collect</Link>}
    {message && <p role="status" className="inline-notice"><CheckCircle2 size={18}/>{message}</p>}
    {error && <p role="alert" className="field-error">{error}</p>}
    <p>Codes expire after ten minutes. Visits and dishes are separate discoveries. Complete three places to earn a further 100 XP.</p>
    <Link className="secondary-button" href="/profile">Open Passport</Link>
  </section>;
}
