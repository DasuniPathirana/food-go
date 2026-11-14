import { z } from "zod";
import { getCatalogueMode, getSavedPublicCatalogue } from "@/lib/catalogue-server";

/** Anonymous catalogue lookup, not an account collection or write endpoint. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const headers = { "Cache-Control": "no-store", "Access-Control-Allow-Origin": "*" };
  const kind = url.searchParams.get("kind");
  const ids = url.searchParams.get("ids")?.split(",") || [];
  if (url.search.length > 2500 || [...url.searchParams.keys()].some((key) => !["kind", "ids"].includes(key) || url.searchParams.getAll(key).length !== 1) ||
    !["venue", "dish"].includes(kind || "") || !ids.length || !z.array(z.uuid()).max(50).safeParse(ids).success) {
    return Response.json({ error: "Invalid collection lookup." }, { status: 400, headers });
  }
  if (getCatalogueMode() !== "supabase") return Response.json({ error: "Connected catalogue is not enabled." }, { status: 503, headers });
  const catalogue = await getSavedPublicCatalogue(kind as "venue" | "dish", ids);
  return Response.json(catalogue, { status: catalogue.status === "ready" ? 200 : 503, headers });
}
