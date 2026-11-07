// Licensed under the GNU General Public License v2 or later. See LICENSE.
// Previews of generated tables and plots, built with the report class; skipped without latexmk and XeLaTeX.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const preview = require("../../build/engine/index.cjs");
const texbin = ["/Library/TeX/texbin", "/opt/homebrew/bin", "/usr/local/bin"].find(dir => existsSync(join(dir, "latexmk")));
const env = { ...process.env, ...(texbin ? { PATH: `${texbin}${delimiter}${process.env.PATH ?? ""}` } : {}) };
const installed = !spawnSync("latexmk", ["-v"], { env }).error && !spawnSync("xelatex", ["--version"], { env }).error;

const main = readFileSync("assets/templates/report/main.tex", "utf8");
const request = (code, kind = "plot", cacheDir = mkdtempSync(join(tmpdir(), "labforge-preview-"))) =>
  ({ kind, code, classFile: "assets/framework/labforge.cls", mainTex: main, settings: readFileSync("assets/templates/report/settings.tex", "utf8"), builder: "xelatex", cacheDir });

test("the preview document takes the report's class options without the bibliography", () => {
  assert.equal(preview.previewClassOptions("% \\documentclass[preset=default]{labforge}\n\\documentclass[preset=thesis, language=english, bibliography]{labforge}"), "preset=thesis, language=english");
  assert.equal(preview.previewClassOptions("no class line"), "");
  assert.match(preview.previewDocument("table", "preset=report"), /\\documentclass\[preset=report\]\{\.labforge\}[\s\S]*\\mytable\{preview\.tex\}/);
  assert.match(preview.previewDocument("plot", "", "width=0.8, height=6cm"), /\\myplot\[width=0\.8, height=6cm\]\{preview\.tex\}/);
  assert.equal(preview.previewKeys("width=0.8}\\input{x}"), "", "only plain width and height keys reach the preview");
  assert.match(preview.previewDocument("table", ""), /\\labforgesetup\{block-space=0, block-gap=0\}[\s\S]*\\begin\{document\}/, "no blank lines around the block in a preview");
  // The report's own settings and commands come along, between the class line and the preview's own lines.
  const main = "\\documentclass[preset=default]{labforge}\n\\newcommand{\\vect}[1]{#1}\n% ====\n% Main writing section\n% ====\n\\begin{document}\n\\end{document}\n";
  assert.match(preview.previewDocument("plot", "preset=default", "", "\n\\newcommand{\\vect}[1]{#1}\n"), /\{\.labforge\}\n\\newcommand\{\\vect\}\[1\]\{#1\}\n\\usepackage\[active,tightpage\]\{preview\}/);
  assert.equal(main.includes("vect"), true);
});

test("a plot preview builds once and is then read from the cache", { skip: !installed && "latexmk and XeLaTeX are not installed" }, async () => {
  const code = readFileSync("tests/tex/plots/absorbance.tex", "utf8");
  const first = await preview.previewGenerated(request(code));
  assert.equal(first.error, null);
  assert.equal(first.cached, false);
  assert.equal(Buffer.from(first.pdf.subarray(0, 5)).toString(), "%PDF-");
  const cacheDir = request(code).cacheDir;
  const again = await preview.previewGenerated({ ...request(code), cacheDir });
  const cached = await preview.previewGenerated({ ...request(code), cacheDir });
  assert.equal(again.cached, false);
  assert.equal(cached.cached, true);
  assert.deepEqual(readdirSync(cacheDir).filter(name => !name.endsWith(".pdf")), [], "build folders are removed");
});

test("a table preview builds, and an error names its line", { skip: !installed && "latexmk and XeLaTeX are not installed" }, async () => {
  const table = await preview.previewGenerated(request(readFileSync("tests/tex/tables/constants.tex", "utf8"), "table"));
  assert.equal(table.error, null);
  const broken = await preview.previewGenerated(request("\\begin{tikzpicture}\n\\begin{axis}\n\\addplot {x\n\\end{axis}\n\\end{tikzpicture}\n"));
  assert.equal(broken.pdf, null);
  assert.ok(broken.error, "a problem is reported");
  const undefinedCommand = await preview.previewGenerated(request("\\begin{labtable}{l}\n    \\nosuchcommand\n\\end{labtable}\n", "table"));
  assert.match(undefinedCommand.error, /^line 2: Undefined control sequence/);
});
