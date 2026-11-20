import type { Metadata } from "next";
import ProjectsSelect from "./ProjectsSelect";

export const metadata: Metadata = {
  title: "jonnii · projects",
  description: "Choose your fighter: the things jonnii is building.",
};

// One projects page with its own look (a fighting-game character select),
// linked from every themed homepage.
export default function ProjectsPage() {
  return <ProjectsSelect />;
}
