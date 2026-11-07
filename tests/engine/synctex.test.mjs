// Licensed under the GNU General Public License v2 or later. See LICENSE.
// SyncTeX links between main.pdf and the source: the output readers, then a report built the way the app builds it,
// asked for a line's place in the PDF and for the line back from that place, in main.tex and in a table file.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";

const require = createRequire(import.meta.url);
const { buildProjectPdf, parseEdit, parseView, pdfAt, sourceAt } = require("../../build/engine/index.cjs");
const texbin = ["/Library/TeX/texbin", "/opt/homebrew/bin", "/usr/local/bin"].find(dir => existsSync(join(dir, "latexmk")));
const env = { ...process.env, ...(texbin ? { PATH: `${texbin}${delimiter}${process.env.PATH ?? ""}` } : {}) };
const installed = !spawnSync("latexmk", ["-v"], { env }).error && !spawnSync("xelatex", ["--version"], { env }).error && !spawnSync("synctex", ["help"], { env }).error;

test("synctex edit output gives a project-relative file and line", () => {
  const root = "/tmp/report";
  const output = "SyncTeX result begin\nOutput:main.pdf\nInput:/tmp/report/./tables/size.tex\nLine:3\nColumn:-1\nOffset:0\nContext:\nSyncTeX result end\n";
  assert.deepEqual(parseEdit(output, root), { file: "tables/size.tex", line: 3 });
  assert.equal(parseEdit(output.replace("/tmp/report/./tables/size.tex", "/usr/local/texlive/latex.ltx"), root), null);
  assert.equal(parseEdit("SyncTeX result begin\nSyncTeX result end\n", root), null);
});

test("synctex view output gives boxes with their top edge", () => {
  const output = "SyncTeX result begin\nOutput:main.pdf\nPage:2\nx:139.5\ny:125.7\nh:72.0\nv:128.0\nW:451.2\nH:9.3\nbefore:\noffset:-1\nmiddle:\nafter:\nPage:2\nx:0\ny:0\nh:72.0\nv:140.0\nW:0\nH:9.3\nSyncTeX result end\n";
  const boxes = parseView(output);
  assert.equal(boxes.length, 1, "a box without width is left out");
  assert.equal(boxes[0].page, 2);
  assert.ok(Math.abs(boxes[0].top - 118.7) < 1e-9 && boxes[0].left === 72 && boxes[0].width === 451.2);
});

test("a built report links its lines to the PDF and back", { timeout: 300_000 }, async t => {
  if (!installed) return t.skip("XeLaTeX, latexmk and synctex are not installed");
  const root = mkdtempSync(join(tmpdir(), "labforge-synctex-")), temporary = mkdtempSync(join(tmpdir(), "labforge-synctex-tmp-"));
  cpSync("assets/framework/labforge.cls", join(root, ".labforge.cls"));
  cpSync("assets/templates/report/settings.tex", join(root, ".settings.tex"));
  writeFileSync(join(root, ".latexmkrc"), "# LabForge build settings, read by latexmk.\n$pdf_mode = 5;\n$aux_dir = '.build';\n$out_dir = '.';\n");
  mkdirSync(join(root, "tables"));
  writeFileSync(join(root, "tables", "values.tex"), "\\begin{labtable}{l r}\n    \\tablehead{Name & Value}\n    Alpha & 1 \\\\\n    Beta & 2 \\\\\n\\end{labtable}\n");
  writeFileSync(join(root, "main.tex"), [
    "\\documentclass[language=english]{.labforge}", "\\begin{document}", "\\mysection{First}", "A first paragraph of words.", "",
    "A second paragraph on line six.", "\\mytable[caption={Values.}]{values.tex}", "\\newpage", "Text on the second page.", "\\end{document}", ""].join("\n"));
  const saved = process.env.PATH; process.env.PATH = env.PATH;
  try {
    const result = await buildProjectPdf({ archive: null, root, temporary }, "xelatex");
    assert.ok(result.success, result.summary);
    assert.ok(existsSync(join(root, "main.synctex.gz")), "the build writes the SyncTeX file");

    const second = await pdfAt(root, "main.tex", 6);
    assert.ok(second.length, "line 6 has a place in the PDF");
    assert.equal(second[0].page, 1);
    const back = await sourceAt(root, 1, second[0].left + 20, second[0].top + second[0].height / 2);
    assert.deepEqual(back, { file: "main.tex", line: 6 });

    const lastPage = await pdfAt(root, "main.tex", 9);
    assert.equal(lastPage[0]?.page, 2, "text after \\newpage is on page 2");

    const row = await pdfAt(root, "tables/values.tex", 3);
    assert.ok(row.length, "a table row has a place in the PDF");
    const rowBack = await sourceAt(root, row[0].page, row[0].left + 5, row[0].top + row[0].height / 2);
    assert.equal(rowBack?.file, "tables/values.tex");
  } finally { process.env.PATH = saved; }
});
