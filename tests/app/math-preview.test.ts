// Licensed under the GNU General Public License v2 or later. See LICENSE.
import test from "node:test";
import assert from "node:assert/strict";
import katex from "katex";
import "katex/contrib/mhchem";
import { mathAtCursor } from "../../source/app/math-preview";

test("preview finds a framework formula around the cursor and renders its rows", () => {
  const source = "Before\n\\myformula[label=steps]{a &= 1 \\\\ b &= \\ce{H2O}}\nAfter";
  const range = mathAtCursor(source, source.indexOf("H2O"))!;
  assert.equal(range.from, source.indexOf("{a") + 1);
  assert.match(range.tex, /^\\begin\{aligned\}/);
  assert.doesNotThrow(() => katex.renderToString(range.tex, { output: "mathml", displayMode: true }));
  assert.equal(mathAtCursor(source, source.indexOf("After")), null);
});

test("preview handles standard math delimiters, Greek text offsets and comments", () => {
  const source = "Ελληνικά $E=mc^2$ text\n% $ignored$\n\\begin{align}x&=1\\end{align}";
  assert.equal(mathAtCursor(source, source.indexOf("mc"))?.tex, "E=mc^2");
  assert.equal(mathAtCursor(source, source.indexOf("ignored")), null);
  assert.match(mathAtCursor(source, source.indexOf("x&"))?.tex ?? "", /^\\begin\{align\}/);
});

test("preview accepts a partially typed display expression and ignores unrelated text", () => {
  const source = "Text \\[x+1";
  assert.equal(mathAtCursor(source, source.length)?.tex, "x+1");
  assert.equal(mathAtCursor("Text only", 5), null);
});

test("a comment inside math ends the expression as in TeX and is not shown", () => {
  const source = "Teh $a % b$ end";
  assert.equal(mathAtCursor(source, source.length)?.tex.trimEnd(), "a");
  assert.equal(mathAtCursor("$a \\% b$", 2)?.tex, "a \\% b");
});

test("inner math environments preview with the math around them", () => {
  assert.equal(mathAtCursor("\\begin{gathered} teh \\end{gathered}", 18), null);
  const source = "\\begin{equation}\\begin{gathered} x \\end{gathered}\\end{equation}";
  assert.match(mathAtCursor(source, source.indexOf("x"))?.tex ?? "", /^\\begin\{equation\}\\begin\{gathered\}/);
});
