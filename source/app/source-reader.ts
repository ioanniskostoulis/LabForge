// Licensed under the GNU General Public License v2 or later. See LICENSE.
// One reading of LaTeX source shared by the editor's tools: the text cut into prose, commands, arguments, math, comments and verbatim.
import { StateField, type Text } from "@codemirror/state";
import { frameworkCommands } from "./framework-commands";

export type ArgumentKind = "label" | "citation" | "file" | "key" | "math" | "text";
export type RegionKind = "prose" | "command" | "argument" | "math" | "comment" | "verbatim";
/** A stretch of source. `name` is the command's name without its backslash or `*`; `argument` is set on arguments.
 * A text argument is followed by the regions inside it, which are read as source; every other argument is read as one piece. */
export interface SourceRegion { kind: RegionKind; from: number; to: number; name?: string; argument?: ArgumentKind }

/** Arguments that are not prose, by command; the framework catalogue adds its own commands' kinds. */
const builtInArguments: Record<string, ArgumentKind> = {
  begin: "key", end: "key", label: "label", ref: "label", pageref: "label", eqref: "label", myref: "label",
  cite: "citation", citep: "citation", citet: "citation", nocite: "citation", parencite: "citation", textcite: "citation", autocite: "citation",
  input: "file", include: "file", includegraphics: "file", graphicspath: "file", url: "file", href: "file", path: "file", bibliography: "file", addbibresource: "file",
  documentclass: "key", usepackage: "key", RequirePackage: "key", myfigure: "file", myplot: "file", mytable: "file", myformula: "math", myequation: "math", myreaction: "math",
  ce: "math", qty: "key", qtyrange: "key", qtylist: "key", numrange: "key", numlist: "key", ang: "key", num: "key", unit: "key", SI: "key", si: "key", DeclareSIUnit: "key", newcommand: "key", renewcommand: "key", providecommand: "key",
};
const catalogueKinds: Record<string, ArgumentKind> = { label: "label", file: "file", key: "key", math: "math", formula: "math", title: "text" };
let argumentKinds: Map<string, ArgumentKind> | null = null;

