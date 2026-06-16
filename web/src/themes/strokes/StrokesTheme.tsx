"use client";
import styles from "./strokes.module.css";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import CapsuleBurst from "./CapsuleBurst";
import { WORD, SSH_COMMAND, SOCIALS, COPY_FEEDBACK_MS } from "../shared/content";

const LETTERS = WORD.split("");

// One bold lozenge bar per letter, in the "Future Present Past" palette; each
// letter sits knocked out of its capsule. Color cycles through the five cover
// colors. The yellow capsule is light, so its letter is inked navy instead of
// the cream knockout used on the darker capsules.
const BAR_PALETTE = ["--s-blue", "--s-green", "--s-yellow", "--s-orange", "--s-red"];
const YELLOW_INDEX = 2;
const barColor = (i: number) => `var(${BAR_PALETTE[i % BAR_PALETTE.length]})`;
const knockoutColor = (i: number) =>
  i % BAR_PALETTE.length === YELLOW_INDEX ? "var(--foreground)" : "var(--background)";

// Each letter adopts one cover color on hover.
const LETTER_COLORS = [
  "var(--s-red)",
  "var(--s-orange)",
  "var(--s-yellow)",
  "var(--s-green)",
  "var(--s-blue)",
  "var(--s-red)",
];

export default function StrokesTheme() {
  const [copied, setCopied] = useState(false);
  const copyResetRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (copyResetRef.current !== null) window.clearTimeout(copyResetRef.current);
    };
  }, []);

  const handleCopy = () => {
    navigator.clipboard.writeText(SSH_COMMAND);
    setCopied(true);
    if (copyResetRef.current !== null) window.clearTimeout(copyResetRef.current);
    copyResetRef.current = window.setTimeout(() => setCopied(false), COPY_FEEDBACK_MS);
  };

  return (
    <main className={styles.stage}>
      <CapsuleBurst />

      {/* Each letter sits inside its own colored capsule bar */}
      <h1 className={styles.word}>
        {LETTERS.map((char, i) => (
          <span
            key={i}
            className={styles.bar}
            style={{ background: barColor(i), ["--bi"]: i } as CSSProperties}
          >
            <span
              className={styles.letter}
              style={{ color: knockoutColor(i), ["--i"]: i } as CSSProperties}
            >
              {char}
            </span>
          </span>
        ))}
      </h1>

      <div className={styles.footer}>
        <button
          type="button"
          className={`${styles.chip} ${copied ? styles.chipCopied : ""}`}
          onClick={handleCopy}
          title="Copy to clipboard"
        >
          <span className={styles.chipCmd}>{SSH_COMMAND}</span>
          <span className={styles.chipState}>{copied ? "copied" : "copy"}</span>
          <span className={styles.srOnly} aria-live="polite">
            {copied ? "copied to clipboard" : ""}
          </span>
        </button>

        <nav className={styles.socials} aria-label="social links">
          {SOCIALS.map((social, i) => (
            <a
              key={social.label}
              className={styles.social}
              href={social.href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={social.label}
              style={{ ["--sc"]: LETTER_COLORS[i] } as CSSProperties}
            >
              <FontAwesomeIcon className={styles.socialIcon} icon={social.icon} />
            </a>
          ))}
        </nav>
      </div>
    </main>
  );
}
