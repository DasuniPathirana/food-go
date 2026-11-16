import { readCatalogueConfig } from "@/lib/catalogue";

export function GET() {
  return Response.json(
    { status: "ok", mode: readCatalogueConfig(process.env).mode },
    { headers: { "Cache-Control": "no-store" } },
  );
}
