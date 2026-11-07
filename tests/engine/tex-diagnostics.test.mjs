import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { parseBuildDiagnostics, buildFailureSummary } = require("../../build/engine/index.cjs");

test("build diagnostics retain file, line and the offending command", () => {
  const output = "./main.tex:14: Undefined control sequence.\nl.14 \\doesnotexist\nLatexmk: Errors, so I did not complete making targets\n";
  const issues = parseBuildDiagnostics(output);
  assert.deepEqual(issues, [{ severity: "error", message: "Undefined control sequence.", file: "main.tex", line: 14, token: "\\doesnotexist" }]);
  assert.equal(buildFailureSummary(issues, 12), "Undefined control sequence.");
});

test("ambiguous TeX context keeps the line without guessing a token", () => {
  const issues = parseBuildDiagnostics("./main.tex:4: Undefined control sequence.\nl.4 \\first \\second\n");
  assert.equal(issues[0].line, 4);
  assert.equal(issues[0].token, undefined);
});

test("a build with no pages explains the failure", () => {
  const issues = parseBuildDiagnostics("No pages of output.\nLatexmk: Errors, so I did not complete making targets\n");
  assert.deepEqual(issues, [{ severity: "error", message: "The document produced no pages. Add content inside the document environment." }]);
});

test("unlocated TeX errors are retained when there is no file-line diagnostic", () => {
  assert.deepEqual(parseBuildDiagnostics("! LaTeX Error: File `missing.sty' not found.\n"), [
    { severity: "error", message: "LaTeX Error: File `missing.sty' not found." },
  ]);
});

test("warnings take the file TeX was reading, also when its name wraps at 79 characters", () => {
  const { locateWarnings } = require("../../build/engine/index.cjs");
  const name = `./chapters/${"a".repeat(80)}.tex`;
  const first = `(./main.tex (/usr/share/texmf/article.cls) (${name}`.slice(0, 79);
  const log = [first, `(./main.tex (/usr/share/texmf/article.cls) (${name}`.slice(79), "LaTeX Warning: Reference `x' on page 1 undefined on input line 7.", ")", "LaTeX Warning: Reference `y' on page 1 undefined on input line 9.", ")"].join("\n");
  const issues = [
    { severity: "warning", message: "LaTeX Warning: Reference `x' on page 1 undefined on input line 7." },
    { severity: "warning", message: "LaTeX Warning: Reference `y' on page 1 undefined on input line 9." },
    { severity: "warning", message: "LaTeX Warning: There were undefined references." },
  ];
  assert.deepEqual(locateWarnings(issues, log).map(issue => [issue.file, issue.line]), [[name.slice(2), 7], ["main.tex", 9], [undefined, undefined]]);
});
