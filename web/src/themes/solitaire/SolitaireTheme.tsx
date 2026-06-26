"use client";
import styles from "./solitaire.module.css";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { WORD, SSH_COMMAND, SOCIALS, COPY_FEEDBACK_MS } from "../shared/content";
import CardCascade from "./CardCascade";
import Taskbar from "../shared/Taskbar";

const THEME_ID = "solitaire";

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

export default function SolitaireTheme() {
  const [copied, setCopied] = useState(false);
  const [gameOpen, setGameOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(true);
  // Bumping this remounts the cascade, dealing a fresh, cleared board.
  const [dealNonce, setDealNonce] = useState(0);
  const copyResetRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (copyResetRef.current !== null) window.clearTimeout(copyResetRef.current);
    };
  }, []);

  // Close the Game menu on Escape.
  useEffect(() => {
    if (!gameOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setGameOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [gameOpen]);

  const handleCopy = () => {
    navigator.clipboard.writeText(SSH_COMMAND);
    setCopied(true);
    if (copyResetRef.current !== null) window.clearTimeout(copyResetRef.current);
    copyResetRef.current = window.setTimeout(() => setCopied(false), COPY_FEEDBACK_MS);
  };

  const deal = () => {
    setDealNonce((n) => n + 1);
    setDialogOpen(true);
    setGameOpen(false);
  };

  return (
    <main className={styles.desktop}>
      <section className={`${styles.window} ${styles.raised}`}>
        {/* Title bar */}
        <div className={styles.titlebar}>
          <span className={styles.titleIcon} aria-hidden="true">
            <b>A</b>
            <i>♠</i>
          </span>
          <span className={styles.titleText}>Solitaire — {WORD}</span>
          <span className={styles.titleButtons} aria-hidden="true">
            <span className={`${styles.titleBtn} ${styles.raised}`}>
              <span className={styles.titleGlyphMin}>_</span>
            </span>
            <span className={`${styles.titleBtn} ${styles.raised}`}>&#9633;</span>
            <span className={`${styles.titleBtn} ${styles.raised}`}>&#10005;</span>
          </span>
        </div>

        {/* Menu bar — Game holds Deal/Exit; theme switching lives in Start. */}
        <nav className={styles.menubar}>
          <div className={styles.menuWrap}>
            <button
              type="button"
              className={`${styles.menuItem} ${gameOpen ? styles.menuItemOpen : ""}`}
              onClick={() => setGameOpen((o) => !o)}
              aria-haspopup="menu"
              aria-expanded={gameOpen}
            >
              <u>G</u>ame
            </button>
            {gameOpen && (
              <>
                <div className={styles.menuOverlay} onClick={() => setGameOpen(false)} />
                <div className={styles.menu} role="menu">
                  <button type="button" className={styles.menuRow} role="menuitem" onClick={deal}>
                    <span className={styles.menuKey}>Deal</span>
                    <span className={styles.menuAccel}>F2</span>
                  </button>
                  <div className={styles.menuSep} />
                  <a href="/" className={styles.menuRow} role="menuitem">
                    <span className={styles.menuKey}>Exit</span>
                    <span className={styles.menuAccel}>Alt+F4</span>
                  </a>
                </div>
              </>
            )}
          </div>
          <span className={styles.menuItem} aria-hidden="true">
            <u>H</u>elp
          </span>
        </nav>

        {/* Felt play area — the cascade fills it; the dialog floats on top. */}
        <div className={styles.play}>
          <CardCascade key={dealNonce} onDeal={() => setDealNonce((n) => n + 1)} />

          {dialogOpen ? (
            <div
              className={`${styles.dialog} ${styles.raised}`}
              role="dialog"
              aria-label="Congratulations, you win"
              data-no-deal
            >
              <div className={styles.dialogTitle}>
                <span className={styles.dialogTitleText}>
                  <span aria-hidden="true">♦</span> Congratulations
                </span>
                <button
                  type="button"
                  className={`${styles.titleBtn} ${styles.raised}`}
                  onClick={() => setDialogOpen(false)}
                  aria-label="Close"
                >
                  &#10005;
                </button>
              </div>

              <div className={styles.dialogBody}>
                <h1 className={styles.wordmark}>{WORD}</h1>
                <div className={styles.pips} aria-hidden="true">
                  <span className={styles.red}>♥</span>
                  <span>♠</span>
                  <span className={styles.red}>♦</span>
                  <span>♣</span>
                </div>
                <p className={styles.blurb}>You win. Now come say hello.</p>

                <div className={styles.sshRow}>
                  <span className={styles.sshLabel}>Connect:</span>
                  <code className={`${styles.sshField} ${styles.sunken}`}>{SSH_COMMAND}</code>
                  <button
                    type="button"
                    className={`${styles.btn} ${styles.raised}`}
                    onClick={handleCopy}
                    title="Copy to clipboard"
                  >
                    {copied ? "Copied" : "Copy"}
                    <span className={styles.srOnly} aria-live="polite">
                      {copied ? "copied to clipboard" : ""}
                    </span>
                  </button>
                </div>

                <div className={styles.dialogFoot}>
                  <nav className={styles.socials} aria-label="social links">
                    {SOCIALS.map((social) => (
                      <a
                        key={social.label}
                        className={`${styles.social} ${styles.raised}`}
                        href={social.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={social.label}
                        title={social.label}
                        style={{ ["--brand"]: trayBrandColor(social.label) } as CSSProperties}
                      >
                        <FontAwesomeIcon className={styles.socialIcon} icon={social.icon} />
                        <span className={styles.socialGlyph} aria-hidden="true">
                          {trayGlyph(social.label)}
                        </span>
                      </a>
                    ))}
                  </nav>
                  <button
                    type="button"
                    className={`${styles.btn} ${styles.btnDefault} ${styles.raised}`}
                    onClick={deal}
                  >
                    Deal
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className={`${styles.reopen} ${styles.raised}`}
              onClick={() => setDialogOpen(true)}
            >
              <span aria-hidden="true">♦</span> Congratulations
            </button>
          )}
        </div>

        {/* Window status bar */}
        <div className={styles.statusbar}>
          <span className={`${styles.statusCell} ${styles.statusCellGrow} ${styles.sunken}`}>
            <span className={styles.statusPips} aria-hidden="true">
              ♣ ♦ ♥ ♠
            </span>
            Congratulations — you win!
          </span>
          <span className={`${styles.statusCell} ${styles.sunken}`}>Score 52</span>
        </div>
      </section>

      {/* Shared Win95 taskbar + Start menu */}
      <Taskbar
        themeId={THEME_ID}
        appLabel="Solitaire"
        iconVariant="card"
        onAppClick={() => setDialogOpen(true)}
      />
    </main>
  );
}
