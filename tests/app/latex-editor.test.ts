// Licensed under the GNU General Public License v2 or later. See LICENSE.
import test from "node:test";
import assert from "node:assert/strict";
import { EditorState } from "@codemirror/state";
import { ensureSyntaxTree, indentUnit } from "@codemirror/language";
import { CompletionContext } from "@codemirror/autocomplete";
import { latexLanguage, locateBuildProblem, texCompletions } from "../../source/app/latex-editor";

test("build command context maps only to the exact token on the reported main.tex line", () => {
  const source = "First line\n\\missingcommand and text\n";
  const issue = { severity: "error" as const, message: "Undefined control sequence.", file: "main.tex", line: 2, token: "\\missingcommand" };
  assert.deepEqual(locateBuildProblem(source, issue), { from: 11, to: 26, message: issue.message });
  assert.equal(locateBuildProblem(source, { ...issue, token: "\\other" }), null);
  assert.equal(locateBuildProblem(source, { ...issue, file: "settings.tex" }), null);
});

test("LaTeX tokens keep the earlier highlighter's kinds", () => {
  const state = EditorState.create({ doc: "\\begin{table} % note\n\\usepackage{x} $a$ \\% \\mysection*{A}", extensions: [latexLanguage] });
  const tree = ensureSyntaxTree(state, state.doc.length, 5000)!;
  const kinds: string[] = [];
  tree.iterate({ enter: node => { if (node.type.name && node.type.name !== "Document" && !node.type.isTop) kinds.push(`${node.type.name}:${state.sliceDoc(node.from, node.to)}`); } });
  assert.deepEqual(kinds, [
    "command:\\begin", "brace:{", "environment:table", "brace:}", "comment:% note",
    "keyword:\\usepackage", "brace:{", "brace:}", "math:$", "math:$", "command:\\mysection*", "brace:{", "brace:}",
  ]);
});

test("preamble commands, line breaks and cell separators are keywords", () => {
  const doc = "\\newcommand{\\a}{b}\\labforgesetup{} a & b \\\\ \\& \\mytable{x}";
  const state = EditorState.create({ doc, extensions: [latexLanguage] });
  const kinds: string[] = [];
  ensureSyntaxTree(state, state.doc.length, 5000)!.iterate({ enter: node => { if (node.type.name && node.type.name !== "Document" && !node.type.isTop && node.type.name !== "brace") kinds.push(`${node.type.name}:${state.sliceDoc(node.from, node.to)}`); } });
  assert.deepEqual(kinds, ["keyword:\\newcommand", "command:\\a", "keyword:\\labforgesetup", "keyword:&", "keyword:\\\\", "command:\\mytable"]);
});

test("completion starts after one letter, keeps every prefix match and places the cursor in the first argument", () => {
  const doc = "\\s";
  const state = EditorState.create({ doc, selection: { anchor: doc.length } });
  const result = texCompletions(new CompletionContext(state, doc.length, false));
  assert.ok(result);
  assert.equal(result.from, 0);
  assert.deepEqual(result.options.slice(0, 8).map(option => option.label), ["\\section{}", "\\subsection{}", "\\subsubsection{}", "\\smallskip", "\\small", "\\setlist{}", "\\sqrt{}", "\\sum"]);
  assert.ok(result.options.length > 8);
  assert.ok(result.options.some(option => option.label === "\\sisetup{}"));
  let applied: { changes: { from: number; to: number; insert: string }; selection: { anchor: number } } | undefined;
  const view = { dispatch: (spec: typeof applied) => { applied = spec; } };
  (result.options[1].apply as (view: unknown, completion: unknown, from: number, to: number) => void)(view, result.options[1], 0, 2);
  assert.deepEqual(applied?.changes, { from: 0, to: 2, insert: "\\subsection{}" });
  assert.equal(applied?.selection.anchor, "\\subsection{".length);
  const bare = EditorState.create({ doc: "\\", selection: { anchor: 1 } });
  assert.equal(texCompletions(new CompletionContext(bare, 1, false)), null);
  const many = EditorState.create({ doc: "\\e", selection: { anchor: 2 } });
  assert.ok(texCompletions(new CompletionContext(many, 2, false))!.options.length > 0);
});

test("environment names complete inside begin and end braces", () => {
  const complete = (text: string) => {
    const pos = text.indexOf("|");
    const doc = text.replace("|", "");
    const state = EditorState.create({ doc });
    return texCompletions(new CompletionContext(state, pos, false));
  };
  const empty = complete("\\begin{|}");
  assert.ok(empty?.options.some(option => option.label === "itemize"));
  assert.ok(empty?.options.some(option => option.label === "alignedat"));
  const partial = complete("\\begin{ali|}");
  assert.deepEqual(partial?.options.map(option => option.label), ["align", "align*", "aligned", "alignedat"]);
  assert.equal(partial?.from, "\\begin{".length);
  const nested = complete("\\begin{itemize}\n\\begin{enumerate}\n\\end{|}");
  assert.equal(nested?.options[0].label, "enumerate");
  assert.equal(nested?.options[1].label, "itemize");
  assert.ok(complete("\\newenvironment{special}{}{}\n\\begin{spe|}")?.options.some(option => option.label === "special"));
  assert.equal(complete("% \\begin{|}"), null);
});

