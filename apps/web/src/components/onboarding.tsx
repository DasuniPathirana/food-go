"use client";

import Link from "next/link";
import { useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ClipboardList,
  Leaf,
  Pencil,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";
import { AU_STATES, venueDraftSchema, type VenueDraft } from "@food-go/domain";
import { partnerVenueSchema } from "@/lib/partner/contracts";

type DraftFields = Omit<VenueDraft, "state" | "venueType" | "acceptedTerms"> & {
  state: VenueDraft["state"] | "";
  venueType: VenueDraft["venueType"] | "";
  acceptedTerms: boolean;
};
type FieldName = keyof DraftFields;
type FieldErrors = Partial<Record<FieldName, string>>;

const emptyDraft: DraftFields = {
  name: "",
  email: "",
  phone: "",
  address: "",
  suburb: "",
  state: "",
  postcode: "",
  cuisine: "",
  venueType: "",
  description: "",
  gameEnabled: true,
  acceptedTerms: false,
};
const stepLabels = ["The basics", "Your venue", "Review your draft"];
const basicsSchema = venueDraftSchema.pick({
  name: true,
  email: true,
  phone: true,
});
const detailsSchema = venueDraftSchema.pick({
  address: true,
  suburb: true,
  state: true,
  postcode: true,
  cuisine: true,
  venueType: true,
  description: true,
  gameEnabled: true,
});

export function Onboarding({ connected = false }: { connected?: boolean }) {
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<DraftFields>({ ...emptyDraft });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [completed, setCompleted] = useState<VenueDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const requestKey = useRef<string | null>(null);

  function setField<K extends FieldName>(name: K, value: DraftFields[K]) {
    requestKey.current = null;
    setSaveError("");
    setDraft((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: undefined }));
  }

  function moveTo(next: number) {
    setStep(next);
    setErrors({});
    window.requestAnimationFrame(() =>
      document.getElementById("onboarding-step-heading")?.focus(),
    );
  }

  function reset() {
    requestKey.current = null;
    setSaveError("");
    setDraft({ ...emptyDraft });
    setErrors({});
    setCompleted(null);
    setStep(0);
    window.requestAnimationFrame(() =>
      document.getElementById("onboarding-step-heading")?.focus(),
    );
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const schema =
      step === 0 ? basicsSchema : step === 1 ? detailsSchema : venueDraftSchema;
    const input =
      step === 0
        ? { name: draft.name, email: draft.email, phone: draft.phone }
        : step === 1
          ? {
              address: draft.address,
              suburb: draft.suburb,
              state: draft.state,
              postcode: draft.postcode,
              cuisine: draft.cuisine,
              venueType: draft.venueType,
              description: draft.description,
              gameEnabled: draft.gameEnabled,
            }
          : draft;
    const result = schema.safeParse(input);
    if (!result.success) {
      const nextErrors: FieldErrors = {};
      for (const issue of result.error.issues) {
        const field = issue.path[0] as FieldName | undefined;
        if (field && !nextErrors[field])
          nextErrors[field] =
            field === "acceptedTerms"
              ? "Confirm that you are authorised to manage this venue."
              : issue.message;
      }
      setErrors(nextErrors);
      const first = Object.keys(nextErrors)[0];
      window.requestAnimationFrame(() =>
        document.getElementById(`venue-field-${first}`)?.focus(),
      );
      return;
    }
    if (step < 2) moveTo(step + 1);
    else {
      const finalResult = venueDraftSchema.safeParse(draft);
      if (finalResult.success) {
        if (connected) {
          setSaving(true);
          setSaveError("");
          requestKey.current ??= crypto.randomUUID();
          try {
            const response = await fetch("/api/partner/venues", {
              method: "POST",
              credentials: "same-origin",
              headers: { "Content-Type": "application/json", "Idempotency-Key": requestKey.current },
              body: JSON.stringify(finalResult.data),
              signal: AbortSignal.timeout(15000),
            });
            const result: unknown = await response.json();
            if (!response.ok) {
              setSaveError(response.status === 401
                ? "Your session has expired. Sign in again, then return to this form."
                : typeof result === "object" && result !== null && "error" in result && typeof result.error === "string"
                  ? result.error
                  : "Your draft could not be saved. Please try again.");
              return;
            }
            const saved = typeof result === "object" && result !== null && "data" in result
              ? partnerVenueSchema.safeParse(result.data)
              : null;
            if (!saved?.success || saved.data.status !== "draft" || saved.data.ownershipVerified || saved.data.name !== finalResult.data.name || saved.data.suburb !== finalResult.data.suburb || saved.data.state !== finalResult.data.state) {
              setSaveError("We could not confirm the save. Retry to check the same draft.");
              return;
            }
          } catch {
            setSaveError("We could not confirm the save. Retry with unchanged details to check the same submission, or check your venues before editing. Your details are still here.");
            return;
          } finally {
            setSaving(false);
          }
        }
        setCompleted(finalResult.data);
        window.requestAnimationFrame(() =>
          document.getElementById("draft-ready-heading")?.focus(),
        );
      }
    }
  }

  function textField(
    name:
      | "name"
      | "email"
      | "phone"
      | "address"
      | "suburb"
      | "postcode"
      | "cuisine",
    label: string,
    placeholder: string,
    options?: {
      type?: string;
      autoComplete?: string;
      fullWidth?: boolean;
      hint?: string;
      maxLength?: number;
    },
  ) {
    return (
      <Field
        name={name}
        label={label}
        error={errors[name]}
        hint={options?.hint}
        fullWidth={options?.fullWidth}
      >
        <input
          id={`venue-field-${name}`}
          name={name}
          type={options?.type ?? "text"}
          autoComplete={options?.autoComplete ?? "off"}
          value={draft[name]}
          onChange={(event) => setField(name, event.target.value)}
          placeholder={placeholder}
          maxLength={options?.maxLength ?? 200}
          aria-invalid={Boolean(errors[name])}
          aria-describedby={describedBy(name, errors[name], options?.hint)}
          required
          inputMode={
            name === "postcode"
              ? "numeric"
              : name === "phone"
                ? "tel"
                : undefined
          }
        />
      </Field>
    );
  }

  return (
    <div className="onboarding-layout">
      <aside className="onboarding-sidebar" aria-label="Draft progress">
        <span className="eyebrow">Restaurant onboarding</span>
        <h1>
          Add your venue
          <br /> to Food Go.
        </h1>
        <p>Enter your business details, then review the listing.</p>
        <ol className="step-list">
          {stepLabels.map((label, index) => (
            <li
              key={label}
              className={`step-item ${completed || index < step ? "complete" : ""} ${!completed && index === step ? "active" : ""}`}
              aria-current={!completed && index === step ? "step" : undefined}
            >
              <span className="step-number">
                {completed || index < step ? (
                  <Check size={16} aria-hidden="true" />
                ) : (
                  index + 1
                )}
              </span>
              <span>{label}</span>
            </li>
          ))}
        </ol>
        <div className="inline-notice">
          <ShieldCheck size={21} aria-hidden="true" />
          <p>
            <strong>A draft, at your own pace.</strong>
            <br />
            {connected ? "Choose Save private draft after reviewing your details. Ownership review is required before publication." : "Nothing is published. This form lets you preview the onboarding steps."}
          </p>
        </div>
      </aside>

      <section className="form-panel" aria-label="Venue draft builder">
        {completed ? (
          <div className="success-panel">
            <span className="success-icon">
              <CheckCircle2 size={34} strokeWidth={1.5} aria-hidden="true" />
            </span>
            <span className="eyebrow">{connected ? "Private venue draft" : "Venue draft preview"}</span>
            <h2 id="draft-ready-heading" tabIndex={-1}>
              {connected ? "Your venue draft is saved" : "Draft preview ready"}
            </h2>
            <p>
              {connected ? "You can find this draft in your partner dashboard after reloading or signing in again. It is private and has not been verified or published." : "Meet your example listing. This preview exists only in this page's memory. It has not been saved, submitted, verified or published."}
            </p>
            <div className="draft-preview-card">
              <span className="venue-type">
                {typeLabel(completed.venueType)} <span>{connected ? "Private draft" : "Draft preview"}</span>
              </span>
              <h3>{completed.name}</h3>
              <p>
                {completed.cuisine} in {completed.suburb}, {completed.state}
              </p>
              <p>{completed.description}</p>
              <span className="draft-participation">
                <Leaf size={16} aria-hidden="true" />
                {completed.gameEnabled
                  ? "Interested in food discovery"
                  : "Marketplace listing only"}
              </span>
            </div>
            <div className="form-actions">
              {connected && <Link href="/partner/dashboard" className="primary-button">View my venues <ArrowRight size={16} /></Link>}
              {!connected && <button
                type="button"
                className="secondary-button"
                onClick={() => {
                  setCompleted(null);
                  moveTo(0);
                }}
              >
                <Pencil size={16} />
                Edit this draft
              </button>}
              <button type="button" className="primary-button" onClick={reset}>
                <RotateCcw size={16} />
                Start a fresh draft
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} noValidate aria-busy={saving}>
            <fieldset disabled={saving} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
            <div className="form-heading">
              <span className="eyebrow">STEP {step + 1} OF 3</span>
              <h2 id="onboarding-step-heading" tabIndex={-1}>
                {step === 0
                  ? "Start with your business details"
                  : step === 1
                    ? "Where is your venue?"
                    : "Review your venue details"}
              </h2>
              <p>
                {connected
                  ? step === 0
                    ? "Use your business contact details. They remain private to your organisation."
                    : step === 1
                      ? "Describe your venue and where explorers will find it."
                      : "Check your details before saving a private draft to your account."
                  : step === 0
                    ? "Use fictional details to try the onboarding experience. Contact details are not sent or verified."
                    : step === 1
                      ? "Help future explorers understand what makes this example venue worth a visit."
                      : "Check your example details before creating an in-page preview."}
              </p>
            </div>
            {Object.values(errors).some(Boolean) && (
              <p className="field-error" role="alert">
                Please check the highlighted fields.
              </p>
            )}
            {step === 0 && (
              <div className="form-grid">
                {textField(
                  "name",
                  "Venue name",
                  "For example, The Little Olive",
                  { fullWidth: true, maxLength: 120 },
                )}
                {textField("email", "Business email", "hello@example.com", {
                  type: "email",
                  autoComplete: "email",
                  maxLength: 254,
                })}
                {textField("phone", "Business phone", "03 5550 0100", {
                  type: "tel",
                  autoComplete: "tel",
                  maxLength: 24,
                })}
                <div className="inline-notice full-width">
                  <ClipboardList size={20} aria-hidden="true" />
                  <p>
                    {connected ? "Use contact details for the business you are authorised to manage. Saving a draft does not send an email or SMS." : "Try this with example information. No account is created and no email or phone message will be sent."}
                  </p>
                </div>
              </div>
            )}
            {step === 1 && (
              <div className="form-grid">
                {textField("address", "Street address", "24 Example Street", {
                  fullWidth: true,
                  autoComplete: "street-address",
                  maxLength: 200,
                })}
                {textField("suburb", "Suburb or town", "Fitzroy", {
                  autoComplete: "address-level2",
                  maxLength: 100,
                })}
                <Field
                  name="state"
                  label="State or territory"
                  error={errors.state}
                >
                  <select
                    id="venue-field-state"
                    name="state"
                    value={draft.state}
                    onChange={(event) =>
                      setField(
                        "state",
                        event.target.value as DraftFields["state"],
                      )
                    }
                    aria-invalid={Boolean(errors.state)}
                    aria-describedby={describedBy("state", errors.state)}
                    required
                  >
                    <option value="">Select a state</option>
                    {AU_STATES.map((state) => (
                      <option key={state} value={state}>
                        {state}
                      </option>
                    ))}
                  </select>
                </Field>
                {textField("postcode", "Postcode", "3065", {
                  autoComplete: "postal-code",
                  maxLength: 4,
                })}
                <Field
                  name="venueType"
                  label="Venue type"
                  error={errors.venueType}
                >
                  <select
                    id="venue-field-venueType"
                    name="venueType"
                    value={draft.venueType}
                    onChange={(event) =>
                      setField(
                        "venueType",
                        event.target.value as DraftFields["venueType"],
                      )
                    }
                    aria-invalid={Boolean(errors.venueType)}
                    aria-describedby={describedBy(
                      "venueType",
                      errors.venueType,
                    )}
                    required
                  >
                    <option value="">Select a venue type</option>
                    <option value="cafe">Cafe</option>
                    <option value="restaurant">Restaurant</option>
                    <option value="market">Food market</option>
                  </select>
                </Field>
                {textField(
                  "cuisine",
                  "Cuisine or food style",
                  "Modern Australian",
                  { fullWidth: true, maxLength: 60 },
                )}
                <Field
                  name="description"
                  label="What makes your place special?"
                  error={errors.description}
                  hint="20 to 1,000 characters. Keep it welcoming and specific."
                  fullWidth
                >
                  <textarea
                    id="venue-field-description"
                    name="description"
                    value={draft.description}
                    onChange={(event) =>
                      setField("description", event.target.value)
                    }
                    placeholder="A sunny neighbourhood cafe with seasonal plates and a warm welcome..."
                    rows={3}
                    minLength={20}
                    maxLength={1000}
                    aria-invalid={Boolean(errors.description)}
                    aria-describedby={describedBy(
                      "description",
                      errors.description,
                      true,
                    )}
                    required
                  />
                </Field>
                <label className="checkbox-field full-width">
                  <input
                    type="checkbox"
                    checked={draft.gameEnabled}
                    onChange={(event) =>
                      setField("gameEnabled", event.target.checked)
                    }
                  />
                  <span>
                    <strong>Be part of food discovery</strong>
                    <span>
                      {connected ? "Record your interest in joining future food trails. Verified check-ins are not available yet." : "Preview how this venue could appear in Food Go adventures. This does not enrol a real venue."}
                    </span>
                  </span>
                </label>
              </div>
            )}
            {step === 2 && (
              <>
                <dl className="review-grid">
                  <ReviewRow label="Venue" value={draft.name} />
                  <ReviewRow
                    label="Contact"
                    value={
                      <>
                        {draft.email}
                        <br />
                        {draft.phone}
                      </>
                    }
                  />
                  <ReviewRow
                    label="Location"
                    value={
                      <>
                        {draft.address}
                        <br />
                        {draft.suburb}, {draft.state} {draft.postcode}
                      </>
                    }
                  />
                  <ReviewRow
                    label="Food & style"
                    value={`${typeLabel(draft.venueType)} · ${draft.cuisine}`}
                  />
                  <ReviewRow
                    label="About your venue"
                    value={draft.description}
                  />
                  <ReviewRow
                    label="Food discovery"
                    value={
                      draft.gameEnabled
                        ? "Interested in participating"
                        : "Marketplace listing only"
                    }
                  />
                </dl>
                <button
                  type="button"
                  className="text-button"
                  onClick={() => moveTo(0)}
                >
                  <Pencil size={14} />
                  Edit details
                </button>
                <div className="checkbox-field">
                  <input
                    id="venue-field-acceptedTerms"
                    type="checkbox"
                    checked={draft.acceptedTerms}
                    onChange={(event) =>
                      setField("acceptedTerms", event.target.checked)
                    }
                    aria-invalid={Boolean(errors.acceptedTerms)}
                    aria-describedby={describedBy(
                      "acceptedTerms",
                      errors.acceptedTerms,
                      true,
                    )}
                  />
                  <label htmlFor="venue-field-acceptedTerms">
                    {connected ? "I am authorised to manage this venue and save these business details to my account." : "I confirm this example venue is authorised for this draft preview. No account or agreement is created."}
                  </label>
                </div>
                <p id="venue-hint-acceptedTerms" className="field-hint">
                  {connected ? "This records your declaration. Ownership must be reviewed separately before the venue can be published." : "This is a preview confirmation, not acceptance of a service contract or proof of venue ownership."}
                </p>
                {errors.acceptedTerms && (
                  <p id="venue-error-acceptedTerms" className="field-error">
                    {errors.acceptedTerms}
                  </p>
                )}
              </>
            )}
            {saveError && <p className="field-error" role="alert">{saveError} <Link href="/partner/dashboard">Check my venues</Link> <Link href="/auth/sign-in">Sign in</Link></p>}
            <div className="form-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={step === 0 ? reset : () => moveTo(step - 1)}
              >
                {step === 0 ? <RotateCcw size={16} /> : <ArrowLeft size={16} />}
                {step === 0 ? "Reset draft" : "Back"}
              </button>
              <button type="submit" className="primary-button">
                {saving ? "Saving your draft..." : step === 2 ? connected ? "Save private draft" : "Preview venue draft" : "Continue"}
                <ArrowRight size={16} />
              </button>
            </div>
            <p className="draft-disclaimer">
              {connected ? "Your details are sent securely when you choose Save private draft. Unsubmitted changes are cleared when you leave this page." : "Your draft stays in this page's memory. Reloading or resetting clears it. Nothing is sent to a server."}
            </p>
            </fieldset>
          </form>
        )}
      </section>
    </div>
  );
}

function describedBy(name: FieldName, error?: string, hint?: unknown) {
  const ids = [
    hint ? `venue-hint-${name}` : "",
    error ? `venue-error-${name}` : "",
  ].filter(Boolean);
  return ids.length ? ids.join(" ") : undefined;
}

function Field({
  name,
  label,
  children,
  error,
  hint,
  fullWidth,
}: {
  name: FieldName;
  label: string;
  children: ReactNode;
  error?: string;
  hint?: string;
  fullWidth?: boolean;
}) {
  return (
    <div className={`form-field ${fullWidth ? "full-width" : ""}`}>
      <label htmlFor={`venue-field-${name}`}>
        {label}
        <span className="required-indicator" aria-hidden="true">
          *
        </span>
      </label>
      {children}
      {hint && (
        <p className="field-hint" id={`venue-hint-${name}`}>
          {hint}
        </p>
      )}
      {error && (
        <p className="field-error" id={`venue-error-${name}`}>
          {error}
        </p>
      )}
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="review-row">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function typeLabel(value: DraftFields["venueType"]) {
  return value === "cafe"
    ? "Cafe"
    : value === "market"
      ? "Food market"
      : value === "restaurant"
        ? "Restaurant"
        : "Venue";
}
