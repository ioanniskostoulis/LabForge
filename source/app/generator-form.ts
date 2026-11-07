// Licensed under the GNU General Public License v2 or later. See LICENSE.
// The Plots and Tables forms as data, and the writer settings they stand for. A spreadsheet source
// lists Source, Sheet, Range, then Size and Format in both; a plot's custom function or custom
// points replace Sheet and Range with Function and Domain, or Points.
import { tableColumns, type GeneratorSettings, type PlotSettings } from "../engine/generators";
import type { CodePart } from "./generator-patch";

export type GeneratorKind = "plot" | "table";
/** Fields both forms have, in the same places. Width (and a plot's Height) go to the `\myplot` or `\mytable` line, not into the file. */
type SharedForm = { source: string; sheet: string; width: string };
/** A plot's Source: a spreadsheet's project path, or one of these. */
export const customFunction = "custom:function", customPoints = "custom:points";
export type PlotForm = SharedForm & { range: string; expression: string; domain: string; points: string; height: string;
  xlabel: string; ylabel: string; legend: string; grid: boolean; xlog: boolean; ylog: boolean };
export type TableForm = SharedForm & { range: string; header: boolean; align: string; /** Formulas, units, numbers and symbols written as TeX. */ smart: boolean; /** The rows' line spread, such as 1.2; empty follows the report. */ spread: string };

export const plotFormDefaults: PlotForm = { source: customFunction, sheet: "", range: "A1:B10", expression: "x^2", domain: "0:10", points: "0,0 1,1 2,4 3,9",
  width: "", height: "", xlabel: "", ylabel: "", legend: "", grid: false, xlog: false, ylog: false };
export const tableFormDefaults: TableForm = { source: "", sheet: "", range: "A1:C10", width: "", header: true, align: "", smart: true, spread: "" };

const numberText = String.raw`[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?`;
const lengthText = String.raw`(?:\d+\.?\d*|\.\d+)\s*(?:cm|mm|in|pt|em)`;

/** The keys for the `\myplot` or `\mytable` line: width and height (a table's row height is `spread`), or the problem with them. */
export function sizeKeys(kind: GeneratorKind, form: PlotForm | TableForm): string | { problem: string } {
  const keys: string[] = [];
  const width = form.width.trim();
  if (width) {
    if (!new RegExp(`^(?:0?\\.\\d+|1(?:\\.0*)?|${lengthText})$`).test(width)) return { problem: "Write the width as a fraction of the column, such as 0.8, or a length, such as 8cm." };
    keys.push(`width=${width.replace(/\s+/g, "")}`);
  }
  const height = kind === "plot" ? (form as PlotForm).height.trim() : "";
  if (height) {
    if (!new RegExp(`^${lengthText}$`).test(height)) return { problem: "Write the height as a length, such as 6cm." };
    keys.push(`height=${height.replace(/\s+/g, "")}`);
  }
  const spread = kind === "table" ? (form as TableForm).spread.trim() : "";
  if (spread) {
    if (!/^(?:\d+\.?\d*|\.\d+)$/.test(spread) || Number(spread) < 0.5 || Number(spread) > 4) return { problem: "Write the row height as a line spread between 0.5 and 4, such as 1.2." };
    keys.push(`spread=${Number(spread)}`);
  }
  return keys.join(", ");
}

/** The line that shows a saved file in main.tex. */
export function includeLine(kind: GeneratorKind, name: string, keys: string): string {
  return `\\my${kind}${keys ? `[${keys}]` : ""}{${name}}`;
}

