// Licensed under the GNU General Public License v2 or later. See LICENSE.
// Terminal support for Plots and Tables: plot defaults in the preamble of main.tex, the `plot add` forms and
// finding a generated file by number or name. No desktop calls, so it is tested on its own.
import { addToPreamble, preambleRange, preambleText } from "../engine/preamble";
import { presetValues, readClassOptions } from "./document-class";
import type { PlotSeries, PlotSettings, TableSettings } from "../engine/generators";

export type GeneratedListing = { name: string; file: string; settings: PlotSettings | TableSettings | null; stale: boolean; missing: string[] };

/** The class's `plot-*` settings, written without the prefix in the Terminal. */
export const plotDefaults: readonly { key: string; initial: string; pattern: RegExp; hint: string }[] = [
  { key: "line-width", initial: "0.8pt", pattern: /^\d*\.?\d+(?:pt|mm|cm|in|em|ex)$/, hint: "a length such as 1pt" },
  { key: "axis-width", initial: "0.5pt", pattern: /^\d*\.?\d+(?:pt|mm|cm|in|em|ex)$/, hint: "a length such as 0.4pt" },
  { key: "tick-length", initial: "4pt", pattern: /^\d*\.?\d+(?:pt|mm|cm|in|em|ex)$/, hint: "a length such as 3pt" },
  { key: "minor-ticks", initial: "1", pattern: /^\d+$/, hint: "a whole number such as 4" },
  { key: "padding", initial: "0.06", pattern: /^\d*\.?\d+$/, hint: "a fraction such as 0.05" },
  { key: "balance", initial: "0.5", pattern: /^\d*\.?\d+$/, hint: "a fraction from 0 to 1" },
  { key: "mark-size", initial: "2pt", pattern: /^\d*\.?\d+(?:pt|mm|cm|in|em|ex)$/, hint: "a length such as 1.5pt" },
  { key: "grid", initial: "none", pattern: /^(?:none|major|both)$/, hint: "none, major or both" },
  { key: "colors", initial: "black", pattern: /^(?:black|color)$/, hint: "black or color" },
  { key: "legend", initial: "north west", pattern: /^(?:north|south)(?: (?:west|east))?$|^(?:west|east)$|^outer north east$/, hint: "a corner such as north east" },
];

const setupLine = /\\labforgesetup\s*\{([^{}]*)\}/g;

/** Plot defaults after the selected style, shared settings, and main.tex preamble, in that order. */
export function readPlotDefaults(mainTex: string, settings = ""): Map<string, { value: string; custom: boolean }> {
  const found = new Map<string, string>();
  const set = (text: string) => { for (const pair of text.split(",")) {
    const [key, ...value] = pair.split("=");
    const name = key.trim();
    if (name.startsWith("plot-") && value.length) found.set(name.slice(5), value.join("=").trim());
  } };
  set(presetValues(settings, readClassOptions(mainTex)?.preset ?? "default"));
  const overrides = `${settings}\n${preambleText(mainTex)}`.split("\n").map(line => line.replace(/(^|[^\\])%.*$/, "$1")).join("\n");
  for (const match of overrides.matchAll(setupLine)) set(match[1]);
  return new Map(plotDefaults.map(item => [item.key, found.has(item.key) ? { value: found.get(item.key)!, custom: true } : { value: item.initial, custom: false }]));
}

/** Sets one plot default in the preamble of main.tex: replaces the key where it is written, or adds a `\labforgesetup` line at the end of the preamble. `null` when main.tex has no class line. */
export function setPlotDefault(mainTex: string, key: string, value: string): string | null {
  const name = `plot-${key}`;
  const range = preambleRange(mainTex);
  if (!range) return null;
  const pattern = new RegExp(`(\\\\labforgesetup\\s*\\{[^{}]*?)(${name}\\s*=\\s*)([^,}]*)`);
  const preamble = mainTex.slice(range.from, range.to);
  const lines = preamble.split("\n");
  const index = lines.findIndex(line => !line.trimStart().startsWith("%") && pattern.test(line));
  if (index >= 0) { lines[index] = lines[index].replace(pattern, (_all, head, assign) => `${head}${assign}${value}`); return `${mainTex.slice(0, range.from)}${lines.join("\n")}${mainTex.slice(range.to)}`; }
  return addToPreamble(mainTex, `\\labforgesetup{${name} = ${value}}`)?.text ?? null;
}

const number = String.raw`[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?`;
const domainPattern = new RegExp(`^(${number}):(${number})$`);
const pointPattern = new RegExp(`^(${number}),(${number})$`);

/** Reads `plot add function|points|data …` into plot settings, or returns the problem. */
export function plotFromArguments(args: string[]): PlotSettings | string {
  const [form, ...rest] = args;
  let series: PlotSeries;
  if (form === "function") {
    const last = rest.at(-1) ?? "";
    const domain = domainPattern.test(last) && rest.length > 1 ? last : "0:10";
    const expression = (domain === last && rest.length > 1 ? rest.slice(0, -1) : rest).join(" ");
    if (!expression) return "Write the function in x, for example plot add function 0.2*x^2 0:5.";
    series = { type: "function", expression, domain };
  } else if (form === "points") {
    const points = rest.map(item => pointPattern.exec(item));
    if (points.length < 2 || points.some(item => !item)) return "Write two or more points as x,y separated by spaces, for example plot add points 0,0 1,2 2,3.";
    series = { type: "points", points: points.map(item => [Number(item![1]), Number(item![2])] as [number, number]) };
  } else if (form === "data") {
    const [file, range, ...sheet] = rest;
    if (!file || !/^[A-Za-z]{1,3}\d+:[A-Za-z]{1,3}\d+$/.test(range ?? "")) return "Write the data file and a range, x in its first column, for example plot add data results.xlsx A1:C20.";
    series = { type: "range", source: file, range: range.toUpperCase(), ...(sheet.length ? { sheet: sheet.join(" ") } : {}) };
  } else return "Use plot add function, plot add points or plot add data.";
  return { kind: "plot", series: [series] };
}

/** Reads `table add <file> <range> [<sheet>]` into table settings. */
export function tableFromArguments(args: string[]): TableSettings {
  const [file, range, ...sheet] = args;
  return { kind: "table", source: file, range: range.toUpperCase(), header: true, smart: true, ...(sheet.length ? { sheet: sheet.join(" ") } : {}) };
}

/** Finds a generated file by its number in the listing, its name, or its name without `.tex`. */
export function findGenerated(items: GeneratedListing[], value: string): GeneratedListing | undefined {
  if (/^\d+$/.test(value)) return items[Number(value) - 1];
  const name = value.replace(/^(?:plots|tables)\//, "").toLowerCase();
  return items.find(item => item.name.toLowerCase() === name || item.name.toLowerCase() === `${name}.tex`);
}

/** The comment beside a listed file: its state, then where its data comes from. */
export function listingComment(item: GeneratedListing): string {
  if (!item.settings) return "written by hand";
  if (item.missing.length) return `missing ${item.missing.join(", ")}`;
  const sources = item.settings.kind === "table" ? [item.settings.source] : item.settings.series.flatMap(series => series.type === "data" || series.type === "range" ? [series.source] : []);
  const from = sources.length ? sources.join(", ") : "no data file";
  return item.stale ? `out of date, ${from}` : from;
}
