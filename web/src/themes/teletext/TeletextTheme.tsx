"use client";
import styles from "./teletext.module.css";
import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { WORD, SSH_COMMAND, SOCIALS, COPY_FEEDBACK_MS } from "../shared/content";
import { pixelWordMask, pixelWordWidth, PIXEL_GLYPH_H } from "../shared/pixelFont";
import { THEMES } from "../registry";

// A Ceefax-style teletext service. Page 100 is the index, with the wordmark in
// chunky block graphics. Key in a three-digit page number (on the keyboard or
// the remote) and the header rolls through pages while it "searches", then the
// page paints itself in a line at a time. The coloured Fastext keys jump to the
// main sections, and ? reveals the concealed answer, like the real thing.

const COLS = 40;

// The seven teletext colours, minus black.
const RED = "red";
const GREEN = "green";
const YELLOW = "yellow";
const BLUE = "blue";
const MAGENTA = "magenta";
const CYAN = "cyan";
const WHITE = "white";
type Colour = typeof RED | typeof GREEN | typeof YELLOW | typeof BLUE | typeof MAGENTA | typeof CYAN | typeof WHITE;

const SEARCH_MS = 700;
const ROLL_MS = 45;
const HEADLINE_MS = 4000;

// Each fits the 31 columns left after " NEWS ▶ ".
const HEADLINES = [
  "Man adds yet another theme",
  "Site rolls new look each visit",
  "ssh server answers questions",
  "Yeti still at large on slopes",
  "Mines confirmed to spell name",
];

// The wordmark's block graphics: one cell per bitmap pixel, a colour per letter.
const WORD_GAP = 1;
const WORD_PAD = 2;
const WORD_COLS = pixelWordWidth(WORD_GAP) + WORD_PAD * 2;
const WORD_MASK = pixelWordMask(WORD_COLS, 0, WORD_GAP);
const LETTER_COLOURS: Colour[] = [RED, YELLOW, GREEN, CYAN, MAGENTA, RED];
const WORD_CELLS = (() => {
  // Recover each column's letter by walking the mask left to right: a fully
  // empty column between filled ones marks the gap to the next letter.
  const colFilled = Array.from({ length: WORD_COLS }, (_, c) =>
    Array.from({ length: PIXEL_GLYPH_H }, (_, r) => WORD_MASK.has(r * WORD_COLS + c)).some(Boolean)
  );
  const letterOfCol: number[] = [];
  let letter = -1;
  let inLetter = false;
  for (let c = 0; c < WORD_COLS; c++) {
    if (colFilled[c] && !inLetter) letter++;
    inLetter = colFilled[c];
    letterOfCol.push(Math.max(0, letter));
  }
  return Array.from({ length: WORD_COLS * PIXEL_GLYPH_H }, (_, i) =>
    WORD_MASK.has(i) ? LETTER_COLOURS[letterOfCol[i % WORD_COLS] % LETTER_COLOURS.length] : null
  );
})();

// Pages that exist. Anything else and the header rolls forever, looking for it.
const SOCIAL_PAGES = SOCIALS.map((s, i) => ({ ...s, page: 301 + i }));
const CHANNELS = THEMES.filter((t) => t.id !== "teletext").map((t, i) => ({ ...t, page: 501 + i }));
const PAGES = new Set([100, 200, 300, 500]);

const FASTEXT: { colour: Colour; label: string; page: number; key: string }[] = [
  { colour: RED, label: "Connect", page: 200, key: "r" },
  { colour: GREEN, label: "Links", page: 300, key: "g" },
  { colour: YELLOW, label: "Channels", page: 500, key: "y" },
  { colour: CYAN, label: "Index", page: 100, key: "c" },
];

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const pad2 = (n: number) => String(n).padStart(2, "0");

/** "Label ........ ", dotted out so the page number after it ends one column short of the edge. */
function leader(label: string, page: number, indent = 1): string {
  const dots = COLS - 1 - indent - label.length - String(page).length - 2;
  return `${label} ${".".repeat(Math.max(3, dots))} `;
}

const C = ({ c, children }: { c: Colour; children: ReactNode }) => (
  <span className={styles[`fg_${c}`]}>{children}</span>
);

