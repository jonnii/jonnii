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
          {PROJECTS.length} projects · round 1
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
                } as CSSProperties
              }
            >
              <span className={styles.clip} aria-hidden="true">
                <span className={styles.stage} />
                <span className={styles.ghost}>{p.name}</span>
              </span>

              <span className={styles.slab} aria-hidden="true">
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
                <code>{f.input}</code>
              </span>
            </a>
          );
        })}
      </main>
    </div>
  );
}
