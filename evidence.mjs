// Before/after pictures of Markdown as a checkout renders it, with no dev server.
// Run from <checkout>/apps/web with `node --import <skill>/resolve.mjs <skill>/evidence.mjs …`:
//   render --md '<markdown>' [--md …] --out before.json     (once on the base, once on the fix)
//   page [--before before.json] --after after.json --png out.png [--title '<text>'] [--main]
// `render --corpus <corpus.json>` adds every drawable corpus formula; `page --main` adds a column drawn by KaTeX, as main shows it.
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const [mode, ...args] = process.argv.slice(2);
const all = (name) => args.flatMap((arg, at) => (arg === name ? [args[at + 1]] : []));
const one = (name) => all(name)[0];
const escape = (text) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;");

if (mode === "render") {
  const web = process.cwd();
  const { wordsHast } = await import(pathToFileURL(path.join(web, "src/markdown/wordsHast.ts")).href);
  const require = createRequire(path.join(web, "package.json"));
  const { toHtml } = await import(pathToFileURL(require.resolve("hast-util-to-html")).href);
  const options = { math: true, breaks: false, escapeHtml: false, insights: false, extensions: {} };
  const katex = require("katex");
  const css = pathToFileURL(require.resolve("katex/dist/katex.min.css")).href;
  const tex = (source, displayMode) => {
    try {
      return katex.renderToString(source, { displayMode, throwOnError: true, strict: "ignore" });
    } catch {
      return `<span class="crash">${escape(source)}</span>`;
    }
  };
  const asMain = (md) =>
    `<p>${escape(md)
      .replace(/\$\$([\s\S]+?)\$\$/g, (_, source) => tex(source.replace(/&amp;/g, "&").replace(/&lt;/g, "<"), true))
      .replace(/\$([^$\n]+?)\$/g, (_, source) => tex(source.replace(/&amp;/g, "&").replace(/&lt;/g, "<"), false))}</p>`;
  const sources = all("--md").concat(
    one("--corpus")
      ? JSON.parse(readFileSync(one("--corpus"), "utf8"))
          .filter((entry) => entry.tex && entry.want !== "source")
          .map((entry) => (entry.display ? `$$${entry.tex}$$` : `$${entry.tex}$`))
      : [],
  );
  const rows = sources.map((md) => {
    try {
      return { md, css, main: asMain(md), html: toHtml(wordsHast(md, options)) };
    } catch (error) {
      return { md, css, main: asMain(md), html: `<p class="crash">renderer crashed: ${escape(String(error))}</p>` };
    }
  });
  writeFileSync(one("--out"), JSON.stringify(rows, null, 2));
  console.log(`${rows.length} rendered to ${one("--out")}`);
} else if (mode === "page") {
  const after = JSON.parse(readFileSync(one("--after"), "utf8"));
  const before = one("--before") ? JSON.parse(readFileSync(one("--before"), "utf8")) : null;
  const main = args.includes("--main");
  const png = path.resolve(one("--png"));
  const html = `<!doctype html><meta charset="utf-8"><style>
body{margin:0;padding:24px;font:16px/1.5 -apple-system,system-ui,sans-serif;color:#111;background:#fff}
h1{font-size:15px;margin:0 0 16px;font-weight:600}
table{border-collapse:collapse;width:100%;table-layout:fixed}
th{text-align:left;font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:#666;padding:6px 16px;border-bottom:1px solid #ddd}
td{vertical-align:middle;padding:14px 16px;border-bottom:1px solid #eee;overflow:hidden}
td.src{font:12px/1.4 ui-monospace,Menlo,monospace;color:#555;white-space:pre-wrap;word-break:break-word;width:30%}
[data-markdown-math=display]{display:block;text-align:center}
svg{vertical-align:middle;max-width:100%}
p{margin:0}
.crash{color:#b00020;font:12px ui-monospace,Menlo,monospace}
td svg{font-size:1.21em}
</style>${main ? `<link rel="stylesheet" href="${after[0].css}">` : ""}${one("--title") ? `<h1>${escape(one("--title"))}</h1>` : ""}
<table><tr><th>Source</th>${main ? "<th>main (KaTeX)</th>" : ""}${before ? "<th>Before</th>" : ""}<th>${before ? "After" : "Words branch"}</th></tr>
${after.map((row, at) => `<tr><td class="src">${escape(row.md)}</td>${main ? `<td>${row.main}</td>` : ""}${before ? `<td>${before[at]?.html ?? ""}</td>` : ""}<td class="words">${row.html}</td></tr>`).join("\n")}
</table>`;
  const page = png.replace(/\.png$/, ".html");
  writeFileSync(page, html);
  const height = 110 + after.reduce((sum, row) => sum + 90 + 40 * row.md.split("\n").length, 0);
  execFileSync(
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    ["--headless=new", "--hide-scrollbars", "--force-device-scale-factor=2", `--window-size=1100,${height}`, `--screenshot=${png}`, pathToFileURL(page).href],
    { stdio: "ignore" },
  );
  console.log(png);
} else {
  console.error("usage: evidence.mjs render --md '<markdown>' … --out file.json | page --before a.json --after b.json --png out.png");
  process.exitCode = 1;
}
