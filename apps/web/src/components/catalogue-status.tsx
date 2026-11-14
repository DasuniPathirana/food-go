"use client";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { RotateCcw, ShieldCheck } from "lucide-react";
import type { CatalogueState } from "@/lib/catalogue-contracts";

export function CatalogueStatus({ catalogue }: { catalogue: CatalogueState }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  if (catalogue.status === "unavailable") return (
    <div className="empty-state" role="status">
      <ShieldCheck size={28} />
      <h2>Places are temporarily unavailable</h2>
      <p>We could not load the venue catalogue. Your saved places are still kept on this browser. Please try again shortly.</p>
      <button className="primary-button" disabled={pending} onClick={() => startTransition(() => router.refresh())}>
        <RotateCcw size={16} /> {pending ? "Trying again…" : "Try again"}
      </button>
    </div>
  );
  return <p className="inline-notice"><ShieldCheck size={18} />
    {catalogue.mode === "demo"
      ? "Example catalogue. All venues and dishes are fictional. Saves stay on this browser."
      : "Published venue catalogue. Saves stay on this browser. Live maps and verified check-ins are not connected."}
  </p>;
}
