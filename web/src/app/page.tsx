import styles from "./page.module.css";

export default function Home() {
  const word = "jonnii";
  const rows = Array.from({ length: 6 }, (_, index) => index);
  const highlightPalette = [
    "#ff4d4f",
    "#fa8c16",
    "#fadb14",
    "#52c41a",
    "#40a9ff",
    "#9254de",
  ];

  return (
    <main className={styles.container}>
      {rows.map((rowIndex) => {
        const highlightIndex = rowIndex; // row index + 1 (1-based) -> same as 0-based index
        return (
          <div key={rowIndex} className={styles.row} aria-label={word}>
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
    </main>
  );
}
