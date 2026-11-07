// Licensed under the GNU General Public License v2 or later. See LICENSE.
// Generated plots and tables in a project folder: write them from their settings, list them with a
// stale flag, and regenerate their data blocks. A data file is a path relative to the folder the report file
// (the .lfg) lives in; older reports keep theirs inside the project's data/.
import * as fs from "node:fs";
import * as path from "node:path";
import { createHash } from "node:crypto";
import { nextGeneratedName, readDataBlock, readSettings, replaceDataBlock, replaceSettings, writePlot, writeTable, type GeneratorSettings, type PlotSettings, type TableSettings, indentUnitOf, reindent } from "./generators";
import { loadSpreadsheet, rangeSeries, seriesPoints, tableCells } from "./spreadsheets";
import { spreadsheetExtensions } from "./project-paths";

export type GeneratedKind = "plot" | "table";
export type GeneratedItem = { name: string; file: string; settings: GeneratorSettings | null; stale: boolean; missing: string[] };

const folders: Record<GeneratedKind, string> = { plot: "plots", table: "tables" };

/**
 * Where a data file is. A source is relative to `base`, the folder that holds the report file; one under `data/` that exists inside
 * the project (older reports) is read there. Without a base, such as in an unsaved report, only the project's data/ can be read.
 */
export function dataFile(root: string, source: string, base?: string): string {
  const inside = path.resolve(root, source);
  const data = path.resolve(root, "data");
  if (inside.startsWith(data + path.sep) && (fs.existsSync(inside) || !base)) return inside;
  if (!base) throw new Error(`${source} is read from the folder of the report file; save the report first.`);
  return path.resolve(base, source);
}
/** The spreadsheets in the folder that holds the report file, by name, hidden and lock files left out. */
export function listBeside(base: string | undefined): string[] {
  if (!base || !fs.existsSync(base)) return [];
  try {
    return fs.readdirSync(base, { withFileTypes: true }).filter(item => item.isFile() && !item.name.startsWith(".") && !item.name.startsWith("~$") && spreadsheetExtensions.includes(path.extname(item.name).toLowerCase()))
      .map(item => item.name).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }));
  } catch { return []; }
}
/** A short hash of a data file's bytes. The archive keeps no file dates, so a change is found by content. */
export function dataHash(root: string, source: string, base?: string): string | null {
  const file = dataFile(root, source, base);
  return fs.existsSync(file) ? createHash("sha256").update(fs.readFileSync(file)).digest("hex").slice(0, 12) : null;
}

/** Table code from its settings, with the data file's current hash in the settings comment. */
export function tableCode(root: string, settings: TableSettings, base?: string): string {
  const { cells, aligns } = tableCells(loadSpreadsheet(dataFile(root, settings.source, base)), settings.sheet, settings.range, settings.smart, settings.header);
  return writeTable({ ...settings, hash: dataHash(root, settings.source, base) ?? undefined }, cells, aligns);
}
/** Plot code from its settings; spreadsheet series read their columns now. */
export function plotCode(root: string, settings: PlotSettings, base?: string): string {
  const series = settings.series.map(item => item.type === "data" || item.type === "range" ? { ...item, hash: dataHash(root, item.source, base) ?? undefined } : item);
  const data: [number, number][][] = [], names: (string | undefined)[] = [];
  for (const item of series) {
    if (item.type === "data") { data.push(seriesPoints(loadSpreadsheet(dataFile(root, item.source, base)), item.sheet, item.x, item.y)); names.push(undefined); }
    else if (item.type === "range") { const read = rangeSeries(loadSpreadsheet(dataFile(root, item.source, base)), item.sheet, item.range); data.push(...read.columns); names.push(...read.names); }
  }
  return writePlot({ ...settings, series }, data, names);
}
export function generatedCode(root: string, settings: GeneratorSettings, base?: string): string {
  return settings.kind === "table" ? tableCode(root, settings, base) : plotCode(root, settings, base);
}

/** Writes new code under plots/ or tables/ with the next automatic name, and returns that name. */
export function saveGenerated(root: string, kind: GeneratedKind, code: string, source?: string): string {
  const folder = path.join(root, folders[kind]);
  fs.mkdirSync(folder, { recursive: true });
  const name = nextGeneratedName(fs.readdirSync(folder), kind, source);
  fs.writeFileSync(path.join(folder, name), code, "utf8");
  return name;
}

function sources(settings: GeneratorSettings): { source: string; hash?: string }[] {
  return settings.kind === "table" ? [settings] : settings.series.flatMap(item => item.type === "data" || item.type === "range" ? [item] : []);
}

/** The `.tex` files under plots/ or tables/, sorted by name, each with its settings when it has them. */
export function listGenerated(root: string, kind: GeneratedKind, base?: string): GeneratedItem[] {
  const folder = path.join(root, folders[kind]);
  if (!fs.existsSync(folder)) return [];
  return fs.readdirSync(folder).filter(name => name.toLowerCase().endsWith(".tex")).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })).map(name => {
    const file = `${folders[kind]}/${name}`;
    const settings = readSettings(fs.readFileSync(path.join(root, file), "utf8"));
    const missing: string[] = [];
    let stale = false;
    if (settings?.kind === kind) for (const item of sources(settings)) {
      let hash: string | null = null;
      try { hash = dataHash(root, item.source, base); } catch { /* a source that cannot be resolved counts as missing */ }
      if (hash === null) missing.push(item.source);
      else if (hash !== item.hash) stale = true;
    }
    return { name, file, settings: settings?.kind === kind ? settings : null, stale, missing };
  });
}

/** Rewrites the data blocks of a generated file from its data files and keeps every other line. Returns false when nothing changed. */
export function regenerate(root: string, file: string, base?: string): boolean {
  const full = path.resolve(root, file);
  const text = fs.readFileSync(full, "utf8");
  const settings = readSettings(text);
  if (!settings) throw new Error(`${file} has no LabForge settings line, so it cannot be regenerated.`);
  // Fresh code follows the file's own indent, so the data lines line up with the rest.
  const fresh = reindent(generatedCode(root, settings, base), indentUnitOf(text));
  let next = replaceSettings(text, readSettings(fresh)!);
  if (settings.kind === "table") next = replaceDataBlock(next, readDataBlock(fresh));
  // Every numbered data block the fresh code has: one per spreadsheet series or range column.
  else for (const match of fresh.matchAll(/^\s*% data (\d+):/gm)) next = replaceDataBlock(next, readDataBlock(fresh, Number(match[1])), Number(match[1]));
  if (next === text) return false;
  fs.writeFileSync(full, next, "utf8");
  return true;
}
