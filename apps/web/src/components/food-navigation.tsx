import Link from "next/link";
import { BookOpen, Compass, Flag, MessagesSquare, Sprout, Store, Ticket, UserRound } from "lucide-react";
import styles from "./food-navigation.module.css";

const destinations = [
  { id: "feed", title: "Feed", icon: MessagesSquare, path: "/feed" },
  { id: "quests", title: "Quests", icon: Flag, path: "/quests" },
  { id: "explore", title: "Explore", icon: Compass, path: "/" },
  { id: "deals", title: "Deals", icon: Ticket, path: "/deals" },
  { id: "outback", title: "Outback", icon: Sprout, path: "/outback" },
] as const;

export function FoodNavigation({ pathname, mobile = false, demo = false, owner = false, feedEligible = false }: {
  pathname: string;
  mobile?: boolean;
  demo?: boolean;
  owner?: boolean;
  feedEligible?: boolean;
}) {
  const label = demo ? (mobile ? "Demo mobile navigation" : "Demo navigation") : (mobile ? "Mobile navigation" : "Main navigation");
  return (
    <nav className={mobile ? styles.dock : styles.directory} aria-label={label}>
      {(owner ? [
        { id: "restaurants", title: "Restaurants", path: "/partner/dashboard", icon: Store },
        { id: "new-venue", title: "Add venue", path: "/partner/onboarding", icon: BookOpen },
        { id: "explore", title: "Explore", path: "/", icon: Compass },
        { id: "passport", title: "Passport", path: "/profile", icon: MessagesSquare },
        { id: "help", title: "Help", path: "/help", icon: Ticket },
      ] : destinations.map(item => item.id === "feed" && !feedEligible && !demo ? { id: "passport", title: "Passport", path: "/profile", icon: UserRound } : item)).map(({ id, title, path, icon: Icon }) => {
        const href = demo ? `/demo/${id}` : path;
        const exact = pathname === href || (id === "explore" && pathname === "/demo");
        const inSection = id === "explore" && /^\/(demo\/venue\/|explore-preview(?:\/|$)|venues\/)/.test(pathname)
          || id === "feed" && pathname === "/feed-preview";
        return (
          <Link key={id} href={href} data-section={id} aria-current={exact ? "page" : inSection ? "location" : undefined}
            className={id === "explore" ? styles.explore : undefined}>
            <Icon aria-hidden="true" size={19} strokeWidth={1.9} />
            <span>{title}</span>
          </Link>
        );
      })}
    </nav>
  );
}
