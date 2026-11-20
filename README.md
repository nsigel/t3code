# LaTeX parity tools

Used for nsigel/t3code#4. Not part of the product; this branch shares no history with it.

- `corpus.json`: the formulas. `tex` is one formula (`"display": true` for `$$…$$`), `markdown` is a whole message. `want` says what the reader should see when that is not simply "what KaTeX does": `drawn`, or `source` (the TeX stays readable as text).
- `verify.mjs`: renders every entry with a checkout's own Markdown pipeline and with KaTeX, and fails an entry when the two disagree on whether a formula is drawn.
- `evidence.mjs`: screenshots Markdown as a checkout renders it, beside KaTeX and beside an earlier render, for the before/after pictures in the PRs.

From `apps/web` of a checkout on the Words renderer:

```sh
node --import <here>/resolve.mjs <here>/verify.mjs
node --import <here>/resolve.mjs <here>/evidence.mjs render --md '$$E = mc^2 \tag{1}$$' --out after.json
node <here>/evidence.mjs page --after after.json --main --png out.png
```

The score counts formulas, not pixels. Spacing, sizes and stroke weights are compared by eye in the pictures.
