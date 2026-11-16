import { z } from "zod";
import type { MapSearchResult } from "./map-services";

const attribution = "Place search by MapTiler | OpenStreetMap contributors";
const unavailable = "World search is temporarily unavailable. You can enter latitude, longitude.";
const maximumBytes = 2_000_000;
const coordinate = z.tuple([z.number().finite().min(-180).max(180), z.number().finite().min(-90).max(90)]);
const geocoding = z.object({ features: z.array(z.object({
  id: z.union([z.string().max(200), z.number().finite()]).optional(),
  geometry: z.object({ type: z.literal("Point"), coordinates: coordinate }),
  place_name: z.string().trim().min(1).max(500),
  bbox: z.tuple([z.number().finite(), z.number().finite(), z.number().finite(), z.number().finite()]).optional(),
})).max(6) });

function cancelled() { return new DOMException("Place search cancelled.", "AbortError"); }

async function boundedJson(response: Response, signal: AbortSignal) {
  if (Number(response.headers.get("content-length")) > maximumBytes) {
    await response.body?.cancel();
    throw new Error(unavailable);
  }
  const reader = response.body?.getReader();
  if (!reader) throw new Error(unavailable);
  const chunks: Uint8Array[] = [];
  let length = 0;
  const abort = () => { void reader.cancel().catch(() => {}); };
  signal.addEventListener("abort", abort, { once: true });
  try {
    while (true) {
      if (signal.aborted) { await reader.cancel(); throw cancelled(); }
      const chunk = await reader.read();
      if (signal.aborted) throw cancelled();
      if (chunk.done) break;
      length += chunk.value.byteLength;
      if (length > maximumBytes) { await reader.cancel(); throw new Error(unavailable); }
      chunks.push(chunk.value);
    }
  } finally {
    signal.removeEventListener("abort", abort);
    reader.releaseLock();
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as unknown;
}

/** Uses the browser's allowed origin with its public map key. Never send this key to the server adapter. */
export async function searchBrowserMapPlaces(
  query: string, key: string, signal?: AbortSignal, fetcher: typeof fetch = fetch,
): Promise<{ results: MapSearchResult[]; attribution: string }> {
  const text = query.trim(), browserKey = key.trim();
  if (text.length < 2 || text.length > 120 || /[\u0000-\u001f\u007f]/u.test(text))
    throw new Error("Enter a place name between 2 and 120 characters.");
  if (!browserKey || browserKey.length > 512 || /[\u0000-\u001f\u007f]/u.test(browserKey)) throw new Error(unavailable);
  if (signal?.aborted) throw cancelled();
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(abort, 12_000);
  let status: number | undefined;
  try {
    const url = new URL("https://api.maptiler.com/geocoding/" + encodeURIComponent(text) + ".json");
    url.search = new URLSearchParams({ key: browserKey, limit: "6", language: "en", autocomplete: "false" }).toString();
    const response = await fetcher(url, {
      method: "GET", mode: "cors", credentials: "omit", cache: "no-store", redirect: "error",
      signal: controller.signal, headers: { Accept: "application/json" },
    });
    status = response.status;
    if (!response.ok) { await response.body?.cancel(); throw new Error(unavailable); }
    const parsed = geocoding.safeParse(await boundedJson(response, controller.signal));
    if (!parsed.success) throw new Error(unavailable);
    const results = parsed.data.features.map((feature, index): MapSearchResult => {
      const [longitude, latitude] = feature.geometry.coordinates, box = feature.bbox;
      const bounds = box && box[0] >= -180 && box[2] <= 180 && box[1] >= -90 && box[3] <= 90
        && box[0] <= box[2] && box[1] <= box[3] ? box : undefined;
      return { id: `maptiler-${feature.id ?? index}-${longitude}-${latitude}`, name: feature.place_name,
        longitude, latitude, ...(bounds && { bounds }) };
    });
    return { results, attribution };
  } catch {
    if (signal?.aborted) throw cancelled();
    if (status === 429) throw new Error("Search is busy. Wait a moment and submit again.");
    if (status === 403) throw new Error("Place search is unavailable for this website. You can enter latitude, longitude.");
    throw new Error(unavailable);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", abort);
  }
}
