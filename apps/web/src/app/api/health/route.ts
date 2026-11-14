export function GET() {
  return Response.json(
    { status: "ok", mode: "foundation-preview" },
    { headers: { "Cache-Control": "no-store" } },
  );
}
