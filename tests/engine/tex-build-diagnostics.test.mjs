// Licensed under the GNU General Public License v2 or later. See LICENSE.
// Builds report cases the way the app does (buildProjectPdf, .latexmkrc, XeLaTeX) and compares the diagnostics with the
// ones recorded before the log reader knew which file is open. Messages, kinds and tokens must not change; locations may
// only be added where none was known, and each one is listed in expected.json. UPDATE_BASELINE=1 rewrites expected.json.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";

const require = createRequire(import.meta.url);
const { buildProjectPdf } = require("../../build/engine/index.cjs");
const texbin = ["/Library/TeX/texbin", "/opt/homebrew/bin", "/usr/local/bin"].find(dir => existsSync(join(dir, "latexmk")));
const env = { ...process.env, ...(texbin ? { PATH: `${texbin}${delimiter}${process.env.PATH ?? ""}` } : {}) };
const installed = !spawnSync("latexmk", ["-v"], { env }).error && !spawnSync("xelatex", ["--version"], { env }).error;
const fixtures = "tests/fixtures/tex-diagnostics";

const part = "Text in a part.\n\nA missing reference \\ref{nowhere}.\n";
const cases = {
  "report-two-column": { "main.tex": readFileSync("tests/tex/report-two-column.tex", "utf8") },
  "thesis-one-column": { "main.tex": readFileSync("tests/tex/thesis-one-column.tex", "utf8") },
  "reference-undefined": { "main.tex": readFileSync("tests/tex/reference-undefined.tex", "utf8") },
  "input-warning": { "main.tex": "\\documentclass[language=english]{.labforge}\n\\begin{document}\nIntro.\n\\input{chapters/part}\nAfter \\ref{alsomissing}.\n\\end{document}\n", "chapters/part.tex": part },
  "input-error": { "main.tex": "\\documentclass[language=english]{.labforge}\n\\begin{document}\nIntro.\n\\input{chapters/part}\n\\end{document}\n", "chapters/part.tex": part + "Broken \\doesnotexist here.\n" },
};

async function diagnostics(files) {
  const root = mkdtempSync(join(tmpdir(), "labforge-diagnostics-")), temporary = mkdtempSync(join(tmpdir(), "labforge-diagnostics-tmp-"));
  cpSync("tests/tex", root, { recursive: true });
  cpSync("assets/framework/labforge.cls", join(root, ".labforge.cls"));
  cpSync("assets/templates/report/settings.tex", join(root, ".settings.tex"));
  writeFileSync(join(root, ".latexmkrc"), "# LabForge build settings, read by latexmk.\n$pdf_mode = 5;\n$aux_dir = '.build';\n$out_dir = '.';\n");
  for (const [file, text] of Object.entries(files)) { mkdirSync(join(root, file, ".."), { recursive: true }); writeFileSync(join(root, file), text); }
  const saved = process.env.PATH; process.env.PATH = env.PATH;
  try { const result = await buildProjectPdf({ archive: null, root, temporary }, "xelatex"); return { success: result.success, issues: result.issues }; }
  finally { process.env.PATH = saved; }
}

test("build diagnostics keep their messages and gain only file locations", { timeout: 900_000 }, async t => {
  if (!installed) return t.skip("XeLaTeX and latexmk are not installed");
  const current = {};
  for (const [name, files] of Object.entries(cases)) current[name] = await diagnostics(files);
  if (process.env.UPDATE_BASELINE) writeFileSync(`${fixtures}/expected.json`, JSON.stringify(current, null, 1) + "\n");
  const baseline = JSON.parse(readFileSync(`${fixtures}/baseline.json`, "utf8"));
  const expected = JSON.parse(readFileSync(`${fixtures}/expected.json`, "utf8"));
  for (const name of Object.keys(cases)) {
    assert.deepEqual(current[name], expected[name], name);
    assert.equal(current[name].success, baseline[name].success, name);
    assert.deepEqual(current[name].issues.map(({ severity, message, token }) => ({ severity, message, token })), baseline[name].issues.map(({ severity, message, token }) => ({ severity, message, token })), name);
    baseline[name].issues.forEach((issue, index) => { if (issue.file) assert.deepEqual([current[name].issues[index].file, current[name].issues[index].line], [issue.file, issue.line], name); });
  }
});
