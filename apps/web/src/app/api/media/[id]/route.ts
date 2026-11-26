import { z } from "zod";
import { publicCatalogueClient, readCatalogueConfig } from "@/lib/catalogue";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success) {
    return new Response("Not found", { status: 404 });
  }
  const config = readCatalogueConfig(process.env);
  if (config.mode !== "supabase" || !config.configured) {
    return new Response("Unavailable", { status: 503 });
  }
  try {
    const { data, error } = await publicCatalogueClient(config)
      .rpc("food_go_read_media", { p_id: id })
      .abortSignal(AbortSignal.timeout(8000));
    if (error || !data || typeof data !== "object") {
      return new Response("Not found", { status: 404 });
    }
    const payload = data as { contentType?: string; base64?: string };
    if (!payload.contentType || !payload.base64) {
      return new Response("Not found", { status: 404 });
    }
    const bytes = Buffer.from(payload.base64, "base64");
    return new Response(bytes, {
      status: 200,
      headers: {
        "Content-Type": payload.contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Unavailable", { status: 503 });
  }
}