/** The kind of a command's first mandatory argument, from the built-in list and then the framework catalogue; `text` when neither knows it. */
export function argumentKind(name: string): ArgumentKind {
  if (!argumentKinds) {
    argumentKinds = new Map(Object.entries(builtInArguments));
    for (const command of frameworkCommands) {
      const kind = catalogueKinds[/\{<([^>]+)>/.exec(command.syntax)?.[1] ?? ""];
      const bare = command.name.replace(/\*$/, "");
      if (kind && !argumentKinds.has(bare)) argumentKinds.set(bare, kind);
    }
  }
  return argumentKinds.get(name) ?? "text";
}

/** Environments that start math in running text. */
export const displayMathEnvironments = new Set(["math", "displaymath", "equation", "equation*", "align", "align*", "gather", "gather*", "multline", "multline*", "flalign", "flalign*"]);
/** Every math environment: the ones above and those that only occur inside math. */
export const mathEnvironments = new Set([...displayMathEnvironments, "aligned", "alignedat", "gathered", "split", "cases", "matrix", "pmatrix", "bmatrix"]);
/** Environments whose text is code, not LaTeX or prose; source checks skip them too. */
export const codeEnvironments = new Set(["verbatim", "verbatim*", "Verbatim", "lstlisting", "minted", "comment", "filecontents", "filecontents*"]);
const commandPattern = /\\([A-Za-z@]+\*?)/y;

function balancedEnd(text: string, from: number, open: string, close: string): number {
  let depth = 0;
  for (let i = from; i < text.length; i++) {
    if (text[i] === "\\") { i++; continue; }
    if (text[i] === open) depth++;
    else if (text[i] === close && --depth === 0) return i + 1;
  }
  return text.length;
}

/** True when the character at `at` follows an odd number of backslashes, as `%` does in `\\%`. */
export function escaped(text: string, at: number): boolean {
  let slashes = 0;
  while (at - slashes > 0 && text[at - slashes - 1] === "\\") slashes++;
  return slashes % 2 === 1;
}

/** Where math or code opened at `from` ends: after `close` when it comes before the paragraph ends (comments in math
 * do not count), or the end of the line when the delimiter is unfinished, so one unclosed `$` cannot hide the rest of the report. */
function delimitedEnd(text: string, from: number, close: string, paragraphs = true): number {
  const lineEnd = text.indexOf("\n", from) < 0 ? text.length : text.indexOf("\n", from);
  const paragraph = paragraphs ? /\n[ \t]*\n/g : null;
  let limit = text.length;
  if (paragraph) { paragraph.lastIndex = from; const found = paragraph.exec(text); if (found) limit = found.index; }
  for (let i = from; i < limit; i++) {
    if (text.startsWith(close, i) && (close.startsWith("\\") || text[i - 1] !== "\\")) return i + close.length;
    // In math, as in TeX, a % starts a comment that hides the rest of its line, closing delimiters included.
    if (paragraphs && text[i] === "%" && !escaped(text, i)) { const end = text.indexOf("\n", i); if (end < 0) break; i = end; continue; }
    if (text[i] === "\\" && !close.startsWith("\\")) i++;
  }
  return lineEnd;
}

/** Read `text` from `from`. Each step of the loop depends only on the text from its position on, so a reading can
 * stop wherever `resume` says an earlier reading of the same text took the same step. */
export function readSource(text: string, from = 0, resume?: (at: number) => boolean): { regions: SourceRegion[]; stopped: number | null } {
  const regions: SourceRegion[] = [];
  const add = (region: SourceRegion) => { if (region.to > region.from || region.kind === "argument") regions.push(region); };
  let prose = -1;
  const endProse = (at: number) => { if (prose >= 0 && at > prose) regions.push({ kind: "prose", from: prose, to: at }); prose = -1; };
  let i = from;
  while (i < text.length) {
    if (resume && i > from && prose < 0 && resume(i)) return { regions, stopped: i };
    const char = text[i];
    if (char !== "%" && char !== "$" && char !== "\\") { if (prose < 0) prose = i; i++; continue; }
    endProse(i);
    if (resume && i > from && resume(i)) return { regions, stopped: i };
    if (char === "%") {
      const end = text.indexOf("\n", i);
      add({ kind: "comment", from: i, to: end < 0 ? text.length : end });
      if (end < 0) break;
      i = end; continue;
    }
    if (text.startsWith("$$", i)) { const end = delimitedEnd(text, i + 2, "$$"); add({ kind: "math", from: i, to: end }); i = end; continue; }
    if (char === "$") { const end = delimitedEnd(text, i + 1, "$"); add({ kind: "math", from: i, to: end }); i = end; continue; }
    if (text.startsWith("\\(", i)) { const end = delimitedEnd(text, i + 2, "\\)"); add({ kind: "math", from: i, to: end }); i = end; continue; }
    if (text.startsWith("\\[", i)) { const end = delimitedEnd(text, i + 2, "\\]"); add({ kind: "math", from: i, to: end }); i = end; continue; }
    commandPattern.lastIndex = i;
    const command = commandPattern.exec(text);
    if (!command) { add({ kind: "command", from: i, to: Math.min(i + 2, text.length) }); i += 2; continue; }
    const name = command[1].replace(/\*$/, "");
    add({ kind: "command", from: i, to: i + command[0].length, name });
    i += command[0].length;
    if (name === "verb") {
      // TeX ends \verb at the line end when its delimiter does not come back on the same line.
      const delimiter = text[i], lineEnd = text.indexOf("\n", i) < 0 ? text.length : text.indexOf("\n", i);
      const close = delimiter && delimiter !== "\n" ? text.indexOf(delimiter, i + 1) : -1;
      const end = close >= 0 && close < lineEnd ? close + 1 : lineEnd;
      add({ kind: "verbatim", from: i, to: end, name });
      i = end; continue;
    }
    while (text[i] === "[") { const end = balancedEnd(text, i, "[", "]"); add({ kind: "argument", from: i, to: end, name, argument: "key" }); i = end; }
    if (text[i] !== "{") continue;
    const end = balancedEnd(text, i, "{", "}"), kind = argumentKind(name);
    add({ kind: "argument", from: i, to: end, name, argument: kind });
    if (kind === "text") continue;
    i = end;
    if (name === "begin") {
      const environment = text.slice(regions[regions.length - 1].from + 1, end - 1);
      if (mathEnvironments.has(environment) || codeEnvironments.has(environment)) {
        // Verbatim text may hold blank lines; math may not.
        const close = delimitedEnd(text, end, `\\end{${environment}}`, !codeEnvironments.has(environment));
        add({ kind: codeEnvironments.has(environment) ? "verbatim" : "math", from: end, to: close, name: environment });
        i = close;
      }
    }
  }
  endProse(Math.min(i, text.length));
  return { regions, stopped: null };
}

/** A step of the reading starts every prose, command and comment region. */
const isStep = (region: SourceRegion) => region.kind === "prose" || region.kind === "command" || region.kind === "comment";

/** The regions of the open document, kept current by reading again only from the edit until the reading meets the old one. */
export const sourceRegions = StateField.define<readonly SourceRegion[]>({
  create: state => readSource(state.doc.toString()).regions,
  update(regions, transaction) {
    if (!transaction.docChanged) return regions;
    let fromA = Infinity, toA = -1, toB = -1;
    transaction.changes.iterChangedRanges((a, b, _c, d) => { fromA = Math.min(fromA, a); toA = Math.max(toA, b); toB = Math.max(toB, d); });
    return rereadSource(regions, transaction.newDoc, fromA, toA, toB, (at, assoc) => transaction.changes.mapPos(at, assoc));
  },
});

/** Regions after an edit that replaced `fromA`–`toA` of the old text; `toB` is where the edit ends in `doc`. */
export function rereadSource(old: readonly SourceRegion[], doc: Text, fromA: number, toA: number, toB: number, map: (at: number, assoc: number) => number): SourceRegion[] {
  // Start from the step before the first region that reaches the edit; text arguments around the edit are read again with their command.
  let first = old.findIndex(region => region.to >= fromA);
  if (first < 0) first = old.length;
  // Math and code environments look for their end beyond the region: math up to the next blank line, code to the end of the text when unclosed.
  const text = doc.toString();
  let blank = -1;
  for (const match of text.slice(0, fromA).matchAll(/\n[ \t]*\n/g)) blank = match.index + match[0].length;
  for (let index = first - 1; index >= 0; index--) {
    const region = old[index];
    if (region.kind === "math" && region.from >= blank - 1) first = index;
    else if (region.kind === "verbatim" && region.name !== "verb" && !text.startsWith(`\\end{${region.name}}`, region.to - region.name!.length - 6)) first = index;
  }
  while (first > 0 && (first === old.length || !isStep(old[first]))) first--;
  const start = first < old.length ? old[first].from : 0;
  const after = new Map<number, number>();
  for (let index = first; index < old.length; index++)
    if (old[index].from >= toA && isStep(old[index])) after.set(map(old[index].from, 1), index);
  const read = readSource(text, start, at => at >= toB && after.has(at));
  const regions = [...old.slice(0, first), ...read.regions];
  if (read.stopped === null) return regions;
  const shift = read.stopped - old[after.get(read.stopped)!].from;
  for (let index = after.get(read.stopped)!; index < old.length; index++) regions.push({ ...old[index], from: old[index].from + shift, to: old[index].to + shift });
  return regions;
}
