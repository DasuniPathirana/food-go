import { isAllowedWriteOrigin } from "@/lib/request-guards";

/** Deliberately closed until authenticated, verified server onboarding is complete. */
export function POST(request: Request) {
  if (
    !isAllowedWriteOrigin(
      request.headers.get("origin"),
      process.env.APP_ORIGIN,
      request.headers.get("sec-fetch-site"),
    )
  ) {
    return Response.json(
      { error: "Request origin is not allowed." },
      { status: 403, headers: { "Cache-Control": "no-store" } },
    );
  }
  return Response.json(
    { error: "Venue registration is not enabled in this preview." },
    { status: 503, headers: { "Cache-Control": "no-store" } },
  );
}
