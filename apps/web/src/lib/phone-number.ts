/** Australian mobile number in the provider's normalised international format. */
export function australianMobile(value: unknown): string | null {
  if (typeof value !== "string") return null;
  if (/^\+?614\d{8}$/u.test(value)) return value.replace(/^\+/u, "");
  if (/^04\d{8}$/u.test(value)) return `61${value.slice(1)}`;
  return null;
}
