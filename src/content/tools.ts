import type { EngineeringCategory, StudentCategory, ToolKind, ToolMeta } from "./tool-types";
import { engineeringTools } from "./tools-engineering";
import { studentTools } from "./tools-student";

export const toolSections = {
  engineering: {
    base: "/tools",
    label: "Tools",
    categories: [
      "AI Engineering",
      "Developer Utilities",
      "Data and APIs",
      "Text and Content",
      "Testing and Validation",
    ] satisfies EngineeringCategory[],
  },
  student: {
    base: "/student-tools",
    label: "Student tools",
    categories: [
      "Academic Calculators",
      "Study Productivity",
      "Writing and References",
      "Programming Practice",
      "Learning Resources",
    ] satisfies StudentCategory[],
  },
} as const;

export { engineeringTools, studentTools };

export const allTools: ToolMeta[] = [...engineeringTools, ...studentTools];

export function getTool(kind: ToolKind, slug: string) {
  return (kind === "engineering" ? engineeringTools : studentTools).find((t) => t.slug === slug);
}

export const toolHref = (t: Pick<ToolMeta, "kind" | "slug">) => `${toolSections[t.kind].base}/${t.slug}`;

