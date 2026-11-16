"use client";
import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ClipboardCheck } from "lucide-react";
import type { OperatorRow, OperatorSection } from "@/lib/operator";
import styles from "@/app/admin/operator.module.css";

const labels = {
  "venue.verify":"Verify ownership","venue.revoke":"Revoke ownership","venue.publish":"Publish restaurant","venue.suspend":"Suspend listing","venue.locate":"Set map position",
  "promo.create":"Create promotion","promo.edit":"Edit promotion","promo.publish":"Publish promotion","promo.withdraw":"Withdraw promotion",
  "post.publish":"Approve post","post.remove":"Remove post","comment.publish":"Approve comment","comment.remove":"Remove comment",
  "report.dismiss":"Dismiss reports","report.remove":"Remove reported post",
} as const;
type Action = keyof typeof labels;
const guidance: Partial<Record<Action,string>> = {
  "venue.verify":"Check the claimant against independent business records. Record the evidence reference below.",
  "venue.revoke":"The restaurant and its active offers will leave the public catalogue.",
  "venue.suspend":"This hides the listing and active offers while keeping its ownership record.",
  "promo.create":"Save the offer as a draft, then review and publish it under Promotions.",
  "promo.edit":"Saving returns the offer to draft for review.",
  "post.remove":"The post will leave the Feed and its public shares.",
  "comment.remove":"The comment will be removed from the discussion.",
  "report.remove":"The post will leave the Feed and these reports will be resolved.",
};

function actions(section: OperatorSection, row: OperatorRow): Action[] {
  if (section==="venues") {
    const actions: Action[] = [row.verified ? "venue.revoke" : "venue.verify", "venue.locate"];
    if (row.verified && row.state!=="published") actions.push("venue.publish");
    if (row.state!=="suspended") actions.push("venue.suspend");
    if (row.state==="published" && row.verified) actions.push("promo.create");
    return actions;
  }
  if (section==="promotions") return ["promo.edit", ...(row.state==="published" ? ["promo.withdraw" as const] : ["promo.publish" as const])];
  if (section==="posts") return row.state==="published" ? ["post.remove"] : ["post.publish","post.remove"];
  if (section==="comments") return row.state==="published" ? ["comment.remove"] : ["comment.publish","comment.remove"];
  if (section==="reports") return ["report.dismiss","report.remove"];
  return [];
}

function localDate(value?: string) {
  if (!value) return "";
  const date=new Date(value);
  return new Date(date.valueOf()-date.getTimezoneOffset()*60000).toISOString().slice(0,16);
}
function displayDate(value: string) {
  return new Intl.DateTimeFormat("en-AU",{dateStyle:"medium",timeStyle:"short",timeZone:"Australia/Melbourne"}).format(new Date(value));
}

