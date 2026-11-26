import Link from "next/link";
import { BookOpen, Compass, Flag, Mountain, Store, Ticket } from "lucide-react";
import styles from "./food-navigation.module.css";

const destinations = [
  { id: "feed", title: "Feed", icon: BookOpen, path: "/feed", hasBadge: false },
  { id: "deals", title: "Deals", icon: Ticket, path: "/deals", hasBadge: false },
  { id: "explore", title: "Explore", icon: Compass, path: "/", hasBadge: false },
  { id: "quests", title: "Quests", icon: Flag, path: "/quests", hasBadge: true },
  { id: "outback", title: "Outback", icon: Mountain, path: "/outback", hasBadge: false },
] as const;

export function FoodNavigation({ pathname, mobile = false, owner = false }: {
  pathname: string;
  mobile?: boolean;
  demo?: boolean;
  owner?: boolean;
}) {
  const label = mobile ? "Mobile navigation" : "Main navigation";
  const navItems = owner ? [
    { id: "restaurants", title: "Restaurants", path: "/partner/dashboard", icon: Store, hasBadge: false },
    { id: "new-venue", title: "Add venue", path: "/partner/onboarding", icon: BookOpen, hasBadge: false },
    { id: "explore", title: "Explore", path: "/", icon: Compass, hasBadge: false },
    { id: "passport", title: "Passport", path: "/profile", icon: BookOpen, hasBadge: false },
    { id: "help", title: "Help", path: "/help", icon: Ticket, hasBadge: false },
  ] : destinations;

  return (
    <nav className={mobile ? styles.dock : styles.directory} aria-label={label}>
      {navItems.map(({ id, title, path, icon: Icon, hasBadge }) => {
        const href = path;
        const exact = pathname === href;
        const inSection = id === "explore" && /^\/venues\//.test(pathname);
        const isActive = exact || inSection;

        return (
          <Link
            key={id}
            href={href}
            data-section={id}
            data-active={isActive ? "true" : undefined}
            aria-current={exact ? "page" : inSection ? "location" : undefined}
            className={`${styles.navItem} ${isActive ? styles.activeItem : ""} ${id === "explore" ? styles.explore : ""}`}
          >
            {isActive ? (
              <span className={styles.activeHexagon}>
                <Icon aria-hidden="true" size={22} strokeWidth={2.2} />
              </span>
            ) : (
              <span className={styles.iconWrapper}>
                <Icon aria-hidden="true" size={20} strokeWidth={1.9} />
                {hasBadge && <span className={styles.badgeDot} aria-hidden="true" />}
              </span>
            )}
            <span className={styles.label}>{title}</span>
          </Link>
        );
      })}
    </nav>
  );
}
