"use client";
import styles from "./teletext.module.css";
import { useEffect, useRef, useState, type ReactNode } from "react";

// A 90s black TV remote. It knows nothing about teletext: every button just
// reports what was pressed, and the theme decides what that does. The little
// red LED by the brand flickers on each press, like the IR transmitter firing.

export type RemoteAction =
  | { type: "digit"; digit: string }
  | { type: "power" }
  | { type: "clear" }
  | { type: "back" }
  | { type: "volume"; delta: 1 | -1 }
  | { type: "page"; delta: 1 | -1 }
  | { type: "fastext"; index: number }
  | { type: "text" }
  | { type: "index" }
  | { type: "reveal" };

const FLASH_MS = 120;
const FASTEXT_CLASSES = [styles.fastRed, styles.fastGreen, styles.fastYellow, styles.fastCyan];

// Teletext keys carry the little screen pictograms printed on real remotes.
const TextIcon = () => (
  <svg viewBox="0 0 16 12" aria-hidden="true">
    <rect x="1" y="1" width="14" height="10" fill="none" stroke="currentColor" strokeWidth="1.4" />
    <path d="M4 4h8M4 6h8M4 8h5" stroke="currentColor" />
  </svg>
);
const IndexIcon = () => (
  <svg viewBox="0 0 16 12" aria-hidden="true">
    <rect x="1" y="1" width="14" height="10" fill="none" stroke="currentColor" strokeWidth="1.4" />
    <path d="M4 4h8M4 6h8" stroke="currentColor" />
    <rect x="5" y="7" width="6" height="3" fill="currentColor" />
  </svg>
);
const RevealIcon = () => (
  <svg viewBox="0 0 16 12" aria-hidden="true">
    <rect x="1" y="1" width="14" height="10" fill="none" stroke="currentColor" strokeWidth="1.4" />
    <text x="8" y="9.5" fontSize="8" textAnchor="middle" fill="currentColor" fontWeight="bold">
      ?
    </text>
  </svg>
);

function Key({
  onClick,
  label,
  className,
  children,
}: {
  onClick: () => void;
  label: string;
  className: string;
  children?: ReactNode;
}) {
  return (
    <button type="button" className={className} onClick={onClick} aria-label={label} title={label}>
      {children}
    </button>
  );
}

interface RemoteProps {
  /** Labels for the four Fastext keys, red to cyan. */
  fastextLabels: string[];
  onPress: (action: RemoteAction) => void;
}

export default function Remote({ fastextLabels, onPress }: RemoteProps) {
  const [flash, setFlash] = useState(false);
  const flashRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (flashRef.current !== null) window.clearTimeout(flashRef.current);
    };
  }, []);

  const press = (action: RemoteAction) => {
    setFlash(true);
    if (flashRef.current !== null) window.clearTimeout(flashRef.current);
    flashRef.current = window.setTimeout(() => setFlash(false), FLASH_MS);
    onPress(action);
  };

  return (
    <div className={styles.remote} role="group" aria-label="Remote control">
      <div className={styles.irWindow} aria-hidden="true" />

      <div className={styles.remoteTop}>
        <span className={`${styles.irLed} ${flash ? styles.irLedOn : ""}`} aria-hidden="true" />
        <span className={styles.brand}>JONNIIVISION</span>
        <Key onClick={() => press({ type: "power" })} label="Power" className={styles.power} />
      </div>

      <div className={styles.numberPad}>
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
          <Key key={d} onClick={() => press({ type: "digit", digit: d })} label={d} className={styles.rubberKey}>
            {d}
          </Key>
        ))}
        <Key onClick={() => press({ type: "clear" })} label="Clear page number" className={`${styles.rubberKey} ${styles.small}`}>
          -/--
        </Key>
        <Key onClick={() => press({ type: "digit", digit: "0" })} label="0" className={styles.rubberKey}>
          0
        </Key>
        <Key onClick={() => press({ type: "back" })} label="Previous page" className={styles.rubberKey}>
          ↺
        </Key>
      </div>

      <div className={styles.rockers}>
        <div className={styles.rocker}>
          <Key onClick={() => press({ type: "volume", delta: 1 })} label="Volume up" className={styles.rockerHalf}>
            +
          </Key>
          <span className={styles.rockerLabel} aria-hidden="true">
            VOL
          </span>
          <Key onClick={() => press({ type: "volume", delta: -1 })} label="Volume down" className={styles.rockerHalf}>
            −
          </Key>
        </div>
        <div className={styles.rocker}>
          <Key onClick={() => press({ type: "page", delta: 1 })} label="Page up" className={styles.rockerHalf}>
            ▲
          </Key>
          <span className={styles.rockerLabel} aria-hidden="true">
            P
          </span>
          <Key onClick={() => press({ type: "page", delta: -1 })} label="Page down" className={styles.rockerHalf}>
            ▼
          </Key>
        </div>
      </div>

      <div className={styles.fastRow}>
        {FASTEXT_CLASSES.map((cls, i) => (
          <Key
            key={i}
            onClick={() => press({ type: "fastext", index: i })}
            label={fastextLabels[i]}
            className={`${styles.fastPill} ${cls}`}
          />
        ))}
      </div>

      <div className={styles.textKeys}>
        <Key onClick={() => press({ type: "text" })} label="Text / Mix / TV" className={styles.textKey}>
          <TextIcon />
        </Key>
        <Key onClick={() => press({ type: "index" })} label="Index" className={styles.textKey}>
          <IndexIcon />
        </Key>
        <Key onClick={() => press({ type: "reveal" })} label="Reveal" className={styles.textKey}>
          <RevealIcon />
        </Key>
        <span className={styles.keyCaption}>TEXT</span>
        <span className={styles.keyCaption}>INDEX</span>
        <span className={styles.keyCaption}>REVEAL</span>
      </div>
    </div>
  );
}
