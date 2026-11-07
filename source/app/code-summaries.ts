// Licensed under the GNU General Public License v2 or later. See LICENSE.
// Quieter code (View › Editor › Command summaries): while the cursor is elsewhere, a long options group of a heading,
// figure, plot, table, formula or cover shows as a one-line summary, and a reference shows what it prints ("Figure 3").
// The text never changes; moving the cursor into a command shows it as written.
import { StateField, type EditorState, type Range } from "@codemirror/state";
import { Decoration, EditorView, WidgetType, type DecorationSet } from "@codemirror/view";
import { setTip } from "forge-shell/app/tips";
import { groupEnd, indexSource, plainText, readOptionItems, type SourceIndex, type Span } from "./source-index";

class Summary extends WidgetType {
  constructor(readonly text: string, readonly kind: "options" | "ref", readonly tip: string) { super(); }
  eq(other: Summary): boolean { return other.text === this.text && other.kind === this.kind && other.tip === this.tip; }
  toDOM(): HTMLElement {
    const span = document.createElement("span");
    span.className = `cm-summary cm-summary-${this.kind}`;
    span.textContent = this.text;
    span.setAttribute("aria-label", this.tip);
    setTip(span, this.tip);
    return span;
  }
  ignoreEvent(): boolean { return false; }
}

/** Options longer than this, or written over several lines, are summarised. */
const longOptions = 40;
const clip = (text: string, length = 56) => text.length > length ? `${text.slice(0, length - 1).trimEnd()}…` : text;

/** The cover commands are not numbered blocks, so they are found here. */
function coverOptions(text: string): Span[] {
  const spans: Span[] = [];
  for (const match of text.matchAll(/\\(?:myreport|mythesis)\s*\[/g)) {
    const open = match.index + match[0].length - 1, end = groupEnd(text, open);
    if (end > 0) spans.push({ from: open + 1, to: end - 1 });
  }
  return spans;
}

function summaryText(source: string, inside: Span, cover: boolean): string {
  const items = readOptionItems(source, inside);
  if (cover) return clip(`${plainText(items.find(item => item.key === "title")?.value ?? "")}`) || items.map(item => item.key).join(", ");
  const caption = items.find(item => item.key === "caption");
  const rest = items.filter(item => item.key !== "caption" && item.key !== "subcaption").map(item => item.key === "label" ? item.value : `${item.key} ${item.value}`);
  return clip([caption ? plainText(caption.value) : "", ...rest].filter(Boolean).join(", "));
}

function build(state: EditorState, index: SourceIndex): DecorationSet {
  const source = state.doc.toString();
  const heads = state.selection.ranges.map(range => range.head);
  const touched = (from: number, to: number) => heads.some(head => head >= from && head <= to);
  const ranges: Range<Decoration>[] = [];
  const hidden: Span[] = [];
  const add = (from: number, to: number, widget: Summary) => { ranges.push(Decoration.replace({ widget }).range(from, to)); hidden.push({ from, to }); };
  const inHidden = (from: number) => hidden.some(span => from >= span.from && from < span.to);
  for (const entry of index.entries) {
    if (!entry.options || touched(entry.from, entry.to)) continue;
    const inside = source.slice(entry.options.from, entry.options.to);
    if (inside.length <= longOptions && !inside.includes("\n")) continue;
    add(entry.options.from - 1, entry.options.to + 1, new Summary(summaryText(source, entry.options, false), "options", "Options of this command. Click to edit them."));
  }
  for (const inside of coverOptions(source)) {
    if (touched(inside.from - 1, inside.to + 1)) continue;
    add(inside.from - 1, inside.to + 1, new Summary(summaryText(source, inside, true), "options", "Cover fields. Click to edit them."));
  }
  const seen = new Set<number>();
  for (const ref of index.refs) {
    if (seen.has(ref.command.from) || touched(ref.command.from, ref.command.to) || inHidden(ref.command.from)) continue;
    seen.add(ref.command.from);
    const names = index.refs.filter(other => other.command.from === ref.command.from);
    const starred = source[ref.command.from + source.slice(ref.command.from).search(/[*{]/)] === "*";
    const printed = names.map(use => {
      const text = (index.labels.get(use.name)?.text ?? "??");
      return starred ? text.replace(/^\D+\s/, "") : text;
    }).join(", ");
    add(ref.command.from, ref.command.to, new Summary(printed, "ref", `${source.slice(ref.command.from, ref.command.to)}. Click to edit it.`));
  }
  return Decoration.set(ranges.sort((a, b) => a.from - b.from), true);
}

/** The summaries, read again when the text changes and redrawn when the cursor moves. */
export const codeSummaries = StateField.define<{ index: SourceIndex; decorations: DecorationSet }>({
  create(state) { const index = indexSource(state.doc.toString()); return { index, decorations: build(state, index) }; },
  update(value, transaction) {
    if (!transaction.docChanged && !transaction.selection) return value;
    const index = transaction.docChanged ? indexSource(transaction.state.doc.toString()) : value.index;
    return { index, decorations: build(transaction.state, index) };
  },
  provide: field => EditorView.decorations.from(field, value => value.decorations),
});
