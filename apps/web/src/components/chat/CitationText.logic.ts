import type { AssistantCitation } from "@t3tools/contracts";
import { splitsSurrogatePair } from "@t3tools/shared/assistantCitations";

import { markdownMathRanges } from "../../markdown/wordsHast";

export type CitationSegment =
  | { readonly type: "text"; readonly text: string; readonly start: number }
  | { readonly type: "math"; readonly source: string; readonly start: number };

export function citationSegments(text: string, maxLength: number): CitationSegment[] | null {
  const ranges = markdownMathRanges(text);
  if (ranges.length === 0) return null;
  const segments: CitationSegment[] = [];
  let remaining = maxLength;
  let cursor = 0;
  const addText = (start: number, end: number) => {
    const flat = text.slice(start, end).replace(/\s+/g, " ");
    if (flat.length === 0) return true;
    if (remaining <= 0) {
      segments.push({ type: "text", text: "…", start });
      return false;
    }
    if (flat.length > remaining) {
      const cut = splitsSurrogatePair(flat, remaining) ? remaining - 1 : remaining;
      segments.push({ type: "text", text: `${flat.slice(0, cut)}…`, start });
      return false;
    }
    remaining -= flat.length;
    segments.push({ type: "text", text: flat, start });
    return true;
  };
  for (const range of ranges) {
    if (!addText(cursor, range.start)) return segments;
    if (remaining <= 0) {
      segments.push({ type: "text", text: "…", start: range.start });
      return segments;
    }
    const source = text.slice(range.start, range.end);
    segments.push({ type: "math", source, start: range.start });
    remaining -= source.length;
    cursor = range.end;
  }
  addText(cursor, text.length);
  return segments;
}

export const CITATION_CHIP_LENGTH = 64;
export const CITATION_CARD_LENGTH = 600;

export const citationLabelSource = (citation: AssistantCitation) =>
  citation.comment?.trim() || citation.text;
