"use client";
import { useEffect, useState } from "react";
import { PROJECTS } from "./content";
import styles from "./projectsFolder.module.css";

// A "Projects" folder on the Win95 desktop. Click it and an Explorer window
// opens listing the projects (name, what it is, where it goes). Rendered by
// the shared taskbar, so every Win95-flavoured theme gets it for free.

export default function ProjectsFolder() {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(0);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        className={styles.desktopIcon}
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
      >
        <span className={styles.bigFolder} aria-hidden="true" />
        <span className={styles.iconLabel}>Projects</span>
      </button>

      {open && (
        <div className={styles.backdrop} onClick={() => setOpen(false)}>
          <section
            className={`${styles.window} ${styles.raised}`}
            role="dialog"
            aria-label="Projects"
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.titlebar}>
              <span className={styles.smallFolder} aria-hidden="true" />
              <span className={styles.titleText}>C:\jonnii\Projects</span>
              <button
                type="button"
                className={`${styles.titleBtn} ${styles.raised}`}
                onClick={() => setOpen(false)}
                aria-label="Close"
              >
                &#10005;
              </button>
            </div>
            <div className={styles.menu} aria-hidden="true">
              <span>
                <u>F</u>ile
              </span>
              <span>
                <u>E</u>dit
              </span>
              <span>
                <u>V</u>iew
              </span>
              <span>
                <u>H</u>elp
              </span>
            </div>
            <div className={`${styles.list} ${styles.sunken}`}>
              <div className={styles.header} aria-hidden="true">
                <span>Name</span>
                <span>Description</span>
                <span>Type</span>
              </div>
              <ul>
                {PROJECTS.map((p, i) => (
                  <li key={p.name}>
                    <a
                      className={styles.item}
                      href={p.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      data-selected={i === selected ? "true" : undefined}
                      onMouseEnter={() => setSelected(i)}
                      onFocus={() => setSelected(i)}
                    >
                      <span className={styles.name}>
                        <span className={styles.exe} aria-hidden="true">
                          {p.name.charAt(0)}
                        </span>
                        {p.name}
                      </span>
                      <span className={styles.desc}>{p.blurb}</span>
                      <span className={styles.kind}>{p.kind}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
            <div className={styles.status}>
              <span className={styles.sunkenThin}>{PROJECTS.length} object(s)</span>
              <span className={styles.sunkenThin}>{PROJECTS[selected]?.host}</span>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