/** Text for a label or legend: TeX is kept (`$\mu$`, `\ce{…}`), but a `%`, `&` or `#` typed on its own is the character, since in a one-line field it is never a comment, a column or a parameter. */
export function labelText(text: string): string {
  return text.trim().replace(/(?<!\\)([%&#])/g, "\\$1");
}

const columnNumber = (letters: string) => [...letters.toUpperCase()].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0);

/** Settings for the writers from a form, or the problem that stops them. */
export function formSettings(kind: GeneratorKind, form: PlotForm | TableForm): GeneratorSettings | string {
  const size = sizeKeys(kind, form);
  if (typeof size !== "string") return size.problem;
  if (kind === "table") {
    const table = form as TableForm;
    if (!table.source) return "Choose a data file in Source.";
    if (!/^[A-Za-z]{1,3}\d+:[A-Za-z]{1,3}\d+$/.test(table.range.trim())) return "Write the range as two cells, such as A1:C10.";
    const columns = table.align.trim() ? tableColumns(table.align) : [];
    if (!columns) return "Write the alignment as l, c and r letters, one per column, each with an optional width such as c[2], or leave it empty.";
    const cells = /^([A-Za-z]{1,3})\d+:([A-Za-z]{1,3})\d+$/.exec(table.range.trim())!;
    const count = columnNumber(cells[2]) - columnNumber(cells[1]) + 1;
    if (columns.length && columns.length !== count) return `The range has ${count} ${count === 1 ? "column" : "columns"}; give ${count} alignment ${count === 1 ? "letter" : "letters"}, or leave it empty.`;
    return { kind: "table", source: table.source, ...(table.sheet ? { sheet: table.sheet } : {}), range: table.range.trim().toUpperCase(), header: table.header,
      ...(columns.length ? { columns: columns.join(" ") } : {}), ...(table.smart ? { smart: true } : {}) };
  }
  const plot = form as PlotForm;
  const legend = plot.legend.trim() ? { legend: labelText(plot.legend) } : {};
  let series: PlotSettings["series"][number];
  if (!plot.source) return "Choose a data file, Function or Points in Source.";
  if (plot.source !== customFunction && plot.source !== customPoints) {
    const range = plot.range.trim().toUpperCase();
    const cells = /^([A-Z]{1,3})\d+:([A-Z]{1,3})\d+$/.exec(range);
    if (!cells) return "Write the range as two cells, such as A1:C20.";
    if (columnNumber(cells[2]) <= columnNumber(cells[1])) return "Give the range two or more columns: x first, then one column per series.";
    // Legend names, comma-separated, replace the header names in order.
    const legends = plot.legend.split(",").map(labelText).filter(Boolean);
    series = { type: "range", source: plot.source, ...(plot.sheet ? { sheet: plot.sheet } : {}), range, ...(legends.length ? { legends } : {}) };
  } else if (plot.source === customFunction) {
    if (!plot.expression.trim()) return "Write a function of x, such as 0.2*x^2.";
    if (!new RegExp(`^${numberText}:${numberText}$`).test(plot.domain.trim())) return "Write the domain as from:to, such as 0:10.";
    series = { type: "function", expression: plot.expression.trim(), domain: plot.domain.trim(), ...legend };
  } else {
    const pairs = plot.points.trim().split(/\s+/).map(item => new RegExp(`^(${numberText}),(${numberText})$`).exec(item));
    if (pairs.length < 2 || pairs.some(pair => !pair)) return "Write two or more points as x,y separated by spaces.";
    series = { type: "points", points: pairs.map(pair => [Number(pair![1]), Number(pair![2])] as [number, number]), ...legend };
  }
  return { kind: "plot", ...(plot.xlabel.trim() ? { xlabel: labelText(plot.xlabel) } : {}), ...(plot.ylabel.trim() ? { ylabel: labelText(plot.ylabel) } : {}),
    ...(plot.grid ? { grid: true } : {}), ...(plot.xlog ? { xlog: true } : {}), ...(plot.ylog ? { ylog: true } : {}), series: [series] };
}

/** The parts of the code each form field owns; the settings line is always rewritten. Width and Height own none: they change the preview and the line to write in main.tex. */
const plotParts: Record<string, CodePart[]> = {
  source: ["series"], sheet: ["series"], range: ["series"], expression: ["series"], domain: ["series"], points: ["series"], legend: ["series"],
  xlabel: ["axis:xlabel"], ylabel: ["axis:ylabel"], grid: ["axis:grid"], xlog: ["axis:xmode"], ylog: ["axis:ymode"],
};
const tableParts: Record<string, CodePart[]> = {
  source: ["columns", "head", "data"], sheet: ["columns", "head", "data"], range: ["columns", "head", "data"], header: ["head", "data"], smart: ["head", "data"], align: ["columns"],
};
export function partsFor(kind: GeneratorKind, field: string): CodePart[] {
  return (kind === "plot" ? plotParts : tableParts)[field] ?? [];
}

/** True when the settings read a data file, so only the desktop app can write their code. */
export function needsData(settings: GeneratorSettings): boolean {
  return settings.kind === "table" || settings.series.some(series => series.type === "data" || series.type === "range");
}
