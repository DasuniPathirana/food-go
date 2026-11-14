"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { phoneCodeRequestSchema, phoneCodeVerifySchema } from "@/lib/auth/contracts";

const fallbackError = "Phone sign-in is temporarily unavailable. Try again shortly.";

export function PhoneAuthForm({ configured }: { configured: boolean }) {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [sentTo, setSentTo] = useState("");
  const [token, setToken] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [retryAt, setRetryAt] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const codeInput = useRef<HTMLInputElement>(null);
  const phoneInput = useRef<HTMLInputElement>(null);
  const activeRequest = useRef<AbortController | null>(null);

  useEffect(() => () => activeRequest.current?.abort(), []);

  useEffect(() => {
    if (!retryAt) return;
    const update = () => setSecondsLeft(Math.max(0, Math.ceil((retryAt - Date.now()) / 1000)));
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [retryAt]);

  useEffect(() => {
    if (sentTo) codeInput.current?.focus();
  }, [sentTo]);

  async function sendCode(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (!configured || pending || secondsLeft > 0) return;
    setError("");
    const input = phoneCodeRequestSchema.safeParse({ phone: sentTo || phone });
    if (!input.success) {
      setError(input.error.issues[0]?.message ?? "Enter your mobile number.");
      phoneInput.current?.focus();
      return;
    }
    setPending(true);
    setRetryAt(Date.now() + 60000);
    const controller = new AbortController();
    activeRequest.current = controller;
    try {
      const response = await fetch("/api/auth/phone/request", {
        method: "POST", headers: { "Content-Type": "application/json" },
        credentials: "same-origin", body: JSON.stringify(input.data),
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]),
      });
      const data: unknown = await response.json();
      if (!data || typeof data !== "object") throw new Error("Invalid response");
      if (!response.ok) {
        if (response.status === 429) setRetryAt(Date.now() + 60000);
        setError("error" in data && typeof data.error === "string" ? data.error : fallbackError);
        return;
      }
      if (!("message" in data) || typeof data.message !== "string" || !("retryAfter" in data) || data.retryAfter !== 60)
        throw new Error("Invalid response");
      setSentTo(input.data.phone);
      setToken("");
      setMessage("If this number can be used, a sign-in code will arrive shortly. Enter it below.");
      setRetryAt(Date.now() + 60000);
      codeInput.current?.focus();
    } catch {
      if (controller.signal.aborted) return;
      // The request may have reached Supabase before the connection failed.
      // Keep verification available for a code that arrived despite the timeout.
      setSentTo(input.data.phone);
      setMessage("Code delivery could not be confirmed. If a code arrives, enter it below. Otherwise wait before requesting another.");
      setError("");
    } finally {
      if (!controller.signal.aborted) setPending(false);
    }
  }

  async function verifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!configured || pending) return;
    setError("");
    const input = phoneCodeVerifySchema.safeParse({ phone: sentTo, token });
    if (!input.success) {
      setError(input.error.issues[0]?.message ?? "Enter the code from your SMS.");
      codeInput.current?.focus();
      return;
    }
    setPending(true);
    const controller = new AbortController();
    activeRequest.current = controller;
    try {
      const response = await fetch("/api/auth/phone/verify", {
        method: "POST", headers: { "Content-Type": "application/json" },
        credentials: "same-origin", body: JSON.stringify(input.data),
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]),
      });
      const data: unknown = await response.json();
      if (!data || typeof data !== "object") throw new Error("Invalid response");
      if (!response.ok) {
        setError("error" in data && typeof data.error === "string" ? data.error : fallbackError);
        return;
      }
      if (!("redirectTo" in data) || data.redirectTo !== "/profile") throw new Error("Invalid response");
      setToken("");
      router.replace("/profile");
      router.refresh();
    } catch {
      if (!controller.signal.aborted) setError(fallbackError);
    } finally {
      if (!controller.signal.aborted) setPending(false);
    }
  }

  function changeNumber() {
    setSentTo("");
    setToken("");
    setError("");
    setMessage("");
    window.requestAnimationFrame(() => phoneInput.current?.focus());
  }

  return (
    <section className="auth-page">
      <div className="auth-intro">
        <Link href="/" className="back-link">Back to exploring</Link>
        <p className="eyebrow">Your Food Go account</p>
        <h1>A code. Then you are in.</h1>
        <p>Sign in with a code sent to your Australian mobile. No password needed.</p>
        <p>You can keep browsing without an account.</p>
      </div>
      <div className="auth-panel">
        {!configured && (
          <div className="auth-status" role="status">
            <strong>Phone sign-in is not connected yet</strong>
            <p>SMS sign-in will open after the account and message services are configured and tested.</p>
          </div>
        )}
        <h2>{sentTo ? "Enter your code" : "Your mobile number"}</h2>
        {sentTo && (
          <>
            <p>Mobile ending in {sentTo.slice(-4)}</p>
            <button type="button" className="text-button" onClick={changeNumber} disabled={pending}>Use a different number</button>
          </>
        )}
        {message && <p className="inline-notice" role="status">{message}</p>}
        <form onSubmit={sentTo ? verifyCode : sendCode} noValidate>
          {!sentTo ? (
            <div className="form-field">
              <label htmlFor="phone-number">Australian mobile number</label>
              <input
                ref={phoneInput} id="phone-number" name="phone" type="tel"
                inputMode="tel" autoComplete="tel" placeholder="0412345678"
                value={phone} maxLength={24} disabled={!configured || pending}
                onChange={(event) => setPhone(event.target.value)}
                aria-describedby="phone-number-help" aria-invalid={Boolean(error)}
              />
              <p className="field-hint" id="phone-number-help">Use 04 or +614 at the start. Enter digits without spaces.</p>
            </div>
          ) : (
            <div className="form-field">
              <label htmlFor="phone-code">Sign-in code</label>
              <input
                ref={codeInput} id="phone-code" name="token" type="text"
                inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]*"
                value={token} maxLength={10} disabled={!configured || pending}
                onChange={(event) => setToken(event.target.value.replace(/\D/gu, ""))}
                aria-describedby="phone-code-help" aria-invalid={Boolean(error)}
              />
              <p className="field-hint" id="phone-code-help">Codes expire. If yours no longer works, request a new one.</p>
            </div>
          )}
          {error && <p className="field-error" role="alert">{error}</p>}
          <button type="submit" className="primary-button" disabled={!configured || pending || (!sentTo && secondsLeft > 0)}>
            {pending ? <LoaderCircle size={17} /> : null}
            {pending ? "Please wait" : sentTo ? "Verify and sign in" : secondsLeft > 0 ? `Try again in ${secondsLeft}s` : "Send sign-in code"}
            {!pending && <ArrowRight size={17} />}
          </button>
        </form>
        {sentTo && (
          <button type="button" className="text-button" onClick={() => sendCode()} disabled={!configured || pending || secondsLeft > 0}>
            {secondsLeft > 0 ? `Resend code in ${secondsLeft}s` : "Resend code"}
          </button>
        )}
        <nav className="auth-links" aria-label="Account options">
          <Link href="/auth/sign-in">Sign in with email instead</Link>
        </nav>
      </div>
    </section>
  );
}
