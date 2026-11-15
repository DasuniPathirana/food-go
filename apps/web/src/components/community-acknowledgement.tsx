import { communityAcknowledgement } from "@/lib/community-policy-copy";
import styles from "./community-consent.module.css";

export function CommunityAcknowledgement() {
  return <div className={styles.wording}>{communityAcknowledgement.map(item => <section key={item.title}><h3>{item.title}</h3><p>{item.body}</p></section>)}</div>;
}
