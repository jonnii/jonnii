"use client";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useEffect, useState, type CSSProperties } from "react";
import { SOCIALS } from "./content";
import { THEMES } from "../registry";
import styles from "./taskbar.module.css";

// The shared Win95 taskbar: a Start button whose menu lists the themes (the
// active one ticked), the socials and a shuffle entry; an app button; and a
// system tray with the social icons and a live clock. Used by every
// Win95-flavoured design so there's one Start menu, not one per theme.

function trayGlyph(label: string): string {
  if (label === "LinkedIn") return "in";
  if (label === "GitHub") return "gh";
  if (label.startsWith("X")) return "x";
  return label.slice(0, 2).toLowerCase();
}

function trayBrandColor(label: string): string {
  if (label === "LinkedIn") return "#0a66c2";
  if (label === "GitHub") return "#181717";
  if (label.startsWith("X")) return "#000000";
  return "#000000";
}

interface TaskbarProps {
  /** Id of the active theme, ticked in the Start menu. */
  themeId: string;
  /** Label shown on the app button. */
  appLabel: string;
  /** Which small icon to show on the app button. */
  iconVariant?: "grid" | "card";
  /** Optional click handler for the app button (e.g. restore a dialog). */
  onAppClick?: () => void;
}

function AppIcon({ variant }: { variant: "grid" | "card" }) {
  if (variant === "card") {
    return (
      <span className={styles.cardIcon} aria-hidden="true">
        <b>A</b>
        <i>♠</i>
      </span>
    );
  }
  return (
    <span className={styles.gridIcon} aria-hidden="true">
      <span />
      <span />
      <span />
      <span />
    </span>
  );
}

export default function Taskbar({
  themeId,
  appLabel,
  iconVariant = "grid",
  onAppClick,
}: TaskbarProps) {
  const [clock, setClock] = useState("");
  const [startOpen, setStartOpen] = useState(false);

  // Live taskbar clock — client-only mount, so no hydration mismatch.
  useEffect(() => {
    const tick = () =>
      setClock(
        new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
      );
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  // Close the Start menu on Escape.
  useEffect(() => {
    if (!startOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setStartOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [startOpen]);

  return (
    <footer className={styles.taskbar}>
      <div className={styles.startWrap}>
        {startOpen && (
          <>
            <div className={styles.startOverlay} onClick={() => setStartOpen(false)} />
            <div className={styles.startMenu} role="menu">
              <div className={styles.startBanner} aria-hidden="true">
                <span>
                  jonnii<b>95</b>
                </span>
              </div>
              <div className={styles.startList}>
                <div className={styles.startSection}>Themes</div>
                {THEMES.map((t) => (
                  <a
                    key={t.id}
                    href={`?theme=${t.id}`}
                    className={styles.startItem}
                    role="menuitem"
                    aria-current={t.id === themeId ? "true" : undefined}
                  >
                    <span className={styles.startBullet} aria-hidden="true">
                      {t.id === themeId ? "●" : "○"}
                    </span>
                    {t.label}
                  </a>
                ))}

                <div className={styles.startSep} />

                <div className={styles.startSection}>Find me</div>
                {SOCIALS.map((social) => (
                  <a
                    key={social.label}
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.startItem}
                    role="menuitem"
                  >
                    <span className={styles.startItemIcon} aria-hidden="true">
                      {trayGlyph(social.label)}
                    </span>
                    {social.label}
                  </a>
                ))}

                <div className={styles.startSep} />

                <a href="/" className={styles.startItem} role="menuitem">
                  <span
                    className={`${styles.startItemIcon} ${styles.startItemSymbol}`}
                    aria-hidden="true"
                  >
                    ⟳
                  </span>
                  Shuffle theme…
                </a>
              </div>
            </div>
          </>
        )}
        <button
          type="button"
          className={`${styles.start} ${styles.raised} ${
            startOpen ? styles.startPressed : ""
          }`}
          onClick={() => setStartOpen((o) => !o)}
          aria-haspopup="menu"
          aria-expanded={startOpen}
        >
          <span className={styles.startFlag} aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
          </span>
          Start
        </button>
      </div>

      <button
        type="button"
        className={`${styles.taskApp} ${styles.raised}`}
        onClick={onAppClick}
      >
        <AppIcon variant={iconVariant} />
        <span className={styles.taskAppText}>{appLabel}</span>
      </button>

      <div className={`${styles.tray} ${styles.sunken}`}>
        <nav className={styles.trayLinks} aria-label="social links">
          {SOCIALS.map((social) => (
            <a
              key={social.label}
              className={styles.trayLink}
              href={social.href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={social.label}
              style={{ ["--tray-brand"]: trayBrandColor(social.label) } as CSSProperties}
            >
              <FontAwesomeIcon className={styles.trayIcon} icon={social.icon} />
            </a>
          ))}
        </nav>
        <span className={styles.clock} suppressHydrationWarning>
          {clock}
        </span>
      </div>
    </footer>
  );
}
