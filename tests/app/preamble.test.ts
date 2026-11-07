// Licensed under the GNU General Public License v2 or later. See LICENSE.
import test from "node:test";
import assert from "node:assert/strict";
import { addToPreamble, preambleRange, preambleText } from "../../source/engine/preamble";

const rule = "% ============================================================";
const main = (preamble: string) => `\\documentclass[preset=default]{labforge}\n${preamble}\n${rule}\n% Main writing section\n${rule}\n\n\\begin{document}\ntext\n\\end{document}\n`;

test("the preamble is what lies between the class line and the main writing section", () => {
  const text = main("\n\\labforgesetup{margin = 2cm}\n");
  assert.equal(preambleText(text), "\n\n\\labforgesetup{margin = 2cm}\n\n");
  const range = preambleRange(text)!;
  assert.equal(text.slice(range.to, range.to + rule.length), rule);
  // Without the marker it ends before \begin{document}.
  const plain = "\\documentclass{labforge}\n\\newcommand{\\a}{b}\n\\begin{document}\nx\n\\end{document}\n";
  assert.equal(preambleText(plain), "\n\\newcommand{\\a}{b}\n");
  assert.equal(preambleRange("no class line"), null);
  assert.equal(preambleRange("% \\documentclass{labforge}\n"), null);
});

test("a block is added at the end of the preamble, set off by a blank line each side", () => {
  const added = addToPreamble(main("\n\\labforgesetup{margin = 2cm}\n"), "\\newcommand{\\a}{b}")!;
  assert.equal(added.text, main("\n\\labforgesetup{margin = 2cm}\n\n\\newcommand{\\a}{b}\n"));
  assert.equal(added.text.slice(added.at, added.at + 8), "\\newcomm");
  const again = addToPreamble(added.text, "% A note.\n\\newcommand{\\c}{d}\n")!;
  assert.ok(again.text.includes("\\newcommand{\\a}{b}\n\n% A note.\n\\newcommand{\\c}{d}\n\n" + rule));
  assert.equal(addToPreamble("no class line", "x"), null);
});
