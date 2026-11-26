import { loadLiveMalls, loadVenueAppearances, loadWorldLoots } from "@/lib/world-server";

export async function GET() {
  const [malls, lootsState, appearances] = await Promise.all([
    loadLiveMalls(),
    loadWorldLoots(),
    loadVenueAppearances(),
  ]);
  return Response.json(
    {
      ok: true,
      serverNow: lootsState.serverNow,
      malls,
      loots: lootsState.loots,
      myClaims: lootsState.myClaims,
      appearances,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
