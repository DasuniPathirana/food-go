import { Utensils } from "lucide-react";

export function Brand({ light = false }: { light?: boolean }) {
  return (
    <span className={`brand ${light ? "brand-light" : ""}`}>
      <span className="brand-icon" aria-hidden="true">
        <Utensils size={16} strokeWidth={2.5} />
      </span>
      <span>
        food<span className="brand-go">go</span>
        <span className="brand-dot">.</span>
      </span>
    </span>
  );
}
