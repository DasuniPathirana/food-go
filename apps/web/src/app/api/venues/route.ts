import { venueSearchSchema } from "@food-go/domain";
import { venues } from "@/lib/fixtures";

export function GET(request: Request) {
  const url = new URL(request.url);
  if (url.search.length > 2048)
    return Response.json({ error: "Search is too long." }, { status: 400 });
  const allowed = new Set(["q", "state", "venueType", "limit"]);
  if ([...url.searchParams.keys()].some((key) => !allowed.has(key)))
    return Response.json(
      { error: "Unsupported search parameter." },
      { status: 400 },
    );
  const result = venueSearchSchema.safeParse({
    query: url.searchParams.get("q") || "",
    state: url.searchParams.get("state") || undefined,
    venueType: url.searchParams.get("venueType") || undefined,
    limit: url.searchParams.get("limit") || 20,
  });
  if (!result.success)
    return Response.json(
      { error: "Invalid search parameters." },
      { status: 400 },
    );
  const { query, state, venueType, limit } = result.data;
  const data = venues
    .filter(
      (venue) =>
        (!state || state === "VIC") &&
        (!venueType || venue.type === venueType) &&
        `${venue.name} ${venue.suburb} ${venue.cuisine} ${venue.dish}`
          .toLowerCase()
          .includes(query.toLowerCase()),
    )
    .slice(0, limit);
  return Response.json(
    { mode: "demo", data, total: data.length },
    { headers: { "Cache-Control": "no-store" } },
  );
}
