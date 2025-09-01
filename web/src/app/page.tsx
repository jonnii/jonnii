import styles from "./page.module.css";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faGithub, faLinkedin, faXTwitter } from "@fortawesome/free-brands-svg-icons";

export default function Home() {
  const word = "jonnii";
  const rows = Array.from({ length: 6 }, (_, index) => index);
  const highlightPalette = [
    "var(--red)",
    "var(--orange)",
    "var(--yellow)",
    "var(--green)",
    "var(--blue)",
    "var(--violet)",
  ];

  return (
    <main className={styles.container}>
      {rows.map((rowIndex) => {
        const highlightIndex = rowIndex;
        return (
          <div
            key={rowIndex}
            className={styles.row}
            aria-label={word}
            style={{ ['--accent' as any]: highlightPalette[rowIndex] }}
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
