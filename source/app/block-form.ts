// Licensed under the GNU General Public License v2 or later. See LICENSE.
// The inspector's Block section: the options of the heading, figure, plot, table or formula under the cursor as fields.
// A changed field rewrites only that key of the command, as one undoable edit in main.tex.
import { createField } from "forge-shell/app/builders";
import { createSelectControl } from "forge-shell/app/select-control";
import { setTip } from "forge-shell/app/tips";
import { setOption, splitSpans, type IndexEntry } from "./source-index";

export type BlockEdit = { from: number; to: number; insert: string };
interface FieldSpec { key: string; label: string; tip: string; choices?: readonly (readonly [string, string])[] }

const place = (wrap: boolean): FieldSpec => ({ key: "place", label: "Place", tip: "Where the block goes: here, or floated to where it fits.",
  choices: [["", "Here"], ["float", "Float"], ...(wrap ? [["wrap", "Wrap right"], ["wrap-left", "Wrap left"]] as const : [])] });
const captionAlign: FieldSpec = { key: "caption-align", label: "Caption", tip: "How the caption is aligned; Default follows the report's settings.",
  choices: [["", "Default"], ["justify", "Justified"], ["center", "Centred"], ["left", "Left"], ["right", "Right"]] };
const label: FieldSpec = { key: "label", label: "Label", tip: "The name \\myref uses for this block." };

const fields: Record<IndexEntry["kind"], FieldSpec[]> = {
  section: [label],
  figure: [{ key: "caption", label: "Caption", tip: "The caption under the figure." }, { key: "subcaption", label: "Subcaptions", tip: "One per image, separated by commas, for images side by side." }, label,
    { key: "width", label: "Width", tip: "A share of the line, such as 0.48, or a length such as 6cm." }, { key: "height", label: "Height", tip: "A length, such as 5cm." }, place(true), { ...captionAlign, label: "Caption align" }],
  plot: [{ key: "caption", label: "Caption", tip: "The caption under the plot." }, { key: "subcaption", label: "Subcaptions", tip: "One per plot, separated by commas, for plots side by side." }, label,
    { key: "width", label: "Width", tip: "A share of the line, such as 0.8, or a length such as 8cm." }, { key: "height", label: "Height", tip: "A length, such as 6cm." }, place(true), { ...captionAlign, label: "Caption align" }],
  table: [{ key: "caption", label: "Caption", tip: "The caption above the table." }, label, { key: "width", label: "Width", tip: "A share of the line, such as 0.9." }, place(false), { ...captionAlign, label: "Caption align" }],
  formula: [label, place(false)],
  reaction: [label, place(false)],
  equation: [place(false)],
};
const argumentLabel: Partial<Record<IndexEntry["kind"], string>> = { section: "Title", figure: "Images", plot: "Plots", table: "Table file" };
const kindName: Record<IndexEntry["kind"], string> = { section: "Heading", figure: "Figure", plot: "Plot", table: "Table", formula: "Formula", reaction: "Reaction", equation: "Equation" };

/** Draw the form for `entry` (or an empty note) into `host`. `apply` writes one edit; `source` is the current text of main.tex. */
export function renderBlockForm(host: HTMLElement, entry: IndexEntry | undefined, source: string, apply: (edit: BlockEdit) => void): void {
  if (!entry) {
    const empty = document.createElement("div");
    empty.className = "outline-empty";
    empty.textContent = "No block at the cursor.";
    host.replaceChildren(empty);
    return;
  }
  const rows: HTMLElement[] = [];
  const heading = document.createElement("div");
  heading.className = "block-form-kind";
  heading.textContent = `${kindName[entry.kind]} \\${entry.command}${entry.number ? `, ${entry.number}` : ""}`;
  rows.push(heading);
  const text = (value: string, name: string, commit: (value: string) => void): HTMLInputElement => {
    const input = document.createElement("input");
    input.type = "text"; input.value = value; input.spellcheck = false; input.setAttribute("aria-label", name);
    let shown = value;
    const done = () => { if (input.value !== shown) { shown = input.value; commit(input.value); } };
    input.addEventListener("change", done);
    input.addEventListener("keydown", event => { if (event.key === "Enter") { event.preventDefault(); done(); input.blur(); } if (event.key === "Escape") { input.value = shown; input.blur(); } });
    return input;
  };
  const argument = argumentLabel[entry.kind];
  if (argument) {
    const field = createField(argument, text(source.slice(entry.argument.from, entry.argument.to).trim(), argument, value => apply({ ...entry.argument, insert: value.trim() })));
    setTip(field, entry.kind === "section" ? "The heading's text." : "File names relative to their folder, separated by commas for a row side by side.");
    rows.push(field);
  }
  for (const spec of fields[entry.kind]) {
    const current = entry.items.find(item => item.key === spec.key);
    // A default label is not written; the field shows it so it can be kept or renamed.
    let value = current?.value ?? (spec.key === "label" && entry.label ? entry.label : "");
    // Subcaptions are written {A}, {B}; the field shows A, B and writes the braces back.
    const parts = (text: string) => splitSpans(text, 0).map(span => text.slice(span.from, span.to).replace(/^\{([\s\S]*)\}$/, "$1").trim());
    if (spec.key === "subcaption") value = parts(value).join(", ");
    let control: HTMLElement;
    if (spec.choices) {
      const choiceValue = spec.key === "place" && value === "here" ? "" : value;
      const choices = [...spec.choices.map(([choice, name]) => ({ value: choice, label: name }))];
      if (choiceValue && !choices.some(choice => choice.value === choiceValue)) choices.push({ value: choiceValue, label: choiceValue });
      const select = createSelectControl({ label: spec.label, choices, value: choiceValue, onChange: next => apply(setOption(source, entry, spec.key, next)) });
      control = select;
    } else control = text(value, spec.label, next => apply(setOption(source, entry, spec.key, spec.key === "subcaption" && next.trim() ? parts(next).map(part => `{${part}}`).join(", ") : next)));
    const field = createField(spec.label, control);
    setTip(field, spec.tip);
    rows.push(field);
  }
  host.replaceChildren(...rows);
}
