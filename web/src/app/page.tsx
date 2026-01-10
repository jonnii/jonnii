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

// Dot grid constants
const GRID_SIZE = 16;
const DOT_RADIUS = 1.3;
const RING_THICKNESS = 24;

// Ring effect configurations
type EffectType = "burst" | "ripple" | "pulse" | "shockwave" | "sonar";

const RING_EFFECTS: Record<EffectType, { ringCount: number; duration: number; className: string; animateDots: boolean }> = {
  burst: { ringCount: 1, duration: 3500, className: styles.effectBurst, animateDots: true },
  ripple: { ringCount: 3, duration: 3000, className: styles.effectRipple, animateDots: true },
  pulse: { ringCount: 2, duration: 2500, className: styles.effectPulse, animateDots: true },
  shockwave: { ringCount: 1, duration: 1200, className: styles.effectShockwave, animateDots: true },
  sonar: { ringCount: 2, duration: 3200, className: styles.effectSonar, animateDots: true },
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

interface DotAnimation {
  id: number;
  x: number;
  y: number;
  startTime: number;
  duration: number;
  colors: string[];
  ringCount: number;
  maxRadius: number;
}

export default function Home() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const effectIdRef = useRef(0);
  const dotAnimationsRef = useRef<DotAnimation[]>([]);
  const animationFrameRef = useRef<number | null>(null);
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);
  const [rings, setRings] = useState<Ring[]>([]);

  // Cache computed colors on mount
  const colorsRef = useRef<string[]>([]);
  useEffect(() => {
    const computed = getComputedStyle(document.documentElement);
    colorsRef.current = BURST_COLORS.map((v) => computed.getPropertyValue(v).trim()).filter(Boolean);
  }, []);

  // Canvas setup and resize
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const width = window.innerWidth;
      const height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  // Dot animation render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const animate = () => {
      const now = performance.now();
      const width = window.innerWidth;
      const height = window.innerHeight;

      // Clear canvas
      ctx.clearRect(0, 0, width, height);

      // Filter out completed animations
      dotAnimationsRef.current = dotAnimationsRef.current.filter(
        (anim) => now - anim.startTime < anim.duration
      );

      // Draw animated dots for each active animation
      for (const anim of dotAnimationsRef.current) {
        const elapsed = now - anim.startTime;
        const progress = elapsed / anim.duration;
        const easeProgress = 1 - Math.pow(1 - progress, 3); // ease-out cubic

        // For ripple, draw multiple rings with staggered timing
        for (let ringIdx = 0; ringIdx < anim.ringCount; ringIdx++) {
          const ringDelay = ringIdx * 200; // ms between rings
          const ringElapsed = elapsed - ringDelay;
          if (ringElapsed < 0) continue;

          const ringProgress = Math.min(1, ringElapsed / (anim.duration - ringDelay * anim.ringCount));
          const ringEase = 1 - Math.pow(1 - ringProgress, 3);
          const currentRadius = ringEase * anim.maxRadius;
          const ringOpacity = Math.max(0, 0.7 * (1 - ringProgress));

          // Calculate bounding box for dots to check
          const x0 = Math.max(0, Math.floor((anim.x - currentRadius - RING_THICKNESS) / GRID_SIZE) * GRID_SIZE);
          const y0 = Math.max(0, Math.floor((anim.y - currentRadius - RING_THICKNESS) / GRID_SIZE) * GRID_SIZE);
          const x1 = Math.min(width, Math.ceil((anim.x + currentRadius + RING_THICKNESS) / GRID_SIZE) * GRID_SIZE);
          const y1 = Math.min(height, Math.ceil((anim.y + currentRadius + RING_THICKNESS) / GRID_SIZE) * GRID_SIZE);

          ctx.globalAlpha = ringOpacity;

          for (let y = y0; y <= y1; y += GRID_SIZE) {
            for (let x = x0; x <= x1; x += GRID_SIZE) {
              const dist = Math.hypot(x - anim.x, y - anim.y);
              // Check if dot is within the ring
              if (Math.abs(dist - currentRadius) <= RING_THICKNESS / 2) {
                // Seeded color based on position
                const colorIdx = Math.abs((x * 2654435761) ^ (y * 1597334677) ^ (anim.id * 1013904223)) % anim.colors.length;
                ctx.fillStyle = anim.colors[colorIdx];
                ctx.beginPath();
                ctx.arc(x, y, DOT_RADIUS * 1.5, 0, Math.PI * 2);
                ctx.fill();
              }
            }
          }
        }
      }

      ctx.globalAlpha = 1;
      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
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

    // Calculate scale/distance needed to cover screen from this point
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

    // Start dot animation for effects that support it
    if (config.animateDots && colors.length > 0) {
      dotAnimationsRef.current.push({
        id: effectId,
        x,
        y,
        startTime: performance.now(),
        duration: config.duration,
        colors,
        ringCount: config.ringCount,
        maxRadius: maxDist,
      });
    }

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
      {/* Canvas for animated dots */}
      <canvas ref={canvasRef} className={styles.dotCanvas} />

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
            style={hoveredRow !== null ? { color: HIGHLIGHT_PALETTE[hoveredRow] } : undefined}
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
            style={hoveredRow !== null ? { color: HIGHLIGHT_PALETTE[hoveredRow] } : undefined}
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
            style={hoveredRow !== null ? { color: HIGHLIGHT_PALETTE[hoveredRow] } : undefined}
          >
            <FontAwesomeIcon className={styles.socialIcon} icon={faXTwitter} />
          </a>
        </nav>
      </div>
    </main>
  );
}
