/** Extracts reason and 1-based line/column from a js-yaml exception. */
export function yamlErrorInfo(e: unknown): { message: string; line: number | null; column: number | null } {
  if (e && typeof e === "object" && "reason" in e) {
    const ex = e as { reason?: string; mark?: { line: number; column: number } };
    return {
      message: ex.reason || "Invalid YAML",
      line: ex.mark ? ex.mark.line + 1 : null,
      column: ex.mark ? ex.mark.column + 1 : null,
    };
  }
  return { message: e instanceof Error ? e.message : String(e), line: null, column: null };
}
