import Link from "next/link";
import styles from "./projectsFolder.module.css";

// A "Projects" folder on the Win95 desktop that opens the projects page.
// Rendered by the shared taskbar, so every Win95-flavoured theme gets it.

export default function ProjectsFolder() {
  return (
    <Link className={styles.desktopIcon} href="/projects">
      <span className={styles.bigFolder} aria-hidden="true" />
      <span className={styles.iconLabel}>Projects</span>
    </Link>
  );
}
