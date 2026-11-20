import { faGithub, faLinkedin, faXTwitter } from "@fortawesome/free-brands-svg-icons";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";

// The shared "DNA" that every theme reinterprets in its own visual language.
// Themes differ wildly in layout, type, and motion — but they all express
// exactly this content: the wordmark, the ssh invitation, the socials and
// a way to the projects page (app/projects), which has a look of its own.

export const WORD = "jonnii";

export const SSH_COMMAND = "ssh -p 56170 why.jonnii.com";

export interface Social {
  label: string;
  href: string;
  icon: IconDefinition;
}

export const SOCIALS: Social[] = [
  {
    label: "LinkedIn",
    href: "https://www.linkedin.com/in/jonathan-goldman-%F0%9F%A7%8D-0661781/",
    icon: faLinkedin,
  },
  {
    label: "GitHub",
    href: "https://github.com/jonnii",
    icon: faGithub,
  },
  {
    label: "X (Twitter)",
    href: "https://x.com/jonnii",
    icon: faXTwitter,
  },
];

export interface Project {
  /** Display name. */
  name: string;
  /** Lowercase slug, handy for terminal/file-style themes. */
  slug: string;
  /** One-liner, from the project's own site where possible. */
  blurb: string;
  /** Even shorter, for tight spots (signs, planets, cards). */
  short: string;
  href: string;
  /** Where the link goes, shown as a hint (domain, "GitHub", …). */
  host: string;
  /** What kind of thing it is. */
  kind: string;
}

// The projects on the projects page, most important first.
export const PROJECTS: Project[] = [
  {
    name: "Good Grieves",
    slug: "goodgrieves",
    blurb: "Property tax grievances, minus the grief.",
    short: "property tax grievances",
    href: "https://goodgrieves.com",
    host: "goodgrieves.com",
    kind: "Website",
  },
  {
    name: "Figgle",
    slug: "figgle",
    blurb: "Ten new puzzles a day for kids 5 and up.",
    short: "daily puzzles for kids",
    href: "https://spoobird.com",
    host: "spoobird.com",
    kind: "iPhone app",
  },
  {
    name: "Spoobird",
    slug: "spoobird",
    blurb: "A small studio making iPhone apps for kids.",
    short: "apps for kids",
    href: "https://spoobird.com",
    host: "spoobird.com",
    kind: "Studio",
  },
  {
    name: "Stackit",
    slug: "stackit",
    blurb: "Stacked git branches and PRs, from the command line.",
    short: "stacked git PRs",
    href: "https://github.com/getstackit/stackit",
    host: "github.com",
    kind: "CLI",
  },
  {
    name: "platekit",
    slug: "platekit",
    blurb: "SVG license plates for React, all 50 states and DC.",
    short: "SVG plates for React",
    href: "https://jonnii.github.io/platekit/",
    host: "github.io",
    kind: "npm package",
  },
];

// How long to show the "copied" confirmation after the ssh chip is clicked.
export const COPY_FEEDBACK_MS = 1500;
