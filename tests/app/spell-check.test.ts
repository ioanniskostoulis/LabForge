// Licensed under the GNU General Public License v2 or later. See LICENSE.
import test from "node:test";
import assert from "node:assert/strict";
import { proseWords } from "../../source/app/spell-check";

test("spell checking keeps English and Greek prose but excludes LaTeX syntax", () => {
  const source = String.raw`\documentclass{.labforge}
\begin{document}
The dawdawd table and η λανθασμενη λέξη. \myref{tab:yields, formation}
\mysection[label=methods]{Useful title} \cite{birkeland} \cite[see][p. 2]{otherkey} \citep{thirdkey} \input{tables/results.tex}
\myformula[label=steps]{a &= 1 \\ b &= 2} $x + y$ \(z\) \[w\]
\begin{align} p &= q \end{align}
\verb|notprose| \begin{verbatim}notprose\end{verbatim}
% misspeled comment
See graphics/photo.png and \url{https://example.com/file}.
\end{document}`;
  const words = proseWords(source).map(item => item.word);
  for (const word of ["The", "dawdawd", "table", "λανθασμενη", "λέξη", "Useful", "title", "See", "and"])
    assert.ok(words.includes(word), word);
  for (const word of ["documentclass", "labforge", "myref", "yields", "formation", "methods", "birkeland", "otherkey", "thirdkey", "see", "p", "results", "tex", "steps", "notprose", "misspeled", "graphics", "photo", "example", "com", "file"])
    assert.ok(!words.includes(word), word);
  const misspelling = proseWords(source).find(item => item.word === "dawdawd")!;
  assert.equal(source.slice(misspelling.from, misspelling.to), "dawdawd");
});

test("an unfinished math delimiter or environment hides only the rest of its line", () => {
  const words = (body: string) => proseWords(`\\begin{document}\n${body}\n\\end{document}`).map(item => item.word);
  assert.deepEqual(words("Teh frist $$ wrod\nrecip ov the ded"), ["Teh", "frist", "recip", "ov", "the", "ded"]);
  assert.deepEqual(words("Teh value $x is unclosed\nnext lien"), ["Teh", "value", "next", "lien"]);
  assert.deepEqual(words("Before \\[ x + y\nafter teh"), ["Before", "after", "teh"]);
  assert.deepEqual(words("\\begin{equation} x\nteh rest"), ["teh", "rest"]);
  assert.deepEqual(words("A $x\n\ny$ split"), ["A", "y"]);
});

test("closed math may span lines inside a paragraph, and verbatim may span paragraphs", () => {
  const words = (body: string) => proseWords(`\\begin{document}\n${body}\n\\end{document}`).map(item => item.word);
  assert.deepEqual(words("One $$ a\nb $$ two \\[ c\nd \\] three"), ["One", "two", "three"]);
  assert.deepEqual(words("Cost \\$5 and $a \\$ b$ more"), ["Cost", "and", "more"]);
  assert.deepEqual(words("\\begin{align} a\nb \\end{align} after"), ["after"]);
  assert.deepEqual(words("\\begin{verbatim}code\n\nmore code\\end{verbatim} prose"), ["prose"]);
});

test("the owner's decisions on reading LaTeX for spelling", () => {
  const words = (text: string) => proseWords(text).map(item => item.word);
  assert.deepEqual(words("\\labforgesetup{margn=1in}"), []);
  assert.deepEqual(words("Teh $a % b$ end"), ["Teh"]);
  assert.deepEqual(words("Teh $a \\% b$ end"), ["Teh", "end"]);
  assert.deepEqual(words("One \\[a % b\\]\nc \\] two"), ["One", "two"]);
  assert.deepEqual(words("A \\begin{gathered} teh \\end{gathered} B \\begin{cases} teh \\end{cases} C"), ["A", "B", "C"]);
  assert.deepEqual(words("\\verb|a\nteh| tail"), ["teh", "tail"]);
  for (const name of ["Verbatim", "comment", "filecontents", "filecontents*"]) assert.deepEqual(words(`A \\begin{${name}} teh \\end{${name}} B`), ["A", "B"], name);
});
