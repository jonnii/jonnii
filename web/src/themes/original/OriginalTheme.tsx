"use client";
import styles from "./original.module.css";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import EffectCanvas from "./EffectCanvas";
import { WORD, SSH_COMMAND, SOCIALS, COPY_FEEDBACK_MS } from "../shared/content";

// Constants moved outside component to avoid recreation
const ROWS = Array.from({ length: 6 }, (_, i) => i);
const HIGHLIGHT_PALETTE = [
  "var(--red)",
  "var(--violet)",
  "var(--blue)",
  "var(--orange)",
  "var(--yellow)",
  "var(--green)",
];
const EFFECT_CLASSES = [
  styles.effectWave,
  styles.effectTilt,
  styles.effectUnderline,
  styles.effectJelly,
  styles.effectSkew,
  styles.effectBlur,
];
const DIAGONAL_STEP_MS = 2400;

export default function OriginalTheme() {
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);
  const [diagonalOffset, setDiagonalOffset] = useState(0);
  const [copied, setCopied] = useState(false);
  const copyResetRef = useRef<number | null>(null);

  // Mouse/touch move handler for dot grid spotlight
  useEffect(() => {
    const handleMove = (e: MouseEvent | TouchEvent) => {
      const point = "touches" in e && e.touches.length > 0 ? e.touches[0] : (e as MouseEvent);
      if (!("clientX" in point)) return;
      document.documentElement.style.setProperty("--mouse-x", `${point.clientX}px`);
      document.documentElement.style.setProperty("--mouse-y", `${point.clientY}px`);
    };

    window.addEventListener("mousemove", handleMove, { passive: true });
    window.addEventListener("touchmove", handleMove, { passive: true });
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("touchmove", handleMove);
    };
  }, []);

  // Slowly march the highlighted diagonal across the wordmark
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(
      () => setDiagonalOffset((offset) => (offset + 1) % WORD.length),
      DIAGONAL_STEP_MS
    );
    return () => window.clearInterval(id);
  }, []);

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
    <main
      className={styles.container}
      style={
        hoveredRow !== null
          ? ({ ["--spot-accent"]: HIGHLIGHT_PALETTE[hoveredRow] } as CSSProperties)
          : undefined
      }
    >
      <h1 className={styles.srOnly}>jonnii</h1>

      {/* Canvas for click/ambient ripple effects */}
      <EffectCanvas />

      {ROWS.map((rowIndex) => {
        const highlightIndex = (rowIndex + diagonalOffset) % WORD.length;
        return (
          <div
            key={rowIndex}
            aria-hidden="true"
            className={`${styles.row} ${EFFECT_CLASSES[rowIndex % EFFECT_CLASSES.length]}`}
            onMouseEnter={() => setHoveredRow(rowIndex)}
            onMouseLeave={() => setHoveredRow(null)}
            onTouchStart={() => setHoveredRow(rowIndex)}
            onTouchEnd={() => setTimeout(() => setHoveredRow(null), 600)}
            style={{
              ["--accent"]: HIGHLIGHT_PALETTE[rowIndex],
              ["--row-index"]: rowIndex,
              ["--row-count"]: ROWS.length,
            } as CSSProperties}
          >
            {WORD.split("").map((char, charIndex) => {
              const isHighlight = charIndex === highlightIndex;
              return (
                <span
                  key={charIndex}
                  className={isHighlight ? styles.highlight : styles.letter}
                  style={{
                    ["--char-index"]: charIndex,
                    ...(isHighlight ? { color: HIGHLIGHT_PALETTE[rowIndex] } : {}),
                  } as CSSProperties}
                >
                  {char}
                </span>
              );
            })}
          </div>
        );
      })}

      <div className={styles.footer}>
        <button
          type="button"
          className={`${styles.terminal} ${copied ? styles.terminalCopied : ""}`}
          onClick={handleCopy}
          title="Copy to clipboard"
        >
          <span className={styles.terminalPrompt}>{copied ? "✓" : "$"}</span>
          <span className={styles.terminalCommand}>
            <span
              className={styles.terminalKeyword}
              style={hoveredRow !== null ? { color: HIGHLIGHT_PALETTE[hoveredRow] } : undefined}
            >
              ssh
            </span>{" "}
            -p 56170 why.jonnii.com
          </span>
          <span className={styles.srOnly} aria-live="polite">
            {copied ? "copied to clipboard" : ""}
          </span>
        </button>
        <nav className={styles.socials} aria-label="social links">
          {SOCIALS.map((social) => (
            <a
              key={social.label}
              className={styles.socialLink}
              href={social.href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={social.label}
              style={hoveredRow !== null ? { color: HIGHLIGHT_PALETTE[hoveredRow] } : undefined}
            >
              <FontAwesomeIcon className={styles.socialIcon} icon={social.icon} />
            </a>
          ))}
        </nav>
      </div>
    </main>
  );
}
