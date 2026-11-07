// Licensed under the GNU General Public License v2 or later. See LICENSE.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { EditorState } from "@codemirror/state";
import { argumentKind, readSource, sourceRegions } from "../../source/app/source-reader";

const pieces = ["$", "$$", "\\[", "\\]", "%", "\n", "\n\n", "{", "}", "[", "]", "\\cite", "\\textbf", "\\begin{equation}", "\\end{equation}", "\\verb|", "word ", "\\", "\\begin{verbatim}", "\\end{verbatim}"];

test("regions cover commands, arguments with their kinds, math, comments and verbatim", () => {
  const text = "Some \\cite[p. 2]{key} $x$ % note\n\\textbf{bold \\ref{a}} \\verb|v| \\begin{equation}y\\end{equation}";
  const regions = readSource(text).regions.map(region => `${region.kind}${region.argument ? `:${region.argument}` : ""} ${text.slice(region.from, region.to)}`);
  assert.deepEqual(regions, [
    "prose Some ", "command \\cite", "argument:key [p. 2]", "argument:citation {key}", "prose  ", "math $x$", "prose  ", "comment % note", "prose \n",
    "command \\textbf", "argument:text {bold \\ref{a}}", "prose {bold ", "command \\ref", "argument:label {a}", "prose } ", "command \\verb", "verbatim |v|", "prose  ",
    "command \\begin", "argument:key {equation}", "math y\\end{equation}",
  ]);
  assert.equal(argumentKind("mysection"), "text");
  assert.equal(argumentKind("labforgesetup"), "key");
});

test("the cached regions after any edit equal a fresh reading", () => {
  const texts = [readFileSync("tests/tex/report-two-column.tex", "utf8"), readFileSync("assets/templates/report/main.tex", "utf8")];
  let seed = 7;
  const random = (n: number) => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % n; };
  for (const text of texts) {
    let state = EditorState.create({ doc: text, extensions: [sourceRegions] });
    for (let round = 0; round < 400; round++) {
      const length = state.doc.length, from = random(length + 1), to = Math.min(length, from + random(4));
      const insert = random(3) ? pieces[random(pieces.length)] : "";
      state = state.update({ changes: { from, to, insert } }).state;
      assert.deepEqual(state.field(sourceRegions), readSource(state.doc.toString()).regions, `round ${round}`);
    }
  }
});
