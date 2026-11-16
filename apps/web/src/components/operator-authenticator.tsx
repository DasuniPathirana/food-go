"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ShieldCheck } from "lucide-react";

export function OperatorAuthenticator({ authenticators, canEnrol }: {
  authenticators: { id: string; name: string }[]; canEnrol: boolean;
}) {
  const router = useRouter();
  const [factor, setFactor] = useState(authenticators[0]?.id ?? "");
  const [setup, setSetup] = useState<{ qr: string; secret: string } | null>(null);
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/admin/security", { method: "POST", credentials: "same-origin", cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(factor ? { action: "verify", factorId: factor, code } : { action: "enrol" }) });
      const data = await response.json();
      if (!response.ok) { setError(data.error || "Please try again."); return; }
      if (data.verified === true) {
        setSetup(null);
        setCode("");
        router.replace("/admin");
        router.refresh();
      } else if (typeof data.factorId === "string" && typeof data.secret === "string" &&
        typeof data.qr === "string" && data.qr.startsWith("data:image/svg+xml;utf-8,")) {
        setSetup({ qr: data.qr, secret: data.secret });
        setFactor(data.factorId);
      } else setError("The authenticator could not be set up. Please reload and try again.");
    } catch { setError("We could not reach the authentication service."); }
    finally { setPending(false); }
  }
  return <section className="auth-section"><div className="auth-card">
    <ShieldCheck size={32} aria-hidden="true" /><h1>{canEnrol ? "Set up your authenticator" : "Verify your sign-in"}</h1>
    {!factor && !canEnrol ? <p>Contact your project owner to recover access to your registered factor.</p> :
      <form onSubmit={submit} className="auth-form">
        {authenticators.length > 1 && <label>Authenticator<select value={factor} onChange={e => setFactor(e.target.value)}>{authenticators.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>}
        {setup && <><p>Scan this QR code in your authenticator app.</p><img alt="Food Go authenticator setup QR code" width="180" height="180" src={setup.qr} />
          <details><summary>Enter the setup key manually</summary><code>{setup.secret}</code></details></>}
        {factor ? <label>Six-digit code<input required type="text" inputMode="numeric" pattern="[0-9]{6}" maxLength={6}
          autoComplete="one-time-code" value={code} onChange={e => setCode(e.target.value)} /></label> :
          <p>Link an authenticator app to open the operator portal.</p>}
        {error && <p role="alert" className="field-error">{error}</p>}
        <button className="primary-button" disabled={pending}>{pending ? "Please wait" : factor ? "Verify and open admin" : "Set up authenticator"}</button>
      </form>}
  </div></section>;
}
