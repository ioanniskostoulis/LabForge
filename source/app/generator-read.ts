// Licensed under the GNU General Public License v2 or later. See LICENSE.
// Reads the options back from the code in the Plots and Tables panes, so a hand edit in the Code tile moves the options.
// Only what the code states plainly is read; a field the code does not settle is left out.
import type { GeneratorKind, PlotForm, TableForm } from "./generator-form";
import { customFunction, customPoints } from "./generator-form";
import { firstStatement } from "./generator-patch";
import { tableColumns } from "../engine/generators";

type Read = Partial<PlotForm & TableForm>;

/** The inverse of `labelText`: `\%`, `\&` and `\#` are the characters themselves in a one-line field. */
const unescape = (text: string) => text.replace(/\\([%&#])/g, "$1");

/** The text of the first top-level `{…}` group after `from`, or `null`. */
function braced(text: string, from: number): string | null {
  const open = text.indexOf("{", from);
  if (open < 0) return null;
  let depth = 0;
  for (let at = open; at < text.length; at++) {
    if (text[at] === "\\") { at++; continue; }
    if (text[at] === "{") depth++;
    else if (text[at] === "}" && --depth === 0) return text.slice(open + 1, at);
  }
  return null;
}

/** `% data: source, sheet, range` or `% data 1: source, range, column B`: the file, sheet and range a block reads. */
function dataMarker(lines: string[]): { source: string; sheet: string; range: string } | null {
  const line = lines.find(item => /^\s*% data(?: \d+)?:/.test(item));
  if (!line) return null;
  const parts = line.replace(/^\s*% data(?: \d+)?:/, "").split(",").map(part => part.trim()).filter(Boolean);
  if (parts.length && /^columns? /.test(parts[parts.length - 1])) parts.pop();
  const range = parts.pop();
  if (!range || !parts.length || !/^[A-Za-z]{1,3}\d+:[A-Za-z]{1,3}\d+$/.test(range)) return null;
  return { source: parts[0], sheet: parts.slice(1).join(", "), range: range.toUpperCase() };
}

/** The axis options between `\begin{axis}[` and its closing `]`, as written. */
function axisText(code: string): string {
  const start = code.search(/^\s*\\begin\{axis\}/m);
  if (start < 0) return "";
  const open = code.indexOf("[", start), line = code.indexOf("\n", start);
  if (open < 0 || (line >= 0 && open > line)) return "";
  let depth = 0;
  for (let at = open; at < code.length; at++) {
    if (code[at] === "[" || code[at] === "{") depth++;
    else if ((code[at] === "]" || code[at] === "}") && --depth === 0) return code.slice(open + 1, at);
  }
  return "";
}

function readPlot(code: string): Read {
  const read: Read = {};
  const axis = axisText(code);
  const option = (key: string) => new RegExp(`(?:^|[,\\s])${key}\\s*=\\s*`, "m").exec(axis);
  for (const [key, field] of [["xlabel", "xlabel"], ["ylabel", "ylabel"]] as const) {
    const at = option(key);
    read[field] = at ? unescape((braced(axis, at.index + at[0].length - 1) ?? axis.slice(at.index + at[0].length).split(/[,\n]/)[0]).trim()) : "";
  }
  read.grid = !!option("grid") && !/grid\s*=\s*none/.test(axis);
  read.xlog = /xmode\s*=\s*log/.test(axis);
  read.ylog = /ymode\s*=\s*log/.test(axis);

  const lines = code.split("\n");
  const statement = firstStatement(lines);
  if (!statement) return read;
  const text = lines.slice(statement[0], statement[1] + 1).join("\n");
  const marker = dataMarker(lines.slice(statement[0], statement[1] + 1));
  if (marker) { read.source = marker.source; read.sheet = marker.sheet; read.range = marker.range; return read; }
  if (/\\addplot\s*(?:\[[^\]]*\])?\s*coordinates/.test(text)) {
    const points = [...text.matchAll(/\(\s*([^,()\s]+)\s*,\s*([^,()\s]+)\s*\)/g)].map(match => `${match[1]},${match[2]}`);
    if (points.length) { read.source = customPoints; read.points = points.join(" "); }
  } else {
    const expression = /\\addplot\s*(?:\[[^\]]*\])?\s*\{(.*)\}\s*;/s.exec(text);
    const domain = /domain\s*=\s*([^,\]\s]+)/.exec(text);
    if (expression && domain) { read.source = customFunction; read.expression = expression[1].trim(); read.domain = domain[1]; }
  }
  // A custom series' legend is its entry; a spreadsheet's names come from its header row, so they are not read.
  if (read.source === customFunction || read.source === customPoints) {
    const entry = code.indexOf("\\addlegendentry");
    read.legend = entry < 0 ? "" : unescape((braced(code, entry) ?? "").trim());
  }
  return read;
}

function readTable(code: string): Read {
  const read: Read = {};
  const lines = code.split("\n");
  const columns = lines.find(line => /^\\begin\{labtable\}|^\\tablecolumns/.test(line.trim()));
  if (columns) {
    // Letters alone read as lcr; with any width, one column per word: l[0.6] c c[2].
    const spec = /\{([^{}]*)\}\s*$/.exec(columns.trim())?.[1] ?? "";
    const parsed = tableColumns(spec);
    read.align = parsed ? parsed.join(parsed.some(column => column.length > 1) ? " " : "") : spec.replace(/\s+/g, "");
  }
  read.header = lines.some(line => line.trim().startsWith("\\tablehead"));
  const marker = dataMarker(lines);
  if (marker) { read.source = marker.source; read.sheet = marker.sheet; read.range = marker.range; }
  return read;
}

/** What the code says about the options. */
export function readCode(kind: GeneratorKind, code: string): Read { return kind === "plot" ? readPlot(code) : readTable(code); }

/** The options whose value in the code differs from `before`, a reading of the code as the options last wrote it. A change in a field the options write for themselves (a table's automatic alignment) is therefore not mistaken for a hand edit. */
export function changedOptions(now: Read, before: Read | null): Read {
  const changed: Read = {};
  for (const key of Object.keys(now) as (keyof Read)[]) if (!before || before[key] !== now[key]) (changed as Record<string, unknown>)[key] = now[key];
  return changed;
}