export default function TeletextTheme() {
  const [page, setPage] = useState(100);
  const [headerNum, setHeaderNum] = useState(100);
  const [entry, setEntry] = useState("");
  const [searching, setSearching] = useState<number | null>(null);
  const [paint, setPaint] = useState(0);
  const [now, setNow] = useState(() => new Date());
  const [headline, setHeadline] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  const copyResetRef = useRef<number | null>(null);

  // Live clock in the header, ticking every second like the real service.
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setHeadline((h) => (h + 1) % HEADLINES.length), HEADLINE_MS);
    return () => window.clearInterval(id);
  }, []);

  // While searching, the header number rolls past every page on the carousel.
  // A page that exists turns up after SEARCH_MS; one that doesn't never does.
  useEffect(() => {
    if (searching === null) return;
    const started = Date.now();
    const id = window.setInterval(() => {
      if (PAGES.has(searching) && Date.now() - started >= SEARCH_MS) {
        setPage(searching);
        setHeaderNum(searching);
        setSearching(null);
        setRevealed(false);
        setPaint((p) => p + 1);
        return;
      }
      setHeaderNum((n) => (n >= 899 ? 100 : n + 1));
    }, ROLL_MS);
    return () => window.clearInterval(id);
  }, [searching]);

  useEffect(() => {
    return () => {
      if (copyResetRef.current !== null) window.clearTimeout(copyResetRef.current);
    };
  }, []);

  const goto = useCallback((n: number) => {
    setEntry("");
    // Socials and channels are sub-pages that leave the service straight away.
    const social = SOCIAL_PAGES.find((s) => s.page === n);
    if (social) {
      window.open(social.href, "_blank", "noopener,noreferrer");
      return;
    }
    const channel = CHANNELS.find((c) => c.page === n);
    if (channel) {
      window.location.href = `/?theme=${channel.id}`;
      return;
    }
    setSearching(n);
  }, []);

  const pressDigit = useCallback(
    (d: string) => {
      const next = entry + d;
      // Teletext pages run 100 to 899, so a leading 0 or 9 can't start one.
      if (next.length === 1 && (d === "0" || d === "9")) return;
      if (next.length < 3) {
        setEntry(next);
        return;
      }
      goto(Number(next));
    },
    [entry, goto]
  );

  const handleCopy = () => {
    navigator.clipboard.writeText(SSH_COMMAND);
    setCopied(true);
    if (copyResetRef.current !== null) window.clearTimeout(copyResetRef.current);
    copyResetRef.current = window.setTimeout(() => setCopied(false), COPY_FEEDBACK_MS);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (/^[0-9]$/.test(e.key)) {
        pressDigit(e.key);
      } else if (e.key === "?") {
        setRevealed((r) => !r);
      } else if (e.key === "Backspace") {
        setEntry((s) => s.slice(0, -1));
      } else if (e.key === "Escape") {
        goto(100);
      } else {
        const fast = FASTEXT.find((f) => f.key === e.key.toLowerCase());
        if (!fast) return;
        goto(fast.page);
      }
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pressDigit, goto]);

  // The P-number at the top left shows what's being keyed in, then the target.
  const keyed = entry ? `P${entry.padEnd(3, "-")}` : `P${searching ?? page}`;
  const date = `${DAYS[now.getDay()]} ${pad2(now.getDate())} ${MONTHS[now.getMonth()]}`;
  const time = `${pad2(now.getHours())}:${pad2(now.getMinutes())}/${pad2(now.getSeconds())}`;

  // Each row fades in after the one above, so a page paints top to bottom.
  let rowIndex = 0;
  // A plain function rather than a component, so the clock ticking every
  // second re-renders rows without remounting them and replaying the fade.
  const row = (children?: ReactNode, opts: { bg?: Colour; dh?: boolean; key?: number } = {}) => (
    <div
      key={opts.key}
      className={`${styles.row} ${opts.dh ? styles.doubleHeight : ""} ${opts.bg ? styles[`bg_${opts.bg}`] : ""}`}
      style={{ ["--row"]: rowIndex++ } as CSSProperties}
    >
      {opts.dh ? <span className={styles.dhInner}>{children}</span> : children}
    </div>
  );

  const indexLink = (label: string, n: number, colour: Colour = CYAN) =>
    row(
      <button type="button" className={styles.link} onClick={() => goto(n)}>
        {" "}
        <C c={colour}>{leader(label, n)}</C>
        <C c={YELLOW}>{n}</C>
      </button>
    );

  const socialLinks = (indent: string, colour: Colour) =>
    SOCIAL_PAGES.map((s) =>
      row(
        <a className={styles.link} href={s.href} target="_blank" rel="noopener noreferrer">
          {indent}
          <C c={colour}>{leader(s.label, s.page, indent.length)}</C>
          <C c={YELLOW}>{s.page}</C>
        </a>,
        { key: s.page }
      )
    );

  let body: ReactNode;
  if (page === 100) {
    body = (
      <>
        {row(
          <>
            <C c={YELLOW}> ▀▀▀ </C>
            <C c={WHITE}>The pages of {WORD}</C>
            <C c={YELLOW}> ▀▀▀</C>
          </>,
          { bg: BLUE }
        )}
        <h1
          className={styles.blocks}
          style={{ ["--word-cols"]: WORD_COLS, ["--row"]: rowIndex++ } as CSSProperties}
          aria-label={WORD}
        >
          {WORD_CELLS.map((colour, i) => (
            <span key={i} className={colour ? styles[`bg_${colour}`] : undefined} />
          ))}
        </h1>
        {indexLink(`Connect to ${WORD}`, 200, GREEN)}
        {indexLink("Links", 300)}
        {socialLinks("   ", WHITE)}
        {indexLink("Other channels", 500)}
        {row()}
        {row(
          <>
            <C c={WHITE}> NEWS </C>
            <span className={styles.flash}>
              <C c={YELLOW}>▶</C>
            </span>
            <C c={WHITE}> {HEADLINES[headline]}</C>
          </>,
          { bg: RED }
        )}
      </>
    );
  } else if (page === 200) {
    body = (
      <>
        {row(<C c={BLUE}> CONNECT </C>, { dh: true, bg: GREEN })}
        {row()}
        {row(<C c={WHITE}> There is a server at the end of this</C>)}
        {row(<C c={WHITE}> line. Type this into a terminal:</C>)}
        {row()}
        {row(
          <button type="button" className={styles.link} onClick={handleCopy} title="Copy to clipboard">
            <C c={GREEN}> {SSH_COMMAND}</C>
          </button>,
          { bg: BLUE }
        )}
        {row()}
        {row(<C c={CYAN}> Click the command to copy it.</C>)}
        {row(
          <>
            {copied ? (
              <span className={styles.flash}>
                <C c={YELLOW}> COPIED TO CLIPBOARD</C>
              </span>
            ) : (
              " "
            )}
            <span className={styles.srOnly} aria-live="polite">
              {copied ? "copied to clipboard" : ""}
            </span>
          </>
        )}
        {row()}
        {row(<C c={MAGENTA}> Q. What happens when you connect?</C>)}
        {row(
          <>
            <C c={MAGENTA}> A. </C>
            <button
              type="button"
              className={`${styles.link} ${revealed ? styles.fg_white : styles.concealed}`}
              onClick={() => setRevealed((r) => !r)}
            >
              {revealed ? "Ask it and find out." : "Press ? to reveal"}
            </button>
          </>
        )}
      </>
    );
  } else if (page === 300) {
    body = (
      <>
        {row(<C c={BLUE}> LINKS </C>, { dh: true, bg: CYAN })}
        {row()}
        {row(<C c={WHITE}> Elsewhere on the network:</C>)}
        {row()}
        {socialLinks(" ", CYAN)}
        {row()}
        {row(<C c={GREEN}> Key in a page number to leave</C>)}
        {row(<C c={GREEN}> {WORD.toUpperCase()}FAX.</C>)}
      </>
    );
  } else {
    body = (
      <>
        {row(<C c={BLUE}> OTHER CHANNELS </C>, { dh: true, bg: YELLOW })}
        {row()}
        {row(<C c={WHITE}> Retune to another look:</C>)}
        {row()}
        {CHANNELS.map((c) =>
          row(
            <a className={styles.link} href={`/?theme=${c.id}`}>
              {" "}
              <C c={CYAN}>{leader(c.label, c.page)}</C>
              <C c={YELLOW}>{c.page}</C>
            </a>,
            { key: c.page }
          )
        )}
      </>
    );
  }

  return (
    <main className={styles.room}>
      <div className={styles.set}>
        <div className={styles.tv}>
          <div className={styles.screen}>
            <div className={styles.page}>
              <div className={`${styles.row} ${styles.header}`}>
                <C c={WHITE}>{keyed.padEnd(6)}</C>
                <C c={YELLOW}>{WORD.toUpperCase()}FAX</C>
                <C c={WHITE}> {String(headerNum).padStart(3)} {date} </C>
                <C c={YELLOW}>{time}</C>
              </div>

              <div className={styles.body} key={paint}>
                {searching !== null && !PAGES.has(searching) ? null : body}
              </div>

              <nav className={styles.fastext} aria-label="Fastext">
                {FASTEXT.map((f) => (
                  <button
                    type="button"
                    key={f.page}
                    className={`${styles.fast} ${styles[`bg_${f.colour}`]}`}
                    onClick={() => goto(f.page)}
                  >
                    {f.label}
                  </button>
                ))}
              </nav>
            </div>
          </div>
        </div>

        <div className={styles.remote} aria-label="Remote control">
          <div className={styles.keypad}>
            {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
              <button type="button" key={d} className={styles.key} onClick={() => pressDigit(d)}>
                {d}
              </button>
            ))}
            <button
              type="button"
              className={styles.key}
              onClick={() => setRevealed((r) => !r)}
              aria-label="Reveal"
              title="Reveal"
            >
              ?
            </button>
            <button type="button" className={styles.key} onClick={() => pressDigit("0")}>
              0
            </button>
            <button
              type="button"
              className={styles.key}
              onClick={() => goto(100)}
              aria-label="Index"
              title="Index"
            >
              ⌂
            </button>
          </div>
          <div className={styles.fastKeys}>
            {FASTEXT.map((f) => (
              <button
                type="button"
                key={f.page}
                className={`${styles.fastKey} ${styles[`bg_${f.colour}`]}`}
                onClick={() => goto(f.page)}
                aria-label={f.label}
                title={f.label}
              />
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
