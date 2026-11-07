// Licensed under the GNU General Public License v2 or later. See LICENSE.
// Editing commands beyond CodeMirror's defaults, shaped after VS Code: Tab over lines, join and sort lines, trailing whitespace, matching \begin and \end.
import { EditorSelection, countColumn, type ChangeSpec, type StateCommand } from "@codemirror/state";
import { indentMore } from "@codemirror/commands";

/** The first and last line numbers each selection range touches; a range ending at a line start leaves that line out. */
function touchedLines(state: Parameters<StateCommand>[0]["state"]): { first: number; last: number }[] {
  return state.selection.ranges.map(range => {
    const first = state.doc.lineAt(range.from).number;
    let last = state.doc.lineAt(range.to).number;
    if (range.to > range.from && range.to === state.doc.line(last).from && last > first) last--;
    return { first, last };
  });
}

/** Tab: indent every line of a multi-line selection; otherwise add the spaces that reach the next tab stop at each cursor (replacing a one-line selection). */
export const tabIndent: StateCommand = ({ state, dispatch }) => {
  if (state.readOnly) return false;
  if (touchedLines(state).some(({ first, last }) => last > first)) return indentMore({ state, dispatch });
  const size = state.tabSize;
  dispatch(state.update(state.changeByRange(range => {
    const line = state.doc.lineAt(range.from);
    const column = countColumn(state.sliceDoc(line.from, range.from), size);
    const insert = " ".repeat(size - column % size);
    return { changes: { from: range.from, to: range.to, insert }, range: EditorSelection.cursor(range.from + insert.length) };
  }), { scrollIntoView: true, userEvent: "input" }));
  return true;
};

/** Join each cursor's line with the next, or the lines of a selection, replacing the break and the next line's indent with one space. */
export const joinLines: StateCommand = ({ state, dispatch }) => {
  if (state.readOnly) return false;
  const changes: ChangeSpec[] = [];
  const done = new Set<number>();
  for (const { first, last } of touchedLines(state)) {
    const end = Math.min(Math.max(last, first + 1), state.doc.lines);
    for (let number = first; number < end; number++) {
      if (done.has(number)) continue;
      done.add(number);
      const line = state.doc.line(number), next = state.doc.line(number + 1);
      const gap = /^\s*/.exec(next.text)![0].length;
      const trailing = line.text.length - line.text.trimEnd().length;
      const glue = next.text.trim() && line.text.trim() ? " " : "";
      changes.push({ from: line.to - trailing, to: next.from + gap, insert: glue });
    }
  }
  if (!changes.length) return false;
  dispatch(state.update({ changes, scrollIntoView: true, userEvent: "delete.join" }));
  return true;
};

/** Sort the selected lines (all lines when nothing spans several) in a natural, case-insensitive order. */
export const sortLines: StateCommand = ({ state, dispatch }) => {
  if (state.readOnly) return false;
  const spans = touchedLines(state).filter(({ first, last }) => last > first);
  const ranges = spans.length ? spans : [{ first: 1, last: state.doc.lines }];
  const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });
  const changes: ChangeSpec[] = [];
  for (const { first, last } of ranges) {
    const from = state.doc.line(first).from, to = state.doc.line(last).to;
    const lines = state.doc.sliceString(from, to).split("\n");
    const sorted = [...lines].sort((a, b) => collator.compare(a, b));
    if (sorted.some((line, index) => line !== lines[index])) changes.push({ from, to, insert: sorted.join("\n") });
  }
  if (!changes.length) return false;
  dispatch(state.update({ changes, userEvent: "input.sort" }));
  return true;
};

/** The edits that remove trailing spaces and tabs from every line. */
export function trailingWhitespaceChanges(doc: Parameters<StateCommand>[0]["state"]["doc"]): ChangeSpec[] {
  const changes: ChangeSpec[] = [];
  for (let number = 1; number <= doc.lines; number++) {
    const line = doc.line(number);
    const trimmed = line.text.length - line.text.trimEnd().length;
    if (trimmed) changes.push({ from: line.to - trimmed, to: line.to });
  }
  return changes;
}

export const trimTrailingWhitespace: StateCommand = ({ state, dispatch }) => {
  const changes = state.readOnly ? [] : trailingWhitespaceChanges(state.doc);
  if (!changes.length) return false;
  dispatch(state.update({ changes, userEvent: "delete.trim" }));
  return true;
};

const environment = /\\(begin|end)\{([^{}]*)\}/g;

/** Move the cursor from a `\begin{…}` to its `\end{…}` and back, counting nested environments of the same name. Does nothing when the line has neither. */
export const matchEnvironment: StateCommand = ({ state, dispatch }) => {
  const head = state.selection.main.head;
  const line = state.doc.lineAt(head);
  let found: { kind: string; name: string; from: number; to: number } | undefined;
  for (const match of line.text.matchAll(environment)) {
    const from = line.from + match.index!, to = from + match[0].length;
    if (!found || (head >= from && head <= to)) found = { kind: match[1], name: match[2], from, to };
    if (head <= to) break;
  }
  if (!found) return false;
  const text = state.doc.toString();
  const forward = found.kind === "begin";
  const marks = [...text.matchAll(environment)].filter(match => match[2] === found!.name).map(match => ({ kind: match[1], from: match.index!, to: match.index! + match[0].length }));
  const start = marks.findIndex(mark => mark.from === found!.from);
  let depth = 0;
  for (let index = start; index >= 0 && index < marks.length; index += forward ? 1 : -1) {
    depth += (marks[index].kind === "begin") === forward ? 1 : -1;
    if (!depth) {
      const mark = marks[index];
      dispatch(state.update({ selection: EditorSelection.cursor(forward ? mark.to : mark.from), scrollIntoView: true, userEvent: "select" }));
      return true;
    }
  }
  return false;
};
