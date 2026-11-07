// Licensed under the GNU General Public License v2 or later. See LICENSE.
import test from "node:test";
import assert from "node:assert/strict";
import { EditorSelection, EditorState, type StateCommand } from "@codemirror/state";
import { indentLess } from "@codemirror/commands";
import { indentUnit } from "@codemirror/language";
import { joinLines, matchEnvironment, sortLines, tabIndent, trimTrailingWhitespace } from "../../source/app/editor-commands";

function run(command: StateCommand, doc: string, anchor: number, head = anchor) {
  let state = EditorState.create({ doc, selection: EditorSelection.single(anchor, head), extensions: [EditorState.allowMultipleSelections.of(true), EditorState.tabSize.of(4), indentUnit.of("    ")] });
  const done = command({ state, dispatch: transaction => { state = transaction.state; } });
  return { done, doc: state.doc.toString(), head: state.selection.main.head };
}

test("Tab indents every line of a multi-line selection and inserts at a cursor", () => {
  assert.equal(run(tabIndent, "a\nb\nc", 0, 5).doc.split("\n").every(line => line.startsWith("  ")), true);
  assert.equal(run(tabIndent, "", 0).doc, "    ");
});

test("Tab at a cursor adds only the spaces that reach the next tab stop", () => {
  assert.equal(run(tabIndent, "ab", 1).doc, "a   b");
  assert.equal(run(tabIndent, "abcd", 4).doc, "abcd    ");
  assert.equal(run(tabIndent, "abc", 3).doc, "abc ");
  assert.equal(run(tabIndent, "a\n  b", 4).doc, "a\n    b");
  assert.equal(run(tabIndent, "ab", 0, 2).head, 4);
});

test("Shift-Tab removes one indent unit from every selected line", () => {
  const result = run(indentLess, "    a\n    b\n  c", 0, 14);
  assert.equal(result.doc, "a\nb\nc");
});

test("join lines glues the next line on with one space", () => {
  assert.equal(run(joinLines, "one  \n   two\nthree", 0).doc, "one two\nthree");
  assert.equal(run(joinLines, "a\nb\nc", 0, 5).doc, "a b c");
  assert.equal(run(joinLines, "last", 2).done, false);
});

test("sort lines orders the selected lines naturally, or all lines", () => {
  assert.equal(run(sortLines, "b\na10\na2\nc", 0, 10).doc, "a2\na10\nb\nc");
  assert.equal(run(sortLines, "b\na", 0).doc, "a\nb");
  assert.equal(run(sortLines, "a\nb", 0).done, false);
});

test("trim removes trailing spaces and tabs only", () => {
  assert.equal(run(trimTrailingWhitespace, "a  \n  b\t\n", 0).doc, "a\n  b\n");
  assert.equal(run(trimTrailingWhitespace, "a\nb", 0).done, false);
});

test("match environment jumps between begin and end, counting nested ones", () => {
  const doc = "\\begin{itemize}\n\\begin{itemize}\nx\n\\end{itemize}\n\\end{itemize}\n";
  const outerEnd = doc.lastIndexOf("\\end{itemize}");
  assert.equal(run(matchEnvironment, doc, 3).head, outerEnd + "\\end{itemize}".length);
  assert.equal(run(matchEnvironment, doc, outerEnd + 2).head, 0);
  assert.equal(run(matchEnvironment, "plain text", 2).done, false);
});
