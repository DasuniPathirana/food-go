"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ArrowRight, Check, LoaderCircle } from "lucide-react";
import {
  signInSchema,
  registerSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  type AuthMode,
} from "@/lib/auth/contracts";

const content = {
  "sign-in": {
    title: "Welcome back",
    description: "Sign in to your Food Go account.",
    button: "Sign in",
  },
  register: {
    title: "Create your account",
    description:
      "Create a Food Go account. Collection sync will be connected in a later stage.",
    button: "Create account",
  },
  "forgot-password": {
    title: "Forgot your password?",
    description:
      "Enter your email address. We will send a link if it matches an account.",
    button: "Send reset link",
  },
  "reset-password": {
    title: "Choose a new password",
    description: "Use a password you do not use for another account.",
    button: "Update password",
  },
};

export function AuthForm({
  mode,
  configured,
  notice,
}: {
  mode: AuthMode;
  configured: boolean;
  notice?: "link-expired" | "password-updated";
}) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const copy = content[mode];
  const hasPassword = mode !== "forgot-password";
  const hasEmail = mode !== "reset-password";
  const isNewPassword = mode === "register" || mode === "reset-password";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!configured || pending) return;
    setError("");
    setMessage("");
    setFields({});
    const schema =
      mode === "register"
        ? registerSchema
        : mode === "forgot-password"
          ? forgotPasswordSchema
          : mode === "reset-password"
            ? resetPasswordSchema
            : signInSchema;
    const input =
      mode === "register"
        ? { displayName, email, password }
        : mode === "forgot-password"
          ? { email }
          : mode === "reset-password"
            ? { password }
            : { email, password };
    const result = schema.safeParse(input);
    const nextErrors: Record<string, string> = {};
    if (!result.success)
      for (const issue of result.error.issues) {
        const field = String(issue.path[0]);
        if (!nextErrors[field]) nextErrors[field] = issue.message;
      }
    if (isNewPassword && password !== confirmation)
      nextErrors.confirmation = "The passwords do not match.";
    if (!result.success || Object.keys(nextErrors).length) {
      setFields(nextErrors);
      window.requestAnimationFrame(() =>
        document
          .getElementById(`auth-field-${Object.keys(nextErrors)[0]}`)
          ?.focus(),
      );
      return;
    }
    setPending(true);
    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(result.data),
        credentials: "same-origin",
      });
      const data: unknown = await response.json();
      if (!data || typeof data !== "object")
        throw new Error("Invalid response");
      if (!response.ok) {
        setError(
          "error" in data && typeof data.error === "string"
            ? data.error
            : "We could not complete that request. Please try again.",
        );
        return;
      }
      setPassword("");
      setConfirmation("");
      if (mode === "sign-in") {
        router.replace("/profile");
        router.refresh();
      } else if (mode === "reset-password") {
        router.replace("/auth/sign-in?notice=password-updated");
        router.refresh();
      } else
        setMessage(
          "message" in data && typeof data.message === "string"
            ? data.message
            : "Check your email for the next step.",
        );
    } catch {
      setError(
        "We could not reach account services. Please try again shortly.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="auth-page">
      <div className="auth-intro">
        <Link href="/" className="back-link">
          Back to exploring
        </Link>
        <p className="eyebrow">Your Food Go account</p>
        <h1>{copy.title}</h1>
        <p>{copy.description}</p>
        <p>You can keep browsing without an account.</p>
      </div>
      <div className="auth-panel">
        {!configured && (
          <div className="auth-status" role="status">
            <strong>Accounts are not connected yet</strong>
            <p>
              You can browse this preview without an account. Sign-in will open
              after the server and email service are configured. Do not enter
              real account details here yet.
            </p>
          </div>
        )}
        {notice === "link-expired" && (
          <p className="inline-notice" role="alert">
            That email link could not be used. It may have expired or been
            opened in a different browser. Request a new link and open it in the
            same browser.
          </p>
        )}
        {notice === "password-updated" && (
          <p className="inline-notice" role="status">
            Your password has been updated. You can sign in below.
          </p>
        )}
        {message ? (
          <div className="auth-message" role="status">
            <Check size={24} />
            <h2>Check your inbox</h2>
            <p>{message}</p>
            <Link href="/auth/sign-in" className="secondary-button">
              Back to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={submit} noValidate>
            {mode === "register" && (
              <div className="form-field">
                <label htmlFor="auth-field-displayName">Your name</label>
                <input
                  id="auth-field-displayName"
                  name="displayName"
                  type="text"
                  autoComplete="name"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  maxLength={80}
                  disabled={!configured || pending}
                  aria-invalid={Boolean(fields.displayName)}
                  aria-describedby={
                    fields.displayName ? "auth-error-displayName" : undefined
                  }
                />
                {fields.displayName && (
                  <p className="field-error" id="auth-error-displayName">
                    {fields.displayName}
                  </p>
                )}
              </div>
            )}
            {hasEmail && (
              <div className="form-field">
                <label htmlFor="auth-field-email">Email address</label>
                <input
                  id="auth-field-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  maxLength={254}
                  disabled={!configured || pending}
                  aria-invalid={Boolean(fields.email)}
                  aria-describedby={
                    fields.email ? "auth-error-email" : undefined
                  }
                />
                {fields.email && (
                  <p className="field-error" id="auth-error-email">
                    {fields.email}
                  </p>
                )}
              </div>
            )}
            {hasPassword && (
              <div className="form-field">
                <label htmlFor="auth-field-password">
                  {isNewPassword ? "New password" : "Password"}
                </label>
                <input
                  id="auth-field-password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete={
                    isNewPassword ? "new-password" : "current-password"
                  }
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  maxLength={128}
                  disabled={!configured || pending}
                  aria-invalid={Boolean(fields.password)}
                  aria-describedby={
                    [
                      isNewPassword ? "auth-password-help" : "",
                      fields.password ? "auth-error-password" : "",
                    ]
                      .filter(Boolean)
                      .join(" ") || undefined
                  }
                />
                {isNewPassword && (
                  <p className="field-hint" id="auth-password-help">
                    Use at least 12 characters. A few unrelated words work well.
                  </p>
                )}
                {fields.password && (
                  <p className="field-error" id="auth-error-password">
                    {fields.password}
                  </p>
                )}
              </div>
            )}
            {isNewPassword && (
              <div className="form-field">
                <label htmlFor="auth-field-confirmation">
                  Confirm new password
                </label>
                <input
                  id="auth-field-confirmation"
                  name="confirmation"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                  maxLength={128}
                  disabled={!configured || pending}
                  aria-invalid={Boolean(fields.confirmation)}
                  aria-describedby={
                    fields.confirmation ? "auth-error-confirmation" : undefined
                  }
                />
                {fields.confirmation && (
                  <p className="field-error" id="auth-error-confirmation">
                    {fields.confirmation}
                  </p>
                )}
              </div>
            )}
            {hasPassword && (
              <button
                type="button"
                className="text-button"
                onClick={() => setShowPassword(!showPassword)}
                aria-pressed={showPassword}
                disabled={!configured || pending}
              >
                {showPassword ? "Hide password" : "Show password"}
              </button>
            )}
            {error && (
              <p className="field-error" role="alert">
                {error}
              </p>
            )}
            <button
              type="submit"
              className="primary-button"
              disabled={!configured || pending}
            >
              {pending ? <LoaderCircle size={17} /> : null}
              {pending ? "Please wait" : copy.button}
              {!pending && <ArrowRight size={17} />}
            </button>
          </form>
        )}
        <nav className="auth-links" aria-label="Account options">
          {mode === "sign-in" ? (
            <>
              <Link href="/auth/forgot-password">Forgot your password?</Link>
              <p>
                New here? <Link href="/auth/register">Create an account</Link>
              </p>
            </>
          ) : (
            <Link href="/auth/sign-in">Already have an account? Sign in</Link>
          )}
        </nav>
      </div>
    </section>
  );
}

export function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function signOut() {
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/auth/sign-out", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
        credentials: "same-origin",
      });
      if (!response.ok) {
        setError("We could not sign you out. Please try again.");
        return;
      }
      router.replace("/");
      router.refresh();
    } catch {
      setError("We could not reach account services. Please try again.");
    } finally {
      setPending(false);
    }
  }
  return (
    <div>
      <button className="secondary-button" onClick={signOut} disabled={pending}>
        {pending ? "Signing out" : "Sign out"}
      </button>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
