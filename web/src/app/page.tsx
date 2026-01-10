"use client";
import styles from "./page.module.css";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faGithub, faLinkedin, faXTwitter } from "@fortawesome/free-brands-svg-icons";
import { useEffect, useRef, useCallback, useState, type CSSProperties } from "react";

// Constants moved outside component to avoid recreation
const WORD = "jonnii";
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
const BURST_COLORS = ["--red", "--orange", "--yellow", "--green", "--blue", "--violet"];

interface BurstRing {
  id: number;
  x: number;
  y: number;
  scale: number;
  color: string;
}

export default function Home() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const burstIdRef = useRef(0);
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);
  const [bursts, setBursts] = useState<BurstRing[]>([]);

  // Cache computed colors on mount
  const colorsRef = useRef<string[]>([]);
  useEffect(() => {
    const computed = getComputedStyle(document.documentElement);
    colorsRef.current = BURST_COLORS.map((v) => computed.getPropertyValue(v).trim()).filter(Boolean);
  }, []);

  // Helper to get random position within bounds
  const getRandomPosition = useCallback(() => {
    const el = containerRef.current ?? document.documentElement;
    const rect = el.getBoundingClientRect();
    const padding = 24;
    const rangeX = Math.max(0, rect.width - padding * 2);
    const rangeY = Math.max(0, rect.height - padding * 2);
    return {
      x: Math.floor(rect.left + padding + Math.random() * rangeX),
      y: Math.floor(rect.top + padding + Math.random() * rangeY),
    };
  }, []);

  // Trigger CSS-based radial burst at specific position or random
  const triggerBurst = useCallback((position?: { x: number; y: number }) => {
    const { x, y } = position ?? getRandomPosition();
    // Calculate scale needed to cover screen from this point (base size is 100px)
    const maxDist = Math.max(
      Math.hypot(x, y),
      Math.hypot(window.innerWidth - x, y),
      Math.hypot(x, window.innerHeight - y),
      Math.hypot(window.innerWidth - x, window.innerHeight - y)
    );
    const scale = (maxDist * 2) / 100;
    const colors = colorsRef.current;
    const color = colors.length > 0 ? colors[burstIdRef.current % colors.length] : "#268bd2";

    const burst: BurstRing = {
      id: burstIdRef.current++,
      x,
      y,
      scale,
      color,
    };

    // Update mouse position for dot grid spotlight
    document.documentElement.style.setProperty("--mouse-x", `${x}px`);
    document.documentElement.style.setProperty("--mouse-y", `${y}px`);

    setBursts((prev) => [...prev, burst]);

    // Remove after animation completes
    setTimeout(() => {
      setBursts((prev) => prev.filter((b) => b.id !== burst.id));
    }, 1800);
  }, [getRandomPosition]);

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

  // Click handler for manual burst at click position
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handleClick = (e: MouseEvent) => {
      triggerBurst({ x: e.clientX, y: e.clientY });
    };
    el.addEventListener("click", handleClick);
    return () => el.removeEventListener("click", handleClick);
  }, [triggerBurst]);

  // Auto-trigger burst every 5 seconds at random position
  useEffect(() => {
    const interval = setInterval(() => triggerBurst(), 5000);
    return () => clearInterval(interval);
  }, [triggerBurst]);

  return (
    <main className={styles.container} ref={containerRef}>
      {/* CSS-animated burst rings */}
      {bursts.map((burst) => (
        <div
          key={burst.id}
          className={styles.burstRing}
          style={{
            left: burst.x,
            top: burst.y,
            ["--burst-scale" as string]: burst.scale,
            ["--burst-color" as string]: burst.color,
          }}
        />
      ))}

      {ROWS.map((rowIndex) => (
        <div
          key={rowIndex}
          className={`${styles.row} ${EFFECT_CLASSES[rowIndex % EFFECT_CLASSES.length]}`}
          aria-label={WORD}
          onMouseEnter={() => setHoveredRow(rowIndex)}
          onMouseLeave={() => setHoveredRow(null)}
          onTouchStart={() => setHoveredRow(rowIndex)}
          onTouchEnd={() => setTimeout(() => setHoveredRow(null), 600)}
          style={{
            ["--accent"]: HIGHLIGHT_PALETTE[rowIndex],
            ["--spot-accent"]: HIGHLIGHT_PALETTE[rowIndex],
            ["--row-index"]: rowIndex,
            ["--row-count"]: ROWS.length,
          } as CSSProperties}
        >
          {WORD.split("").map((char, charIndex) => {
            const isHighlight = charIndex === rowIndex;
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
      ))}

      <div className={styles.footer}>
        <div
          className={styles.terminal}
          onClick={() => navigator.clipboard.writeText("ssh -p 56170 why.jonnii.com")}
          title="Click to copy"
        >
          <span className={styles.terminalPrompt}>$</span>
          <span className={styles.terminalCommand}>
            <span
              className={styles.terminalKeyword}
              style={hoveredRow !== null ? { color: HIGHLIGHT_PALETTE[hoveredRow] } : undefined}
            >
              ssh
            </span>{" "}
            -p 56170 why.jonnii.com
          </span>
        </div>
        <nav className={styles.socials} aria-label="social links">
          <a
            className={styles.socialLink}
            href="https://www.linkedin.com/in/jonathan-goldman-%F0%9F%A7%8D-0661781/"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="LinkedIn"
          >
            <FontAwesomeIcon className={styles.socialIcon} icon={faLinkedin} />
          </a>
          <a
            className={styles.socialLink}
            href="https://github.com/jonnii"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="GitHub"
          >
            <FontAwesomeIcon className={styles.socialIcon} icon={faGithub} />
          </a>
          <a
            className={styles.socialLink}
            href="https://x.com/jonnii"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="X (Twitter)"
          >
            <FontAwesomeIcon className={styles.socialIcon} icon={faXTwitter} />
          </a>
        </nav>
      </div>
    </main>
  );
}
