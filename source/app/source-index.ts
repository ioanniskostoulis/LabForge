// Licensed under the GNU General Public License v2 or later. See LICENSE.
// One reading of main.tex for the navigation tools: the outline, ⌘-click in the code, the block form, label renaming,
// the reference check and the reference summaries. It numbers headings, figures, tables, formulas and reactions the way
// the class does (documentation/FRAMEWORK.md) and keeps every position, so a tool can jump to or rewrite the exact text.
import { citeCommands, refCommands } from "./references";
import { readClassOptions } from "./document-class";

export type BlockKind = "section" | "figure" | "plot" | "table" | "formula" | "equation" | "reaction";
export interface Span { from: number; to: number }
/** One `key = value` of an options group: where the whole item, its key and its value are. */
export interface OptionItem { key: string; value: string; item: Span; valueSpan: Span }
/** A heading or numbered block, with its command, options and argument. */
export interface IndexEntry extends Span {
  kind: BlockKind;
  command: string;
  /** 1 to 3 for headings; 4 for blocks, which sit under the heading before them. */
  level: number;
  /** As printed: "2.1" for a heading, "3" for a figure or table, "(4)" or "(4)–(5)" for a formula, "R1" for a reaction; "" when unnumbered. */
  number: string;
  /** The heading or caption as plain text. */
  title: string;
  label?: string;
  /** Where the label is written; absent for a default label of a figure, plot or table. */
  labelSpan?: Span;
  /** The inside of `[…]`, or null when the command has none; `optionsAt` is where `[` would go. */
  options: Span | null;
  optionsAt: number;
  items: OptionItem[];
  /** The inside of `{…}`. */
  argument: Span;
  /** Files named by a figure, plot or table, with their spans. */
  files: { name: string; span: Span }[];
}
/** A name in a reference, citation or input, and the whole command it is in. */
export interface NameUse { name: string; span: Span; command: Span }
export interface SourceIndex {
  entries: IndexEntry[];
  /** Every label, with what a reference to it prints ("Figure 3", "Equation (2)", "Section 2.1") and where it is defined. */
  labels: Map<string, { text: string; entry?: IndexEntry; span?: Span }>;
  /** Labels defined more than once, with each place. */
  duplicates: Map<string, Span[]>;
  refs: NameUse[];
  cites: NameUse[];
  /** `\input` and `\include` names, as written. */
  inputs: NameUse[];
}

const sectionLevels: Record<string, number> = { mysection: 1, mysubsection: 2, mysubsubsection: 3 };
const blockKinds: Record<string, BlockKind> = { myfigure: "figure", myplot: "plot", mytable: "table", myformula: "formula", myequation: "equation", myreaction: "reaction" };
const words = {
  greek: { figure: "Σχήμα", table: "Πίνακας", equation: "Σχέση", reaction: "Αντίδραση", section: "Ενότητα" },
  english: { figure: "Figure", table: "Table", equation: "Equation", reaction: "Reaction", section: "Section" },
};
const defaultPrefix: Partial<Record<BlockKind, string>> = { figure: "fig", plot: "plot", table: "tab" };

/** Replace comments with spaces, keeping every offset. */
export function blankComments(source: string): string {
  return source.replace(/(^|[^\\])((?:\\\\)*)(%[^\n]*)/g, (_, before: string, slashes: string, comment: string) => before + slashes + " ".repeat(comment.length));
}

/** The index after the group opening at `at` (`{` or `[`), or -1 when it does not close. */
export function groupEnd(text: string, at: number): number {
  const square = text[at] === "[";
  let depth = 0, braces = 0;
  for (let index = at; index < text.length; index++) {
    const char = text[index];
    if (char === "\\") { index++; continue; }
    if (square) {
      if (char === "{") braces++;
      else if (char === "}") braces--;
      else if (braces === 0 && char === "[") depth++;
      else if (braces === 0 && char === "]" && --depth === 0) return index + 1;
    } else if (char === "{") depth++;
    else if (char === "}" && --depth === 0) return index + 1;
  }
  return -1;
}

const skipSpace = (text: string, at: number): number => { while (at < text.length && /\s/.test(text[at]) && !/^\n[ \t]*\n/.test(text.slice(at, at + 40))) at++; return at; };

/** Top-level pieces of `text` between `separator`s, as spans of `text` (offset by `base`), trimmed. */
export function splitSpans(text: string, base: number, separator = ","): Span[] {
  const spans: Span[] = [];
  let depth = 0, start = 0;
  const push = (end: number) => {
    let from = start, to = end;
    while (from < to && /\s/.test(text[from])) from++;
    while (to > from && /\s/.test(text[to - 1])) to--;
    if (to > from) spans.push({ from: base + from, to: base + to });
  };
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (char === "\\") { index++; continue; }
    if (char === "{" || char === "[") depth++;
    else if (char === "}" || char === "]") depth--;
    else if (char === separator && depth === 0) { push(index); start = index + 1; }
  }
  push(text.length);
  return spans;
}

