import Link from "next/link";
import { BookOpen, Compass, MessagesSquare, Store, Ticket } from "lucide-react";
import styles from "./food-navigation.module.css";

const destinations = [
  { id: "feed", title: "Feed", icon: MessagesSquare, path: "/feed" },
  { id: "food-dex", title: "FoodDex", icon: BookOpen, path: "/food-dex" },
  { id: "explore", title: "Explore", icon: Compass, path: "/" },
  { id: "venue-dex", title: "VenueDex", icon: Store, path: "/venue-dex" },
  { id: "deals", title: "Deals", icon: Ticket, path: "/deals" },
] as const;

export function FoodNavigation({ pathname, mobile = false, demo = false }: {
  pathname: string;
  mobile?: boolean;
  demo?: boolean;
}) {
  const label = demo ? (mobile ? "Demo mobile navigation" : "Demo navigation") : (mobile ? "Mobile navigation" : "Main navigation");
  return (
    <nav className={mobile ? styles.dock : styles.directory} aria-label={label}>
      {destinations.map(({ id, title, path, icon: Icon }) => {
        const href = demo ? `/demo/${id}` : path;
        const exact = pathname === href || (id === "explore" && pathname === "/demo");
        const inSection = id === "explore" && /^\/(demo\/venue\/|explore-preview(?:\/|$)|venues\/)/.test(pathname)
          || id === "feed" && pathname === "/feed-preview";
        return (
          <Link key={id} href={href} aria-current={exact ? "page" : inSection ? "location" : undefined}
            className={id === "explore" ? styles.explore : undefined}>
            <Icon aria-hidden="true" size={19} strokeWidth={1.9} />
            <span>{title}</span>
          </Link>
        );
      })}
    </nav>
  );
}
