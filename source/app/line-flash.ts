// Licensed under the GNU General Public License v2 or later. See LICENSE.
// Briefly marks one line of a CodeMirror view, so a jump from the PDF shows where it landed.
import { StateEffect, StateField, type Range } from "@codemirror/state";
import { Decoration, EditorView, type DecorationSet } from "@codemirror/view";

const setFlash = StateEffect.define<number | null>();
const flashLineDecoration = Decoration.line({ class: "cm-flash-line" });
const flashField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(value, transaction) {
    let next = value.map(transaction.changes);
    for (const effect of transaction.effects) {
      if (!effect.is(setFlash)) continue;
      const ranges: Range<Decoration>[] = effect.value === null ? [] : [flashLineDecoration.range(effect.value)];
      next = Decoration.set(ranges);
    }
    return next;
  },
  provide: field => EditorView.decorations.from(field),
});
const installed = new WeakSet<EditorView>();
const timers = new WeakMap<EditorView, ReturnType<typeof setTimeout>>();

/** Put the cursor on `line` (1-based), at `anchor` when given or else at its start, scroll it to the middle and mark it for a moment. */
export function flashLine(view: EditorView, line: number, anchor?: number): void {
  if (!installed.has(view)) { view.dispatch({ effects: StateEffect.appendConfig.of(flashField) }); installed.add(view); }
  const target = view.state.doc.line(Math.max(1, Math.min(line, view.state.doc.lines)));
  view.dispatch({ selection: { anchor: anchor !== undefined && anchor >= target.from && anchor <= target.to ? anchor : target.from }, effects: [setFlash.of(target.from), EditorView.scrollIntoView(target.from, { y: "center" })] });
  view.focus();
  clearTimeout(timers.get(view));
  timers.set(view, setTimeout(() => view.dispatch({ effects: setFlash.of(null) }), 1400));
}
