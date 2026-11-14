import { parseCatalogueSearch } from "@/lib/catalogue";
import { searchPublicCatalogue } from "@/lib/catalogue-server";

export async function GET(request: Request) {
  const search = parseCatalogueSearch(new URL(request.url));
  // This endpoint is anonymous public data; no account cookies are used.
  const headers = { "Cache-Control": "no-store", "Access-Control-Allow-Origin": "*" };
  if (!search) return Response.json({ error: "Invalid or unsupported search parameters." }, { status: 400, headers });
  const catalogue = await searchPublicCatalogue(search);
  if (catalogue.status === "unavailable") return Response.json({
    mode: catalogue.mode, status: "unavailable", data: [], total: 0,
    error: "The venue catalogue is temporarily unavailable.",
  }, { status: 503, headers });
  return Response.json({ mode: catalogue.mode, status: "ready", data: catalogue.venues,
    total: catalogue.venues.length, hasMore: catalogue.hasMore }, { headers });
}
