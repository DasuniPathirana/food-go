import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";

// This proxy supplies browser defence headers. It is not an authentication gate.
// Every future privileged route must validate its session and permissions itself.
export function proxy(request: NextRequest) {
  const isDevelopment = process.env.NODE_ENV === "development";
  const isApi =
    request.nextUrl.pathname === "/api" ||
    request.nextUrl.pathname.startsWith("/api/");
  const requestHeaders = new Headers(request.headers);
  requestHeaders.delete("x-nonce");

  let contentSecurityPolicy: string;
  if (isApi) {
    // JSON endpoints do not render scripts or require a nonce.
    contentSecurityPolicy = [
      "default-src 'none'",
      "base-uri 'none'",
      "form-action 'none'",
      "frame-ancestors 'none'",
      "object-src 'none'",
    ].join("; ");
  } else {
    const nonce = randomBytes(32).toString("base64");
    requestHeaders.set("x-nonce", nonce);
    contentSecurityPolicy = [
      "default-src 'self'",
      `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDevelopment ? " 'unsafe-eval'" : ""}`,
      // React style properties and the current responsive components use inline CSS.
      // This exception does not permit inline JavaScript or event handlers.
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self'",
      `connect-src 'self'${isDevelopment ? " ws://127.0.0.1:* ws://localhost:* wss://127.0.0.1:* wss://localhost:*" : ""}`,
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "frame-src 'none'",
      "worker-src 'self'",
      "manifest-src 'self'",
    ].join("; ");
  }

  // Next reads this request CSP and applies the nonce to its framework scripts.
  // Forwarding only x-nonce would leave those scripts blocked by the response CSP.
  requestHeaders.set("Content-Security-Policy", contentSecurityPolicy);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", contentSecurityPolicy);

  // Do not teach browsers HSTS from the local HTTP preview. Subdomains and preload
  // require a separate deployment-wide decision and are deliberately not asserted.
  if (
    process.env.NODE_ENV === "production" &&
    request.nextUrl.protocol === "https:"
  ) {
    response.headers.set("Strict-Transport-Security", "max-age=31536000");
  }
  return response;
}

export const config = {
  // Include API and prefetched route requests. The common security headers in
  // next.config.ts also cover these excluded static resources.
  matcher: [
    "/((?!_next/static|_next/image|images/|fonts/|favicon.ico|icon.svg).*)",
  ],
};
