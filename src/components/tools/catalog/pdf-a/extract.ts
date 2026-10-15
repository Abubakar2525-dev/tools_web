import { groupLines, type Line, type RawItem } from "./lib/text";
import type { PdfJsDoc } from "./shared";

/** Reads the text layer of one page (1-based) and groups it into lines. */
export async function extractLines(doc: PdfJsDoc, page: number): Promise<Line[]> {
  const pg = await doc.getPage(page);
  const content = await pg.getTextContent();
  const items: RawItem[] = [];
  for (const it of content.items) {
    if ("str" in it) items.push({ str: it.str, transform: it.transform as number[], width: it.width, height: it.height, hasEOL: it.hasEOL });
  }
  pg.cleanup();
  return groupLines(items);
}
