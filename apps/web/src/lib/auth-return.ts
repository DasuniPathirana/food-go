const destinations = ["/profile", "/admin", "/partner/dashboard", "/collect", "/quests", "/outback", "/deals", "/feed", "/inventory", "/encounters"] as const;
export type SignInDestination = (typeof destinations)[number];
export function signInDestination(value: unknown): SignInDestination | undefined {
  return typeof value === "string" && destinations.includes(value as SignInDestination) ? value as SignInDestination : undefined;
}
