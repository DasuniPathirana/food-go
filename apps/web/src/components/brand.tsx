import { Compass } from "lucide-react";
export function Brand({ light = false }: { light?: boolean }) {
  return (
    <span className={`brand ${light ? "brand-light" : ""}`}>
      <span className="brand-icon">
        <Compass size={25} strokeWidth={1.8} />
      </span>
      <span>
        food<span className="brand-go">go</span>
        <span className="brand-dot">.</span>
      </span>
    </span>
  );
}
