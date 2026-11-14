import Link from "next/link";
import { Compass, ArrowRight } from "lucide-react";
export default function NotFound() {
  return (
    <div className="empty-state page-empty">
      <Compass size={36} />
      <div className="eyebrow">A LITTLE OFF THE MAP</div>
      <h1>This discovery is still out there.</h1>
      <p>
        We could not find that page. Your next food adventure is a good place to
        start.
      </p>
      <Link href="/" className="primary-button">
        Back to exploring
        <ArrowRight size={16} />
      </Link>
    </div>
  );
}
