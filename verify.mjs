// Renders a TeX corpus through the checkout's own wordsHast and KaTeX, and reports where they disagree.
// Run from <checkout>/apps/web:  node --import ~/.claude/skills/t3-latex-verify/resolve.mjs ~/.claude/skills/t3-latex-verify/verify.mjs [--json] [--only <id-substring>] [--tex '<tex>']
import { readFileSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const args = process.argv.slice(2);
const flag = (name) => {
  const at = args.indexOf(name);
  return at === -1 ? undefined : (args[at + 1] ?? "");
};
const asJson = args.includes("--json");
const only = flag("--only");
const adHoc = flag("--tex");

const web = process.cwd();
const { wordsHast } = await import(pathToFileURL(path.join(web, "src/markdown/wordsHast.ts")).href);
const katex = createRequire(path.join(web, "package.json"))("katex");

const corpus = adHoc
  ? [{ id: "ad-hoc", tex: adHoc }]
  : JSON.parse(readFileSync(new URL("./corpus.json", import.meta.url), "utf8"));

const OPTIONS = { math: true, breaks: false, escapeHtml: false, insights: false, extensions: {} };

function findMath(node, found = []) {
  if (node.type === "element" && node.properties?.dataMarkdownMath !== undefined) found.push(node);
  else for (const child of node.children ?? []) findMath(child, found);
  return found;
}
function walk(node, visit) {
  visit(node);
  for (const child of node.children ?? []) walk(child, visit);
}
function plainText(node) {
  let text = "";
  walk(node, (n) => {
    if (n.type === "text") text += n.value;
  });
  return text;
}

function katexAccepts(tex, display) {
  try {
    katex.renderToString(tex, { displayMode: display, throwOnError: true, strict: "ignore", trust: false });
    return true;
  } catch {
    return false;
  }
}

const rows = [];
for (const entry of corpus) {
  if (only && !entry.id.includes(only)) continue;
  const display = entry.display === true;
  const markdown = display ? `$$\n${entry.tex}\n$$` : `a $${entry.tex}$ b`;
  let tree;
  try {
    tree = wordsHast(entry.markdown ?? markdown, OPTIONS);
  } catch (error) {
    rows.push({ id: entry.id, tex: entry.tex ?? entry.markdown, outcome: "crash", katexOk: null, want: entry.want ?? "drawn", unknown: [], drawn: "", problems: [`renderer threw: ${error.message}`] });
    continue;
  }
  const unknown = [];
  let drawn = "";
  let svgs = 0;
  // A wrapper with no SVG in it is a formula shown as its source.
  for (const node of findMath(tree)) {
    let hasSvg = false;
    walk(node, (n) => {
      if (n.type !== "element") return;
      if (n.tagName === "svg") hasSvg = true;
      if (n.properties?.fill === "#c00") unknown.push(plainText(n));
    });
    if (!hasSvg) continue;
    svgs++;
    drawn += plainText(node);
  }
  const outcome = svgs === 0 ? "source" : unknown.length > 0 ? "unknown" : "drawn";
  const katexOk = entry.markdown ? null : katexAccepts(entry.tex, display);
  const want = entry.want ?? (katexOk === false ? "source" : "drawn");
  const problems = [];
  if (want === "source" && outcome !== "source") problems.push(`should stay source, was ${outcome}`);
  if (want === "drawn" && outcome !== "drawn") problems.push(`should draw, was ${outcome}`);
  for (const needle of entry.contains ?? []) {
    if (!drawn.includes(needle)) problems.push(`drawn text lacks ${JSON.stringify(needle)}`);
  }
  rows.push({ id: entry.id, tex: entry.tex ?? entry.markdown, outcome, katexOk, want, unknown, drawn, problems });
}

if (asJson) {
  console.log(JSON.stringify(rows, null, 2));
} else {
  const failing = rows.filter((row) => row.problems.length > 0);
  for (const row of rows) {
    const mark = row.problems.length > 0 ? "FAIL" : "ok  ";
    const detail = row.problems.length > 0 ? `  <- ${row.problems.join("; ")}` : "";
    const red = row.unknown.length > 0 ? `  [red: ${row.unknown.join(" ")}]` : "";
    console.log(`${mark} ${row.id.padEnd(26)} ${row.outcome.padEnd(8)} katex=${String(row.katexOk).padEnd(5)}${red}${detail}`);
    if (adHoc) console.log(`     drawn: ${row.drawn}`);
  }
  console.log(`\n${rows.length - failing.length}/${rows.length} match what main (KaTeX) shows; ${failing.length} gaps`);
}
process.exitCode = rows.some((row) => row.problems.length > 0) ? 1 : 0;
