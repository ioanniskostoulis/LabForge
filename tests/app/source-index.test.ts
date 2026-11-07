// Licensed under the GNU General Public License v2 or later. See LICENSE.
// The navigation index: numbering as the class prints it, labels and their parts, ⌘-click targets, renaming,
// the reference check and option edits, all at exact positions in main.tex.
import test from "node:test";
import assert from "node:assert/strict";
import { EditorState } from "@codemirror/state";
import { entryAt, indexSource, labelAt, referenceProblems, renameLabel, setOption, targetAt } from "../../source/app/source-index";
import { codeSummaries } from "../../source/app/code-summaries";
import { currentEntry } from "../../source/app/outline";

const report = String.raw`\documentclass[language=english]{.labforge}
\begin{document}
\mysection{Introduction}
See \myref{fig:photo}, \myref*{ph:pair[2]}, \myref{eq:steps[2]} and \cite{smith2020, lee1999}.
% \mysection[label=hidden]{Commented}
\mysubsection[label=sec:aim]{The \textbf{aim}}
\myfigure[caption={Setup, as built.}]{setup/photo.png}
\myfigure[label=ph:pair, caption={Two views.}, subcaption={{Left}, {Right}}]{a.png, b.png}
\mysection*{Unnumbered}
\myformula[label=eq:steps]{
    a &= b \\
    c &= d \\
    e &= f \nonumber
}
\myreaction[label=r:one]{H2 + O2 -> H2O}
\mytable[label=tab:values, caption=Values]{values.tex}
\input{chapters/part}
Missing \myref{nowhere}.
\label{lonely}
\label{lonely}
\end{document}
`;

test("headings and blocks are numbered as the class prints them", () => {
  const index = indexSource(report);
  assert.deepEqual(index.entries.map(entry => [entry.kind, entry.number]),
    [["section", "1"], ["section", "1.1"], ["figure", "1"], ["figure", "2"], ["section", ""], ["formula", "(1)–(2)"], ["reaction", "R1"], ["table", "1"]]);
  assert.equal(index.entries[1].title, "The aim");
  assert.equal(index.entries[2].title, "Setup, as built.");
  assert.equal(index.labels.get("fig:photo")?.text, "Figure 1", "a figure without a label gets one from its file name");
  assert.equal(index.labels.get("ph:pair[2]")?.text, "Figure 2b");
  assert.equal(index.labels.get("eq:steps[2]")?.text, "Equation (2)");
  assert.equal(index.labels.get("sec:aim")?.text, "Section 1.1");
  assert.ok(!index.labels.has("hidden"), "comments are not read");
});

test("⌘-click finds labels, files, citations and inputs", () => {
  const index = indexSource(report);
  const at = (text: string, shift = 1) => report.indexOf(text) + shift;
  const label = targetAt(index, at("fig:photo}"));
  assert.equal(targetAt(index, report.indexOf("\\myref{fig:photo}"))?.kind, "label", "the start of a summarised reference follows it too");
  assert.equal(label?.kind, "label");
  assert.equal(label?.kind === "label" && label.at && report.slice(label.at.from, label.at.from + 9), "\\myfigure", "a default label goes to its block");
  const part = targetAt(index, at("eq:steps[2]"));
  assert.equal(part?.kind === "label" && part.at && report.slice(part.at.from, part.at.to), "eq:steps");
  assert.deepEqual(targetAt(index, at("photo.png")), { kind: "file", path: "graphics/setup/photo.png" });
  assert.deepEqual(targetAt(index, at("values.tex")), { kind: "file", path: "tables/values.tex" });
  assert.deepEqual(targetAt(index, at("lee1999")), { kind: "citation", key: "lee1999" });
  assert.deepEqual(targetAt(index, at("chapters/part")), { kind: "file", path: "chapters/part.tex" });
  assert.equal(targetAt(index, at("Introduction")), null);
});

test("renaming a label changes its definition and every reference, parts included", () => {
  const index = indexSource(report);
  assert.equal(labelAt(index, report.indexOf("ph:pair,") + 2), "ph:pair");
  assert.equal(labelAt(index, report.indexOf("ph:pair[2]") + 2), "ph:pair");
  const apply = (text: string, edits: { from: number; to: number; insert: string }[]) => [...edits].reverse().reduce((out, edit) => out.slice(0, edit.from) + edit.insert + out.slice(edit.to), text);
  const renamed = apply(report, renameLabel(index, "ph:pair", "ph:views"));
  assert.match(renamed, /label=ph:views, caption/);
  assert.match(renamed, /\\myref\*\{ph:views\[2\]\}/);
  // A default label is written into the block when it is renamed.
  const fromDefault = apply(report, renameLabel(index, "fig:photo", "fig:rig"));
  assert.match(fromDefault, /\\myfigure\[label=fig:rig, caption=\{Setup, as built\.\}\]/);
  assert.match(fromDefault, /See \\myref\{fig:rig\}/);
});

test("the reference check finds undefined, duplicate and unused labels", () => {
  const problems = referenceProblems(indexSource(report)).map(problem => `${problem.kind} ${problem.name}`);
  assert.ok(problems.includes("undefined nowhere"));
  assert.ok(problems.includes("duplicate lonely"));
  assert.ok(problems.includes("unused sec:aim"));
  assert.ok(problems.includes("unused r:one"));
  assert.ok(!problems.some(problem => /fig:photo|ph:pair|eq:steps/.test(problem)), "used labels and default labels are not reported");
});

test("block options are set, changed and removed in place", () => {
  const index = indexSource(report);
  const figure = index.entries[2], table = index.entries[7], section = index.entries[0];
  const apply = (edit: { from: number; to: number; insert: string }) => report.slice(0, edit.from) + edit.insert + report.slice(edit.to);
  assert.match(apply(setOption(report, figure, "width", "0.5")), /\\myfigure\[caption=\{Setup, as built\.\}, width=0\.5\]/);
  assert.match(apply(setOption(report, figure, "caption", "New, longer")), /\\myfigure\[caption=\{New, longer\}\]/);
  assert.match(apply(setOption(report, figure, "caption", "")), /\\myfigure\{setup\/photo\.png\}/);
  assert.match(apply(setOption(report, table, "label", "")), /\\mytable\[caption=Values\]\{values\.tex\}/);
  assert.match(apply(setOption(report, section, "label", "sec:intro")), /\\mysection\[label=sec:intro\]\{Introduction\}/);
  assert.equal(entryAt(index, report.indexOf("Two views"))?.label, "ph:pair");
  assert.equal(currentEntry(index, report.indexOf("Missing"))?.kind, "table");
});

test("summaries replace long options and references only away from the cursor", () => {
  const text = String.raw`\documentclass[language=english]{.labforge}
\begin{document}
\myfigure[label=fig:a, caption={A rather long caption for this figure.}]{a.png}
See \myref{fig:a}.
\end{document}`;
  const count = (state: EditorState) => { let found = 0; state.field(codeSummaries).decorations.between(0, state.doc.length, () => { found++; }); return found; };
  const away = EditorState.create({ doc: text, extensions: codeSummaries, selection: { anchor: 0 } });
  assert.equal(count(away), 2, "the options and the reference are summarised");
  const inside = EditorState.create({ doc: text, extensions: codeSummaries, selection: { anchor: text.indexOf("rather") } });
  assert.equal(count(inside), 1, "the command under the cursor is shown as written");
});
