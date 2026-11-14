"use client";
import { MapPin } from "lucide-react";
import type { Venue } from "@/lib/fixtures";

export function IllustratedMap({
  venues,
  selected,
  onSelect,
}: {
  venues: Venue[];
  selected?: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div
      className="illustrated-map"
      role="region"
      aria-label="Illustrative Melbourne discovery map, not a live navigation map"
    >
      <svg
        className="map-art"
        viewBox="0 0 800 540"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
      >
        <defs>
          <pattern
            id="blocks"
            width="100"
            height="90"
            patternTransform="rotate(-14)"
            patternUnits="userSpaceOnUse"
          >
            <rect width="100" height="90" fill="#f0eee4" />
            <rect
              x="9"
              y="9"
              width="79"
              height="67"
              rx="3"
              fill="#e9e7dc"
              stroke="#e0dfd2"
            />
            <path d="M0 84H100M94 0V90" stroke="#fffdf7" strokeWidth="10" />
          </pattern>
        </defs>
        <rect width="800" height="540" fill="url(#blocks)" />
        <path
          d="M-20 470C140 350 185 520 335 412S460 330 600 390 770 330 850 180"
          fill="none"
          stroke="#c3d8d6"
          strokeWidth="54"
        />
        <path
          d="M-30 235L820 15M135-20L390 560M-20 360L820 150"
          stroke="#fcfbf5"
          strokeWidth="18"
        />
        <path
          d="M-30 235L820 15M135-20L390 560"
          stroke="#e6d9af"
          strokeWidth="3"
        />
        <path
          d="M470 50l120-35 55 97-147 38zM76 257l97-28 36 111-106 23zM577 430l117-37 43 108-143 27z"
          fill="#d4dfc7"
        />
        <g fill="#68705e" fontSize="13" fontFamily="Arial" letterSpacing="2">
          <text x="330" y="117">
            CARLTON
          </text>
          <text x="561" y="211">
            FITZROY
          </text>
          <text x="191" y="332">
            MELBOURNE
          </text>
          <text x="483" y="505">
            SOUTHBANK
          </text>
        </g>
        <path
          d="M282 297Q382 178 579 197"
          stroke="#789779"
          strokeWidth="3"
          fill="none"
          strokeDasharray="5 7"
        />
      </svg>
      <span className="map-label">
        <span />
        Melbourne neighbourhoods
      </span>
      {venues.map((venue, index) => (
        <button
          key={venue.id}
          className={`map-marker marker-${venue.accent} ${selected === venue.id ? "selected" : ""}`}
          onClick={() => onSelect(venue.id)}
          aria-label={`View ${venue.name}`}
          aria-pressed={selected === venue.id}
        >
          <strong>{String(index + 1).padStart(2, "0")}</strong>
          <span>{venue.name}</span>
        </button>
      ))}
      <div className="map-disclaimer">
        <MapPin size={13} />
        Map illustration. Live location is not connected.
      </div>
    </div>
  );
}