test("editor text round-trips Unicode, tabs and trailing newlines unchanged", () => {
  const text = "\\setdoclanguage{greek}\nΚαλημέρα κόσμε — ∑ αβγ\n\tindented\n\n% end\n";
  assert.equal(EditorState.create({ doc: text }).doc.toString(), text);
});

test("folding covers sections up to the next equal heading, and environments", async () => {
  const { latexFoldRange } = await import("../../source/app/latex-editor");
  const doc = [
    "% header", "\\documentclass{article}", "\\input{x}", "% ============", "% Main writing section", "% ============",
    "\\begin{document}", "\\mysection{One}", "text", "\\subsection{A}", "more", "", "\\section{Two}", "\\begin{table}", "row", "\\end{table}", "\\end{document}",
  ].join("\n");
  const state = EditorState.create({ doc });
  const line = (n: number) => state.doc.line(n);
  assert.equal(latexFoldRange(state, line(1).from), null);
  assert.deepEqual(latexFoldRange(state, line(8).from), { from: line(8).to, to: line(11).to });
  assert.deepEqual(latexFoldRange(state, line(10).from), { from: line(10).to, to: line(11).to });
  assert.deepEqual(latexFoldRange(state, line(14).from), { from: line(14).to, to: line(15).to });
  assert.equal(latexFoldRange(state, line(7).from), null);
});

test("Enter after \\begin{name} adds the matching \\end once", async () => {
  const { closeEnvironment } = await import("../../source/app/latex-editor");
  const run = (doc: string) => {
    let state = EditorState.create({ doc, selection: { anchor: doc.indexOf("|") }, extensions: [indentUnit.of("    ")] }).update({ changes: { from: doc.indexOf("|"), to: doc.indexOf("|") + 1 } }).state;
    const handled = closeEnvironment({ state, dispatch: (spec: Parameters<typeof state.update>[0]) => { state = state.update(spec).state; } } as never);
    return { handled, text: state.doc.toString(), cursor: state.selection.main.head };
  };
  const opened = run("  \\begin{itemize}|");
  assert.equal(opened.handled, true);
  assert.equal(opened.text, "  \\begin{itemize}\n      \n  \\end{itemize}");
  assert.equal(opened.cursor, "  \\begin{itemize}\n      ".length);
  assert.equal(run("\\begin{figure}[h]|").text, "\\begin{figure}[h]\n    \n\\end{figure}");
  assert.equal(run("\\begin{table}|\n\\end{table}").handled, false);
  assert.equal(run("\\begin{document}|").handled, false);
  assert.equal(run("\\begin{x} y|").handled, false);
});

test("Enter between brackets opens an indented line and keeps the closer below", async () => {
  const { explodeBrackets } = await import("../../source/app/latex-editor");
  const run = (doc: string) => {
    let state = EditorState.create({ doc, selection: { anchor: doc.indexOf("|") }, extensions: [indentUnit.of("    ")] }).update({ changes: { from: doc.indexOf("|"), to: doc.indexOf("|") + 1 } }).state;
    const handled = explodeBrackets({ state, dispatch: (spec: Parameters<typeof state.update>[0]) => { state = state.update(spec).state; } } as never);
    return { handled, text: state.doc.toString(), cursor: state.selection.main.head };
  };
  const split = run("\\myreport[|]");
  assert.equal(split.handled, true);
  assert.equal(split.text, "\\myreport[\n    \n]");
  assert.equal(split.cursor, "\\myreport[\n    ".length);
  assert.equal(run("  \\a{|}").text, "  \\a{\n      \n  }");
  assert.equal(run("\\myreport[|x]").handled, false);
  assert.equal(run("a|").handled, false);
});

test("bracket depths skip escaped brackets and comments", async () => {
  const { bracketDepths } = await import("../../source/app/latex-editor");
  const text = "\\a{b[c]{d}} \\{ % {\n{}";
  assert.deepEqual(bracketDepths(text, 0, text.length), [[2, 0], [4, 1], [6, 1], [7, 1], [9, 1], [10, 0], [19, 0], [20, 0]]);
});

test("parentheses are coloured with the braces, and a stray closer is ignored", async () => {
  const { bracketDepths } = await import("../../source/app/latex-editor");
  const text = "f(x{y}) 1) a";
  assert.deepEqual(bracketDepths(text, 0, text.length), [[1, 0], [3, 1], [5, 1], [6, 0]]);
});

test("folding reads a % after \\\\ as a comment", async () => {
  const { latexFoldRange } = await import("../../source/app/latex-editor");
  const state = EditorState.create({ doc: "\\begin{itemize}\na\nb \\\\%\\end{itemize}\nc\n\\end{itemize}" });
  assert.deepEqual(latexFoldRange(state, 0), { from: state.doc.line(1).to, to: state.doc.line(4).to });
  const escapedState = EditorState.create({ doc: "\\begin{itemize}\na \\%\\end{itemize}\nb\n\\end{itemize}" });
  assert.deepEqual(latexFoldRange(escapedState, 0), null);
});