/** The `key = value` items of an options group whose inside starts at `base`. Values keep their braces in `valueSpan`; `value` has them removed. */
export function readOptionItems(text: string, inside: Span): OptionItem[] {
  return splitSpans(text.slice(inside.from, inside.to), inside.from).map(item => {
    const raw = text.slice(item.from, item.to), equals = raw.indexOf("=");
    if (equals < 0) return { key: raw.trim().toLowerCase(), value: "true", item, valueSpan: { from: item.to, to: item.to } };
    let from = item.from + equals + 1;
    while (from < item.to && /\s/.test(text[from])) from++;
    const value = text.slice(from, item.to);
    const bare = value.startsWith("{") && groupEnd(value, 0) === value.length ? value.slice(1, -1).trim() : value.trim();
    return { key: raw.slice(0, equals).trim().toLowerCase(), value: bare, item, valueSpan: { from, to: item.to } };
  });
}

/** Plain text of a heading or caption: commands dropped, their arguments kept, math kept as written. */
export function plainText(source: string): string {
  return source.replace(/\\\\/g, " ").replace(/~/g, " ").replace(/\\(?:myref|ref|cite)\*?\{[^}]*\}/g, "…")
    .replace(/\\[a-zA-Z]+\*?(?:\[[^\]]*\])?/g, "").replace(/\\([%#&_$])/g, "$1").replace(/[{}]/g, "").replace(/\$/g, "").replace(/\s+/g, " ").trim();
}

/** Rows of a formula that get a number: top-level `\\` rows without `\nonumber`. */
function numberedRows(math: string): number {
  const rows = math.replace(/\\\\/g, "\u0001");
  return splitSpans(rows, 0, "\u0001").map(span => rows.slice(span.from, span.to)).filter(row => !/\\(?:nonumber|notag)\b/.test(row)).length || 1;
}

/** The report language as the Builder reads it, from the class line. */
const languageOf = (text: string): "greek" | "english" => readClassOptions(text)?.language === "english" ? "english" : "greek";

/** Read main.tex. Positions are offsets into `source`. */
export function indexSource(source: string): SourceIndex {
  const text = blankComments(source);
  const language = languageOf(text), word = words[language];
  const entries: IndexEntry[] = [];
  const labels: SourceIndex["labels"] = new Map();
  const defined = new Map<string, Span[]>();
  const define = (name: string, value: { text: string; entry?: IndexEntry; span?: Span }) => {
    if (value.span) defined.set(name, [...(defined.get(name) ?? []), value.span]);
    if (!labels.has(name) || value.span) labels.set(name, value);
  };
  const sections = [0, 0, 0];
  const counts = { figure: 0, table: 0, equation: 0, reaction: 0 };
  const commandPattern = /\\(mysection|mysubsection|mysubsubsection|myfigure|myplot|mytable|myformula|myequation|myreaction)\b(\*?)/g;
  for (let match; (match = commandPattern.exec(text));) {
    const command = match[1], star = match[2] === "*";
    let at = skipSpace(text, match.index + match[0].length);
    const optionsAt = match.index + match[0].length;
    let options: Span | null = null;
    if (text[at] === "[") { const end = groupEnd(text, at); if (end < 0) continue; options = { from: at + 1, to: end - 1 }; at = skipSpace(text, end); }
    if (text[at] !== "{") continue;
    const end = groupEnd(text, at);
    if (end < 0) continue;
    const argument = { from: at + 1, to: end - 1 };
    const items = options ? readOptionItems(text, options) : [];
    const labelItem = items.find(item => item.key === "label");
    const kind: BlockKind = command in sectionLevels ? "section" : blockKinds[command];
    const content = source.slice(argument.from, argument.to);
    let number = "", reference = "";
    if (kind === "section") {
      const level = sectionLevels[command] - 1;
      if (!star) { sections[level]++; sections.fill(0, level + 1); number = sections.slice(0, level + 1).join("."); reference = `${word.section} ${number}`; }
    } else if (kind === "figure" || kind === "plot") { number = String(++counts.figure); reference = `${word.figure} ${number}`; }
    else if (kind === "table") { number = String(++counts.table); reference = `${word.table} ${number}`; }
    else if (kind === "reaction") { number = `R${++counts.reaction}`; reference = `${word.reaction} (${number})`; }
    else if (kind === "formula") {
      const first = counts.equation + 1, rows = numberedRows(content);
      counts.equation += rows;
      number = rows > 1 ? `(${first})–(${counts.equation})` : `(${first})`;
      reference = `${word.equation} ${number}`;
    }
    const files = kind === "figure" || kind === "plot" || kind === "table"
      ? splitSpans(content, argument.from).map(span => ({ name: source.slice(span.from, span.to), span })) : [];
    const caption = items.find(item => item.key === "caption")?.value;
    const title = kind === "section" ? plainText(content) : caption ? plainText(caption) : kind === "formula" || kind === "equation" || kind === "reaction" ? content.replace(/\s+/g, " ").trim() : files.map(file => file.name).join(", ");
    const entry: IndexEntry = {
      kind, command, level: kind === "section" ? sectionLevels[command] : 4, number, title, options, optionsAt, items, argument, files,
      from: match.index, to: end,
      ...(labelItem ? { label: labelItem.value, labelSpan: labelItem.valueSpan } : {}),
    };
    // A figure, plot or table without a label gets one from its kind and first file name (FRAMEWORK.md).
    const prefix = defaultPrefix[kind];
    if (!entry.label && prefix && files[0]) entry.label = `${prefix}:${files[0].name.replace(/^.*\//, "").replace(/\.[^.]+$/, "")}`;
    entries.push(entry);
    if (!entry.label) continue;
    define(entry.label, { text: reference, entry, span: entry.labelSpan });
    if ((kind === "figure" || kind === "plot") && files.length > 1 && caption !== undefined)
      files.forEach((_, index) => define(`${entry.label}[${index + 1}]`, { text: `${reference}${String.fromCharCode(97 + index)}`, entry }));
    if (kind === "formula") {
      const rows = numberedRows(content), first = counts.equation - rows + 1;
      if (rows > 1) for (let row = 0; row < rows; row++) define(`${entry.label}[${row + 1}]`, { text: `${word.equation} (${first + row})`, entry });
    }
  }
  for (const match of text.matchAll(/\\label\s*\{([^{}]+)\}/g)) {
    const from = match.index + match[0].indexOf("{") + 1;
    define(match[1].trim(), { text: "??", span: { from, to: from + match[1].length } });
  }
  const names = (pattern: RegExp): NameUse[] => [...text.matchAll(pattern)].flatMap(found => {
    const open = found.index + found[0].lastIndexOf("{") + 1;
    const command = { from: found.index, to: found.index + found[0].length };
    return splitSpans(found[found.length - 1], open).map(span => ({ name: source.slice(span.from, span.to), span, command }));
  });
  const duplicates = new Map([...defined].filter(([, spans]) => spans.length > 1));
  return {
    entries, labels, duplicates,
    refs: names(new RegExp(`\\\\(?:${refCommands})\\*?\\s*\\{([^{}]*)\\}`, "g")),
    cites: names(new RegExp(`\\\\(?:${citeCommands})\\*?(?:\\s*\\[[^\\]]*\\]){0,2}\\s*\\{([^{}]*)\\}`, "g")),
    inputs: names(/\\(?:input|include)\s*\{([^{}]*)\}/g),
  };
}

/** The entry whose command contains `offset`. */
export function entryAt(index: SourceIndex, offset: number): IndexEntry | undefined {
  return index.entries.find(entry => offset >= entry.from && offset <= entry.to);
}

const within = (span: Span, offset: number) => offset >= span.from && offset <= span.to;

/** What ⌘-click on `offset` opens: a label's definition, a file, a bibliography entry, or nothing. */
export type CodeTarget =
  | { kind: "label"; name: string; at?: Span }
  | { kind: "file"; path: string }
  | { kind: "citation"; key: string };
export function targetAt(index: SourceIndex, offset: number): CodeTarget | null {
  // The whole command counts, so a click on a summarised reference (shown as "Figure 3") still follows it.
  const ref = index.refs.find(use => within(use.span, offset)) ?? index.refs.find(use => within(use.command, offset));
  if (ref) {
    // A part (`name[2]`) goes to where its block's label is written, or to the block when the label is a default one.
    const found = index.labels.get(ref.name), base = index.labels.get(ref.name.replace(/\[\d+\]$/, ""));
    const span = found?.span ?? base?.span, entry = found?.entry ?? base?.entry;
    return { kind: "label", name: ref.name, at: span ?? (entry ? { from: entry.from, to: entry.from } : undefined) };
  }
  const cite = index.cites.find(use => within(use.span, offset)) ?? index.cites.find(use => within(use.command, offset));
  if (cite) return { kind: "citation", key: cite.name };
  const input = index.inputs.find(use => within(use.command, offset));
  if (input) return { kind: "file", path: /\.\w+$/.test(input.name) ? input.name : `${input.name}.tex` };
  for (const entry of index.entries) {
    const file = entry.files.find(item => within(item.span, offset));
    if (file) return { kind: "file", path: `${entry.kind === "table" ? "tables" : entry.kind === "plot" ? "plots" : "graphics"}/${file.name}` };
  }
  return null;
}

/** The label under `offset`, written in a `label=` or named by a reference. */
export function labelAt(index: SourceIndex, offset: number): string | null {
  const entry = index.entries.find(item => item.labelSpan && within(item.labelSpan, offset));
  if (entry) return entry.label!;
  const ref = index.refs.find(use => within(use.span, offset));
  if (ref) return ref.name.replace(/\[\d+\]$/, "");
  for (const [name, value] of index.labels) if (value.span && within(value.span, offset)) return name;
  return null;
}

/** The edits that rename a label: its definition, every reference to it and to its parts (`name[2]`). */
export function renameLabel(index: SourceIndex, from: string, to: string): { from: number; to: number; insert: string }[] {
  const edits: { from: number; to: number; insert: string }[] = [];
  const found = index.labels.get(from);
  if (found?.span) edits.push({ ...found.span, insert: to });
  else if (found?.entry) {
    // A default label is not written anywhere: write the new one into the block's options.
    const entry = found.entry;
    edits.push(entry.options ? { from: entry.options.from, to: entry.options.from, insert: `label=${to}${entry.items.length ? ", " : ""}` } : { from: entry.optionsAt, to: entry.optionsAt, insert: `[label=${to}]` });
  }
  for (const ref of index.refs) {
    const part = /^(.*?)(\[\d+\])?$/.exec(ref.name)!;
    if (part[1] === from) edits.push({ ...ref.span, insert: `${to}${part[2] ?? ""}` });
  }
  return edits.sort((a, b) => a.from - b.from);
}

/** Problems with references: names not defined, labels defined twice, and labels written but never referenced. */
export interface ReferenceProblem { kind: "undefined" | "duplicate" | "unused"; name: string; span: Span }
export function referenceProblems(index: SourceIndex): ReferenceProblem[] {
  const problems: ReferenceProblem[] = [];
  for (const ref of index.refs) {
    if (!ref.name || index.labels.has(ref.name)) continue;
    problems.push({ kind: "undefined", name: ref.name, span: ref.span });
  }
  for (const [name, spans] of index.duplicates) problems.push({ kind: "duplicate", name, span: spans[1] });
  const used = new Set(index.refs.map(ref => ref.name.replace(/\[\d+\]$/, "")));
  for (const [name, value] of index.labels) if (value.span && !name.includes("[") && !used.has(name)) problems.push({ kind: "unused", name, span: value.span });
  return problems.sort((a, b) => a.span.from - b.span.from);
}

/** Set, change or remove (`value` empty) one key of a block's options. Values with commas, `=` or brackets are braced. */
export function setOption(source: string, entry: IndexEntry, key: string, value: string): { from: number; to: number; insert: string } {
  const written = value.trim() === "" ? "" : /[,=[\]]/.test(value) || key === "caption" || key === "subcaption" ? `{${value.trim()}}` : value.trim();
  const item = entry.items.find(each => each.key === key);
  if (item && written) return { ...item.valueSpan, insert: written };
  if (item) {
    // Remove the item with the comma after it, or the one before it when it is the last.
    const index = entry.items.indexOf(item), next = entry.items[index + 1], previous = entry.items[index - 1];
    if (entry.items.length === 1) return { from: entry.optionsAt, to: entry.options!.to + 1, insert: "" };
    return next ? { from: item.item.from, to: next.item.from, insert: "" } : { from: previous.item.to, to: item.item.to, insert: "" };
  }
  if (!written) return { from: entry.optionsAt, to: entry.optionsAt, insert: "" };
  if (!entry.options) return { from: entry.optionsAt, to: entry.optionsAt, insert: `[${key}=${written}]` };
  const last = entry.items.at(-1);
  if (!last) return { from: entry.options.from, to: entry.options.to, insert: `${key}=${written}` };
  // Multi-line options get the new key on its own line, indented like the last one.
  const multiline = source.slice(entry.options.from, entry.options.to).includes("\n");
  const indent = multiline ? /[ \t]*$/.exec(source.slice(0, last.item.from))![0] : "";
  return { from: last.item.to, to: last.item.to, insert: multiline ? `,\n${indent}${key}=${written}` : `, ${key}=${written}` };
}
