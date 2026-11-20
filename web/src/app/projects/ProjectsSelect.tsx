"use client";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { Anton, Barlow_Condensed, Yuji_Syuku } from "next/font/google";
import { PROJECTS } from "../../themes/shared/content";
import { FIGHTERS, FALLBACK_FIGHTER, kanjiNumeral } from "./fighters";
import styles from "./projects.module.css";

const anton = Anton({ subsets: ["latin"], weight: "400", variable: "--font-anton" });
const barlow = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["500", "700", "800"],
  style: ["normal", "italic"],
  variable: "--font-barlow",
});
// Only used for the five kanji numerals, so no subset to preload.
const yuji = Yuji_Syuku({ weight: "400", variable: "--font-yuji", preload: false });

/** "↓↘→ + P" as one key per symbol. */
const inputKeys = (input: string) => Array.from(input.replace(/\s+/g, ""));

// A character select: one full-width band per project. Each project is a
// fighter (art in /public/projects) standing on its own stage, with an ink
// brush slab, a kanji numeral and a stamp. Hover, focus or the arrow keys
// pick a fighter; Enter goes to the project.
export default function ProjectsSelect() {
  const [selected, setSelected] = useState(0);
  const bands = useRef<(HTMLAnchorElement | null)[]>([]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
      e.preventDefault();
      setSelected((s) => {
        const n = (s + (e.key === "ArrowDown" ? 1 : -1) + PROJECTS.length) % PROJECTS.length;
        bands.current[n]?.focus();
        return n;
      });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className={`${styles.page} ${anton.variable} ${barlow.variable} ${yuji.variable}`}>
      <svg className={styles.defs} aria-hidden="true">
        <filter id="brush">
          <feTurbulence type="fractalNoise" baseFrequency="0.04 0.8" numOctaves="3" seed="7" />
          <feDisplacementMap in="SourceGraphic" scale="18" />
        </filter>
        {/* A softer wobble, for the sun and the dividers */}
        <filter id="ink">
          <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="3" />
          <feDisplacementMap in="SourceGraphic" scale="9" />
        </filter>
        <filter id="grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" stitchTiles="stitch" />
          <feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.5 0" />
        </filter>
      </svg>
      <svg className={styles.grain} aria-hidden="true">
        <rect width="100%" height="100%" filter="url(#grain)" />
      </svg>

      <header className={styles.header}>
        <div>
          <Link className={styles.back} href="/">
            ← jonnii
          </Link>
          <h1 className={styles.title}>
            <span className={styles.sun} aria-hidden="true" />
            Choose your <em>fighter</em>
          </h1>
        </div>
        <p className={styles.round}>
          <span>{PROJECTS.length} projects</span>
          <b>Round 1</b>
        </p>
        <span className={styles.dojo} aria-hidden="true">
          道場
        </span>
      </header>

      <main className={styles.roster}>
        {PROJECTS.map((p, i) => {
          const f = FIGHTERS[p.slug] ?? FALLBACK_FIGHTER;
          return (
            <a
              key={p.slug}
              ref={(el) => {
                bands.current[i] = el;
              }}
              className={styles.band}
              href={p.href}
              target="_blank"
              rel="noopener noreferrer"
              data-selected={i === selected ? "true" : undefined}
              onMouseEnter={() => setSelected(i)}
              onFocus={() => setSelected(i)}
              style={
                {
                  "--c": f.color,
                  "--stage": `url(/projects/stage-${p.slug}.svg)`,
                  "--delay": `${i * -0.3}s`,
                  "--i": i,
                } as CSSProperties
              }
            >
              <span className={styles.clip} aria-hidden="true">
                <span className={styles.wash} />
                <span className={styles.stage} />
                <span className={styles.ghost}>{p.name}</span>
                <span className={styles.rays} />
              </span>

              <span className={styles.slab} aria-hidden="true">
                <span className={styles.cursor}>1P</span>
                <span className={styles.kanji}>{kanjiNumeral(i)}</span>
                <span className={styles.hanko}>{f.icon}</span>
              </span>

              <span className={styles.info}>
                <span className={styles.name}>{p.name}</span>
                <span className={styles.meta}>
                  <i aria-hidden="true" />
                  {p.kind}
                  <span className={styles.host}>/ {p.host}</span>
                </span>
                <span className={styles.blurb}>{p.blurb}</span>
              </span>

              <span className={styles.fighter} aria-hidden="true">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/projects/${p.slug}.svg`} alt="" draggable={false} />
              </span>

              <span className={styles.special}>
                <small>Special move</small>
                <b>{f.move}</b>
                <span className={styles.input} aria-label={f.input}>
                  {inputKeys(f.input).map((k, n) =>
                    k === "+" ? (
                      <span key={n} className={styles.plus} aria-hidden="true">
                        +
                      </span>
                    ) : (
                      <kbd key={n} data-button={/[A-Z]/.test(k) ? "true" : undefined} aria-hidden="true">
                        {k}
                      </kbd>
                    )
                  )}
                </span>
                <span className={styles.go}>Fight ▸</span>
              </span>
            </a>
          );
        })}
      </main>

      <footer className={styles.hint} aria-hidden="true">
        <span>
          <kbd>↑</kbd>
          <kbd>↓</kbd> Select
        </span>
        <span>
          <kbd>↵</kbd> Fight
        </span>
        <span className={styles.credit}>© jonnii dojo</span>
      </footer>
    </div>
  );
}
