import { Fragment, type ReactNode } from "react";

import { useClientSettings } from "~/hooks/useSettings";
import { citationSegments, type CitationSegment } from "./CitationText.logic";
import { createMarkdownRenderer } from "./markdownRenderer";

const formulas = createMarkdownRenderer({
  markdown: {
    math: true,
    breaks: false,
    escapeHtml: true,
    insights: false,
    extensions: { preview: { fallback: "", maxLength: Number.POSITIVE_INFINITY } },
  },
  components: {},
  urlTransform: (url) => url,
});

const segmentsByText = new Map<string, CitationSegment[] | null>();

function cachedSegments(text: string, maxLength: number) {
  const key = `${maxLength}\u0000${text}`;
  let segments = segmentsByText.get(key);
  if (segments === undefined) {
    if (segmentsByText.size >= 256) segmentsByText.clear();
    segments = citationSegments(text, maxLength);
    segmentsByText.set(key, segments);
  }
  return segments;
}

function formula(source: string) {
  const entry = formulas.parse(source);
  formulas.remember(source, entry);
  return formulas.element(entry);
}

export function CitationText({
  text,
  maxLength = Number.POSITIVE_INFINITY,
  children,
}: {
  text: string;
  maxLength?: number;
  children: ReactNode;
}) {
  const math = useClientSettings((settings) => settings.mathRenderingEnabled);
  const segments = math ? cachedSegments(text, maxLength) : null;
  if (!segments) return children;
  return (
    <span className="[&_svg]:inline! [&_svg]:h-auto! [&_svg]:max-h-[1.2em] [&_svg]:w-auto! [&_svg]:align-middle!">
      {segments.map((segment) =>
        segment.type === "text" ? (
          segment.text
        ) : (
          <Fragment key={segment.start}>{formula(segment.source)}</Fragment>
        ),
      )}
    </span>
  );
}
