import css from "./map-place-marker.module.css";
import type { EncounterSignal } from "@/lib/encounter-landmarks";

export type MapPlaceMarker = {
  id?: string; members?: readonly { id: string }[];
  name: string;
  image?: string;
  kind?: "cafe" | "restaurant" | "market" | "building";
  shopCount?: number;
};

export function updateMapPlaceEncounter(button: HTMLButtonElement, place: MapPlaceMarker, signals: Readonly<Record<string, EncounterSignal>>) {
  const states = (place.members?.map(member => member.id) ?? (place.id ? [place.id] : [])).map(id => signals[id]);
  const state = states.includes("nearby") ? "nearby" : states.includes("available") ? "available" : "none";
  button.dataset.encounter = state;
  const count = place.shopCount && place.shopCount > 1 ? `, ${place.shopCount} shops` : "";
  button.setAttribute("aria-label", `Explore ${place.name}${count}${state === "nearby" ? ", restaurant encounter nearby" : state === "available" ? ", restaurant encounter available" : ""}`);
}

const iconPaths = {
  cafe: ["M5 8h11v7a5 5 0 0 1-10 0V8Z", "M16 9h2a3 3 0 0 1 0 6h-2", "M8 3v2m4-2v2M4 21h15"],
  restaurant: ["M6 3v6m-3-6v6a3 3 0 0 0 6 0V3M6 12v9", "M19 3c-3 2-4 5-4 9h4m0-9v18"],
  market: ["M3 9h18l-2-6H5L3 9Z", "M4 9v11h16V9M8 20v-7h8v7M3 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0"],
  building: ["M5 21V7h14v14M8 7V3h8v4M2 21h20", "M9 11h1m4 0h1m-6 4h1m4 0h1m-5 6v-3h2v3"],
};

function icon(kind: MapPlaceMarker["kind"]) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "1.8");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");
  for (const d of iconPaths[kind || "restaurant"]) {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", d);
    svg.append(path);
  }
  return svg;
}

function photoSource(image: string | undefined) {
  if (!image || image === "/images/venue-placeholder.svg") return null;
  if (image.startsWith("/") && !image.startsWith("//") && !image.includes("\\")) return image;
  try {
    const url = new URL(image);
    return url.protocol === "https:" && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

/** The map engine owns positioning and click handlers; aria-pressed controls selection. */
export function createMapPlaceMarker(place: MapPlaceMarker): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = css.marker;
  button.dataset.mapMarker = "";
  button.dataset.kind = place.kind || "restaurant";
  button.setAttribute("aria-pressed", "false");
  const count = Number.isSafeInteger(place.shopCount) && place.shopCount! > 1 ? place.shopCount! : null;
  button.setAttribute("aria-label", `Explore ${place.name}${count ? `, ${count} shops` : ""}`);
  button.title = place.name;

  const face = document.createElement("span");
  face.className = css.face;
  face.setAttribute("aria-hidden", "true");
  const shop = document.createElement("span");
  shop.className = css.shop;
  shop.append(icon(place.kind));
  face.append(shop);

  const source = count ? null : photoSource(place.image);
  if (source) {
    const photo = document.createElement("img");
    photo.className = css.photo;
    photo.alt = "";
    photo.draggable = false;
    photo.loading = "lazy";
    photo.decoding = "async";
    photo.referrerPolicy = "no-referrer";
    photo.addEventListener("error", () => photo.remove(), { once: true });
    photo.src = source;
    face.append(photo);
  }
  button.append(face);

  if (count) {
    const shops = document.createElement("span");
    shops.className = css.count;
    shops.setAttribute("aria-hidden", "true");
    shops.textContent = `${count} shops`;
    button.append(shops);
  }
  const label = document.createElement("span");
  label.className = css.label;
  label.setAttribute("aria-hidden", "true");
  label.textContent = place.name;
  button.append(label);
  return button;
}
