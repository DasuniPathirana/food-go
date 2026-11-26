import { Suspense } from "react";
import { GeographicExplore } from "@/components/geographic-explore";

export default function HomePage() {
  return (
    <Suspense fallback={<p className="shell-main">Loading Melbourne 3D Explore...</p>}>
      <GeographicExplore />
    </Suspense>
  );
}
