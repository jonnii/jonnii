import { faGithub, faLinkedin, faXTwitter } from "@fortawesome/free-brands-svg-icons";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";

// The shared "DNA" that every theme reinterprets in its own visual language.
// Themes differ wildly in layout, type, and motion — but they all express
// exactly this content: the wordmark, the ssh invitation, and the socials.

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

// How long to show the "copied" confirmation after the ssh chip is clicked.
export const COPY_FEEDBACK_MS = 1500;