function DecisionForm({ action,row,onClose,onSaved }: { action: Action;row: OperatorRow;onClose: ()=>void;onSaved: ()=>void }) {
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const identity=useRef<{id:string;signature:string;requestId:string} | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form=new FormData(event.currentTarget);
    const text=(key:string)=>String(form.get(key) ?? "").trim();
    const payload: Record<string,unknown> = { action, reason:text("reason") };
    if (action!=="promo.create") payload.version=row.version;
    if (action==="venue.locate") Object.assign(payload,{latitude:Number(text("latitude")),longitude:Number(text("longitude"))});
    if (action==="promo.create" || action==="promo.edit") Object.assign(payload,{
      venueId:action==="promo.create" ? row.id : row.venueId, title:text("title"), description:text("description"),
      startsAt:new Date(text("startsAt")).toISOString(), endsAt:new Date(text("endsAt")).toISOString(),
      kind:text("kind"),
    });
    const signature=JSON.stringify(payload);
    if (identity.current?.signature!==signature) identity.current={signature,id:action==="promo.create" ? crypto.randomUUID() : row.id,requestId:crypto.randomUUID()};
    payload.id=identity.current.id;
    payload.requestId=identity.current.requestId;
    setBusy(true);
    setError("");
    try {
      const response=await fetch("/api/admin",{ method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload),signal:AbortSignal.timeout(15000) });
      const result=await response.json();
      if (!response.ok || result?.ok!==true) { setError(result?.error || "Could not save the decision."); return; }
      onSaved();
    } catch { setError("We could not confirm the result. Retry this decision to check it."); }
    finally { setBusy(false); }
  }
  const isOffer=action==="promo.create" || action==="promo.edit";
  return <form className={styles.form} onSubmit={submit}>
    <h4>{labels[action]}</h4>{guidance[action] && <p>{guidance[action]}</p>}
    {/^(post|comment|report)\./u.test(action) && <p>Apply the <a href="/acknowledgement" target="_blank" rel="noopener noreferrer">community acknowledgement</a>. Assess harmful conduct and misleading content. Truthful, respectful criticism is allowed; a negative experience alone is not a reason for removal. Record the reason for this decision.</p>}
    {action==="venue.locate" && <div className={styles.pair}><label>Latitude<input name="latitude" type="number" step="any" min="-90" max="90" defaultValue={row.latitude ?? undefined} required/></label>
      <label>Longitude<input name="longitude" type="number" step="any" min="-180" max="180" defaultValue={row.longitude ?? undefined} required/></label></div>}
    {isOffer && <>
      <label>Deal category<select name="kind" defaultValue={row.kind || "restaurant"}><option value="food">Food Deal: a meal, drink or combo</option><option value="restaurant">Restaurant Deal: venue-wide dining</option></select></label>
      <label>Offer title<input name="title" required minLength={2} maxLength={90} defaultValue={action==="promo.edit" ? row.name : ""}/></label>
      <label>Offer details<textarea name="description" required minLength={2} maxLength={400} defaultValue={action==="promo.edit" ? row.detail : ""}/></label>
      <p>Enter dates in your device’s local time zone.</p>
      <div className={styles.pair}><label>Starts<input name="startsAt" type="datetime-local" required defaultValue={localDate(row.startsAt)}/></label>
        <label>Ends<input name="endsAt" type="datetime-local" required defaultValue={localDate(row.endsAt)}/></label></div>
    </>}
    <label>Decision note<input name="reason" required minLength={3} maxLength={240} placeholder="Reason or evidence reference"/></label>
    {error && <p role="alert">{error}</p>}
    <div className={styles.actions}><button className="primary-button" disabled={busy}>{busy ? "Saving…" : labels[action]}</button>
      <button type="button" disabled={busy} onClick={onClose}>Cancel</button></div>
  </form>;
}
function RecordCard({section,row}: {section:OperatorSection;row:OperatorRow}) {
  const [action,setAction]=useState<Action | null>(null);
  const [saved,setSaved]=useState(false);
  const router=useRouter();
  return <article className={styles.record}>
    <header><div>{row.venueName && <small>{row.venueName}</small>}<h3>{section==="audit" && row.name in labels ? labels[row.name as Action] : row.name}</h3></div>
      {section!=="audit" && <span className={styles.state}>{row.state}</span>}</header>
    <p>{row.detail}</p>{row.context && <blockquote>{row.context}</blockquote>}
    {section==="venues" && <details><summary>Ownership and location</summary><p>{row.organisation} · {row.verified ? "Ownership verified" : "Ownership awaiting verification"}</p>
      {(row.contactEmail || row.contactPhone) && <p>{[row.contactEmail,row.contactPhone].filter(Boolean).join(" · ")}</p>}
      {row.latitude!=null && row.longitude!=null && <p>{row.latitude}, {row.longitude}</p>}</details>}
    {row.startsAt && row.endsAt && <small>{displayDate(row.startsAt)} to {displayDate(row.endsAt)} (Melbourne)</small>}
    {section==="audit" && row.at && <small>{displayDate(row.at)} (Melbourne)<br/>Operator {row.actor}<br/>Record {row.state}</small>}
    {saved && <p role="status" className={styles.saved}><ClipboardCheck size={16}/> Decision saved</p>}
    <div className={styles.actions}>{actions(section,row).map(value=><button key={value} type="button" aria-pressed={action===value}
      onClick={()=>{setSaved(false);setAction(value);}}>{labels[value]}</button>)}</div>
    {action && <DecisionForm key={action} row={row} action={action} onClose={()=>setAction(null)}
      onSaved={()=>{setSaved(true);setAction(null);router.refresh();}} />}
  </article>;
}
export function OperatorBoard({section,rows}: {section:OperatorSection;rows:OperatorRow[]}) {
  if (!rows.length) return <p className={styles.empty}>There are no records on this page.</p>;
  return <div className={styles.records}>{rows.map(row=><RecordCard key={row.id} section={section} row={row}/>)}</div>;
}
