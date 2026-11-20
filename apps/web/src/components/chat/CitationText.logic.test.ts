import { describe, expect, it } from "vite-plus/test";

import { citationSegments } from "./CitationText.logic";

const QUADRATIC = String.raw`\(x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}\)`;
const EULER = String.raw`\(e^{i\pi} + 1 = 0\)`;

describe("citationSegments", () => {
  it.each([
    { name: "plain text", text: "the roots are x and y", maxLength: 64, want: null },
    {
      name: "a formula cut by context",
      text: String.raw`\frac{-b}{2a}\) and so`,
      maxLength: 64,
      want: null,
    },
    {
      name: "text and formulas, flattened",
      text: `the roots\n are ${QUADRATIC} and Euler says ${EULER}.`,
      maxLength: 200,
      want: [
        { type: "text", text: "the roots are ", start: 0 },
        { type: "math", source: QUADRATIC, start: 15 },
        { type: "text", text: " and Euler says ", start: 15 + QUADRATIC.length },
        { type: "math", source: EULER, start: 31 + QUADRATIC.length },
        { type: "text", text: ".", start: 31 + QUADRATIC.length + EULER.length },
      ],
    },
    {
      name: "a formula that starts within the budget stays whole",
      text: `the roots are ${QUADRATIC} and Euler says ${EULER}.`,
      maxLength: 20,
      want: [
        { type: "text", text: "the roots are ", start: 0 },
        { type: "math", source: QUADRATIC, start: 14 },
        { type: "text", text: "…", start: 14 + QUADRATIC.length },
      ],
    },
    {
      name: "text past the budget is cut with an ellipsis",
      text: `${EULER} holds for every reader of this sentence`,
      maxLength: EULER.length + 10,
      want: [
        { type: "math", source: EULER, start: 0 },
        { type: "text", text: " holds for…", start: EULER.length },
      ],
    },
    {
      name: "a cut does not split a surrogate pair",
      text: `${EULER} 😀😀`,
      maxLength: EULER.length + 4,
      want: [
        { type: "math", source: EULER, start: 0 },
        { type: "text", text: " 😀…", start: EULER.length },
      ],
    },
    {
      name: "a formula that ends the text needs no ellipsis",
      text: `so ${EULER}`,
      maxLength: 4,
      want: [
        { type: "text", text: "so ", start: 0 },
        { type: "math", source: EULER, start: 3 },
      ],
    },
  ])("$name", ({ text, maxLength, want }) => {
    expect(citationSegments(text, maxLength)).toEqual(want);
  });
});
