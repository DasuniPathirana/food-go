/** Exact allow-list comparison. Never derive write permissions from forwarded headers. */
export function isAllowedWriteOrigin(
  origin: string | null,
  configuredOrigin: string | undefined,
  fetchSite?: string | null,
) {
  if (!origin || !configuredOrigin || fetchSite === "cross-site") return false;
  try {
    const expected = new URL(configuredOrigin);
    const actual = new URL(origin);
    return (
      ["https:", "http:"].includes(expected.protocol) &&
      expected.origin === actual.origin &&
      origin === actual.origin
    );
  } catch {
    return false;
  }
}
