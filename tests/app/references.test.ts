// Licensed under the GNU General Public License v2 or later. See LICENSE.
import test from "node:test";
import assert from "node:assert/strict";
import { bibliographyEntries, documentLabels, fileArgument, fileChoices, nameArgument } from "../../source/app/references";

test("bib entries give their key and a short description", () => {
  const entries = bibliographyEntries(`% comment\n@article{smith2020,\n  author = {Smith, Jane and Lee, Bo},\n  title = {A {Study} of Things},\n  year = 2020\n}\n@string{x = "y"}\n@book{lee1999, author = "Bo Lee", title = "Books", date = {1999-05-01}}`);
  assert.deepEqual(entries, [{ key: "smith2020", detail: "Smith et al. 2020, A Study of Things" }, { key: "lee1999", detail: "Lee 1999, Books" }]);
});

test("labels come from label keys, \\label and the default names of files", () => {
  const labels = documentLabels(`\\mysection[label=intro]{Introduction}\n\\mysubsection[label=aim]{Aim}\n\\myfigure[caption=Setup]{setup/photo.png}\n\\mytable{tables/runs/yields.tex}\n% \\mysection[label=hidden]{x}\n\\label{eq:a}`);
  assert.deepEqual(labels.map(label => label.name), ["intro", "aim", "fig:photo", "tab:yields", "eq:a"]);
  assert.equal(labels[0].detail, "Section: Introduction");
  assert.equal(labels[1].detail, "Subsection: Aim");
});

test("the name being chosen is found inside cite and reference arguments", () => {
  assert.deepEqual(nameArgument("see \\cite{smi"), { kind: "citation", typed: "smi", start: 10 });
  assert.deepEqual(nameArgument("\\parencite[p. 3]{a, b"), { kind: "citation", typed: "b", start: 20 });
  assert.deepEqual(nameArgument("\\myref{"), { kind: "label", typed: "", start: 7 });
  assert.deepEqual(nameArgument("\\myref[nom]{fig:x, ta"), { kind: "label", typed: "ta", start: 19 });
  assert.equal(nameArgument("\\cite{a} and text"), null);
});

test("side-by-side figures and plots list each part as an indexed label", () => {
  const labels = documentLabels(`\\myfigure[caption=Setups., subcaption={Before, {After, cleaned}}]{setup/before.png, after.png}\n\\myplot[label=plot:pair]{raw, fit}\n\\mytable{a, b}`);
  assert.deepEqual(labels.map(label => [label.name, label.detail]), [
    ["fig:before", "Figure: Setups."], ["fig:before[1]", "Figure part (a): Before"], ["fig:before[2]", "Figure part (b): After, cleaned"],
    ["plot:pair", "Plot raw, fit"], ["plot:pair[1]", "Plot part (a): raw"], ["plot:pair[2]", "Plot part (b): fit"], ["tab:a, b", "Table a, b"],
  ]);
});

test("figure, plot and table commands offer the files of their folder", () => {
  assert.deepEqual(fileArgument("\\myfigure{"), { kind: "figure", typed: "", start: 10 });
  assert.deepEqual(fileArgument("\\myplot[caption={A}, width=0.5]{pl"), { kind: "plot", typed: "pl", start: 32 });
  assert.deepEqual(fileArgument("\\myfigure{a.png, b"), { kind: "figure", typed: "b", start: 17 });
  assert.equal(fileArgument("\\myfigure{a.png} text"), null);
  const files = ["main.tex", "graphics/b.png", "graphics/grid/a.jpg", "graphics/notes.txt", "plots/fit.tex", "tables/.hidden.tex", "tables/yields.tex", "tables/runs/one.tex"];
  assert.deepEqual(fileChoices("figure", files), ["b.png", "grid/a.jpg"]);
  assert.deepEqual(fileChoices("figure", files, ["b.png"]), ["grid/a.jpg"]);
  assert.deepEqual(fileChoices("plot", files), ["fit.tex"]);
  assert.deepEqual(fileChoices("table", files), ["runs/one.tex", "yields.tex"]);
});
