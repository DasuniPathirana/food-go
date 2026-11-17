import { z } from "zod";

export function sydneyToday(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-AU", { timeZone: "Australia/Sydney", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find(part => part.type === type)!.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}
function calendarDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}
function yearsBefore(today: string, years: number) {
  const [year, month, day] = today.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year - years, month, 0)).getUTCDate();
  return `${year - years}-${String(month).padStart(2, "0")}-${String(Math.min(day, lastDay)).padStart(2, "0")}`;
}
export function isValidBirthDate(value: string, today = sydneyToday()) {
  return calendarDate(value) && value <= today && value >= yearsBefore(today, 120);
}
export const birthDateSchema = z.string().length(10).refine(value => isValidBirthDate(value),
  "Enter a valid date of birth within the past 120 years.");
export const recordBirthDateSchema = z.strictObject({ birthDate: birthDateSchema });
export const ageStatusSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("unknown"), feedEligible: z.literal(false) }),
  z.object({ status: z.literal("under16"), feedEligible: z.literal(false) }),
  z.object({ status: z.literal("eligible"), feedEligible: z.literal(true) }),
]);
export type AgeStatus = z.infer<typeof ageStatusSchema>;

/** Presentation/test helper only. The database independently decides Feed access. */
export function ageStatusForBirthDate(birthDate: string | null, today = sydneyToday()): AgeStatus {
  if (!birthDate || !calendarDate(birthDate) || birthDate > today) return { status: "unknown", feedEligible: false };
  return birthDate <= yearsBefore(today, 16) ? { status: "eligible", feedEligible: true } : { status: "under16", feedEligible: false };
}
