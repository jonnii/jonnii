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

// Ring effect configurations
type EffectType = "burst" | "ripple" | "pulse" | "shockwave" | "sonar";

const RING_EFFECTS: Record<EffectType, { ringCount: number; duration: number; className: string }> = {
  burst: { ringCount: 1, duration: 2000, className: styles.effectBurst },
  ripple: { ringCount: 3, duration: 3000, className: styles.effectRipple },
  pulse: { ringCount: 2, duration: 2500, className: styles.effectPulse },
  shockwave: { ringCount: 1, duration: 1200, className: styles.effectShockwave },
  sonar: { ringCount: 2, duration: 3200, className: styles.effectSonar },
};

const EFFECT_TYPES = Object.keys(RING_EFFECTS) as EffectType[];

interface Ring {
  id: string;
  x: number;
  y: number;
  scale: number;
  color: string;
  effect: EffectType;
  index: number;
}

export default function Home() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const effectIdRef = useRef(0);
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);
  const [rings, setRings] = useState<Ring[]>([]);

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

  // Trigger random effect at specific position or random
  const triggerEffect = useCallback((position?: { x: number; y: number }) => {
    const { x, y } = position ?? getRandomPosition();

    // Calculate scale needed to cover screen from this point
    const maxDist = Math.max(
      Math.hypot(x, y),
      Math.hypot(window.innerWidth - x, y),
      Math.hypot(x, window.innerHeight - y),
      Math.hypot(window.innerWidth - x, window.innerHeight - y)
    );
    const scale = (maxDist * 2) / 100;

    // Random effect and color
    const effect = EFFECT_TYPES[Math.floor(Math.random() * EFFECT_TYPES.length)];
    const config = RING_EFFECTS[effect];
    const colors = colorsRef.current;
    const baseColorIndex = effectIdRef.current % colors.length;

    // Create rings for this effect
    const effectId = effectIdRef.current++;
    const newRings: Ring[] = Array.from({ length: config.ringCount }, (_, i) => ({
      id: `${effectId}-${i}`,
      x,
      y,
      scale,
      color: colors.length > 0 ? colors[(baseColorIndex + i) % colors.length] : "#268bd2",
      effect,
      index: i,
    }));

    // Update mouse position for dot grid spotlight
    document.documentElement.style.setProperty("--mouse-x", `${x}px`);
    document.documentElement.style.setProperty("--mouse-y", `${y}px`);

    setRings((prev) => [...prev, ...newRings]);

    // Remove after animation completes
    setTimeout(() => {
      const ids = newRings.map((r) => r.id);
      setRings((prev) => prev.filter((r) => !ids.includes(r.id)));
    }, config.duration);
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

  // Click handler for manual effect at click position
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handleClick = (e: MouseEvent) => {
      triggerEffect({ x: e.clientX, y: e.clientY });
    };
    el.addEventListener("click", handleClick);
    return () => el.removeEventListener("click", handleClick);
  }, [triggerEffect]);

  // Auto-trigger effect every 10 seconds at random position
  useEffect(() => {
    const interval = setInterval(() => triggerEffect(), 10000);
    return () => clearInterval(interval);
  }, [triggerEffect]);

  return (
    <main className={styles.container} ref={containerRef}>
      {/* CSS-animated effect rings */}
      {rings.map((ring) => (
        <div
          key={ring.id}
          className={`${styles.ring} ${RING_EFFECTS[ring.effect].className}`}
          style={{
            left: ring.x,
            top: ring.y,
            ["--ring-scale" as string]: ring.scale,
            ["--ring-color" as string]: ring.color,
            ["--ring-index" as string]: ring.index,
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
          onClick={(e) => {
            e.stopPropagation();
            navigator.clipboard.writeText("ssh -p 56170 why.jonnii.com");
          }}
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
            onClick={(e) => e.stopPropagation()}
          >
            <FontAwesomeIcon className={styles.socialIcon} icon={faLinkedin} />
          </a>
          <a
            className={styles.socialLink}
            href="https://github.com/jonnii"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="GitHub"
            onClick={(e) => e.stopPropagation()}
          >
            <FontAwesomeIcon className={styles.socialIcon} icon={faGithub} />
          </a>
          <a
            className={styles.socialLink}
            href="https://x.com/jonnii"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="X (Twitter)"
            onClick={(e) => e.stopPropagation()}
          >
            <FontAwesomeIcon className={styles.socialIcon} icon={faXTwitter} />
          </a>
        </nav>
      </div>
    </main>
  );
}
