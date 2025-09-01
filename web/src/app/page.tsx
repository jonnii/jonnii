"use client";
import styles from "./page.module.css";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faGithub, faLinkedin, faXTwitter } from "@fortawesome/free-brands-svg-icons";
import { useEffect, useRef, useCallback, type CSSProperties } from "react";

export default function Home() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const clickIdRef = useRef<number>(0);
  const word = "jonnii";
  const rows = Array.from({ length: 6 }, (_, index) => index);
  const highlightPalette = [
    "var(--red)",
    "var(--violet)",
    "var(--blue)",
    "var(--orange)",
    "var(--yellow)",
    "var(--green)",
  ];

  const triggerRadialBurst = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = window.innerWidth;
    const height = window.innerHeight;

    const root = document.documentElement;
    const computed = getComputedStyle(root);
    const vars = ["--red", "--orange", "--yellow", "--green", "--blue", "--violet"] as const;
    const palette = vars.map((v) => computed.getPropertyValue(v).trim()).filter(Boolean);
    const clickId = (clickIdRef.current = clickIdRef.current + 1);

    const origin = { x: clientX, y: clientY };
    const maxR = Math.hypot(Math.max(origin.x, width - origin.x), Math.max(origin.y, height - origin.y));
    const start = performance.now();
    const duration = 1800;
    const grid = 16;
    const ringThickness = 16;

    const seededIndex = (x: number, y: number) => {
      const n = Math.imul(2654435761, x + 374761393) ^ Math.imul(1597334677, y + 88675123) ^ (clickId * 1013904223);
      return Math.abs(n) % palette.length;
    };

    const draw = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const ease = 1 - Math.pow(1 - t, 3);
      const r = ease * maxR;
      ctx.clearRect(0, 0, width, height);
      ctx.save();
      ctx.globalAlpha = 0.95;

      const x0 = Math.max(0, Math.floor((origin.x - r - ringThickness) / grid) * grid);
      const y0 = Math.max(0, Math.floor((origin.y - r - ringThickness) / grid) * grid);
      const x1 = Math.min(width, Math.ceil((origin.x + r + ringThickness) / grid) * grid);
      const y1 = Math.min(height, Math.ceil((origin.y + r + ringThickness) / grid) * grid);

      for (let y = y0; y <= y1; y += grid) {
        for (let x = x0; x <= x1; x += grid) {
          const d = Math.hypot(x - origin.x, y - origin.y);
          if (Math.abs(d - r) <= ringThickness * 0.5) {
            const idx = seededIndex(x, y);
            ctx.fillStyle = palette[idx];
            ctx.beginPath();
            ctx.arc(x, y, 2.6, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      ctx.restore();
      if (t < 1) requestAnimationFrame(draw);
      else ctx.clearRect(0, 0, width, height);
    };

    requestAnimationFrame(draw);
  }, []);

  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      const x = `${e.clientX}px`;
      const y = `${e.clientY}px`;
      document.documentElement.style.setProperty("--mouse-x", x);
      document.documentElement.style.setProperty("--mouse-y", y);
    };
    window.addEventListener("mousemove", handleMove, { passive: true });
    return () => window.removeEventListener("mousemove", handleMove as EventListener);
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onClick = () => {
      // start effect from a random position strictly within the canvas bounds
      const target = canvasRef.current ?? containerRef.current ?? document.documentElement;
      const rect = target.getBoundingClientRect();
      const padding = 24;
      const minX = Math.floor(rect.left + padding);
      const maxX = Math.floor(rect.right - padding);
      const minY = Math.floor(rect.top + padding);
      const maxY = Math.floor(rect.bottom - padding);
      const rangeX = Math.max(0, maxX - minX);
      const rangeY = Math.max(0, maxY - minY);
      const randomX = rangeX ? minX + Math.floor(Math.random() * rangeX) : Math.floor((rect.left + rect.right) / 2);
      const randomY = rangeY ? minY + Math.floor(Math.random() * rangeY) : Math.floor((rect.top + rect.bottom) / 2);
      const x = `${randomX}px`;
      const y = `${randomY}px`;
      document.documentElement.style.setProperty("--mouse-x", x);
      document.documentElement.style.setProperty("--mouse-y", y);

      triggerRadialBurst(randomX, randomY);
    };
    el.addEventListener("click", onClick as EventListener);
    return () => {
      el.removeEventListener("click", onClick as EventListener);
    };
  }, [triggerRadialBurst]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const width = window.innerWidth;
      const height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, width, height);
      }
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  

  return (
    <main className={styles.container} ref={containerRef}>
      <canvas ref={canvasRef} className={styles.bgCanvas} />
      {rows.map((rowIndex) => {
        const highlightIndex = rowIndex;
        const effectClasses = [
          styles.effectWave,
          styles.effectTilt,
          styles.effectUnderline,
          styles.effectJelly,
          styles.effectSkew,
          styles.effectBlur,
        ];
        const effectClass = effectClasses[rowIndex % effectClasses.length];
        return (
          <div
            key={rowIndex}
            className={`${styles.row} ${effectClass}`}
            aria-label={word}
            style={{
              ['--accent']: highlightPalette[rowIndex],
              ['--spot-accent']: highlightPalette[rowIndex],
            } as CSSProperties}
          >
            {word.split("").map((char, charIndex) => {
              const isHighlight = charIndex === highlightIndex;
              return (
                <span
                  key={`${rowIndex}-${charIndex}`}
                  className={isHighlight ? styles.highlight : styles.letter}
                  style={isHighlight ? { color: highlightPalette[rowIndex] } : undefined}
                >
                  {char}
                </span>
              );
            })}
          </div>
        );
      })}
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
    </main>
  );
}
