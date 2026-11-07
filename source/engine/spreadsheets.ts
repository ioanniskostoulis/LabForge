import * as fs from "node:fs";
import * as path from "node:path";
import * as XLSX from "xlsx";
import { parseRange } from "./ranges";
import { spreadsheetExtensions } from "./project-paths";
import { escapeTex, formatCells, smartOn, type SmartSetting } from "./smart-formatting";

XLSX.set_fs(fs);

export const EXTENSIONS = spreadsheetExtensions;
export type InputFile = { name: string; path: string; size: number; sheets: string[] };
type Workbook = XLSX.WorkBook;
const cache = new Map<string, { key: string; book: Workbook }>();

/** A CSV file is read as UTF-8 when its bytes are UTF-8, with or without a byte order mark; SheetJS alone reads one without a mark as Latin-1, so Greek text came out garbled. Other files keep SheetJS's reading. */
function readCsv(file: string, options: XLSX.ParsingOptions): Workbook {
  const bytes = fs.readFileSync(file);
  let text: string;
  try { text = new TextDecoder("utf-8", { fatal: true }).decode(bytes); } catch { return XLSX.readFile(file, options); }
  return XLSX.read(text, { ...options, type: "string" });
}

function loadBook(file: string): Workbook {
  const stat = fs.statSync(file);
  const key = `${stat.size}:${stat.mtimeMs}`;
  const cached = cache.get(file);
  if (cached?.key === key) return cached.book;
  const options: XLSX.ParsingOptions = { cellNF: true, cellStyles: true, cellDates: true, raw: false };
  const book = path.extname(file).toLowerCase() === ".csv" ? readCsv(file, options) : XLSX.readFile(file, options);
  cache.set(file, { key, book });
  if (cache.size > 4) cache.delete(cache.keys().next().value!);
  return book;
}

export function listInputs(dataDir: string): InputFile[] {
  if (!fs.existsSync(dataDir)) return [];
  const found: InputFile[] = [];
  const walk = (dir: string) => {
    for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
      if (item.name.startsWith(".") || item.name.startsWith("~$") || item.name.endsWith("~lock~")) continue;
      const full = path.join(dir, item.name);
      if (item.isDirectory()) walk(full);
      else if (item.isFile() && EXTENSIONS.includes(path.extname(item.name).toLowerCase())) {
        const stat = fs.statSync(full);
        found.push({ name: path.relative(dataDir, full).split(path.sep).join("/"), path: full, size: stat.size, sheets: [] });
      }
    }
  };
  walk(dataDir);
  return found.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
}

export function loadSpreadsheet(file: string): Workbook {
  if (!EXTENSIONS.includes(path.extname(file).toLowerCase())) throw new Error(`${path.basename(file)} is not a spreadsheet LabForge reads (${EXTENSIONS.join(", ")}).`);
  if (!fs.existsSync(file)) throw new Error(`${path.basename(file)} was not found.`);
  return loadBook(file);
}

/** Sheet names of a workbook; a CSV file has none to choose from. */
export function sheetNames(file: string): string[] {
  return path.extname(file).toLowerCase() === ".csv" ? [] : loadSpreadsheet(file).SheetNames;
}

function chooseSheet(book: Workbook, sheetName?: string): XLSX.WorkSheet {
  const sheet = book.Sheets[sheetName || book.SheetNames[0]];
  if (!sheet) throw new Error(`Sheet not found: ${sheetName}.`);
  return sheet;
}

type CellData = { raw: string; align: string; span?: [number, number]; skip?: boolean };
function cellText(cell: XLSX.CellObject | undefined): string {
  if (!cell || cell.v == null) return "";
  if (cell.w != null) return String(cell.w);
  if (cell.v instanceof Date) return cell.v.toISOString().slice(0, 10);
  return String(cell.v);
}

function makeGrid(sheet: XLSX.WorkSheet, selection?: string): CellData[][] {
  const bounds = selection ? parseRange(selection) : (() => {
    const range = XLSX.utils.decode_range(sheet["!ref"] || "A1");
    return { r1: range.s.r, c1: range.s.c, r2: range.e.r, c2: range.e.c };
  })();
  if ((bounds.r2 - bounds.r1 + 1) * (bounds.c2 - bounds.c1 + 1) > 100_000) throw new Error("Selected range is too large (100,000 cells maximum).");
  const merges = sheet["!merges"] || [];
  const grid: CellData[][] = [];
  for (let row = bounds.r1; row <= bounds.r2; row++) {
    const cells: CellData[] = [];
    for (let col = bounds.c1; col <= bounds.c2; col++) {
      const merged = merges.find(m => row >= m.s.r && row <= m.e.r && col >= m.s.c && col <= m.e.c);
      if (merged && (row !== merged.s.r || col !== merged.s.c)) { cells.push({ raw: "", align: "l", skip: true }); continue; }
      const cell = sheet[XLSX.utils.encode_cell({ r: row, c: col })] as XLSX.CellObject | undefined;
      const horizontal = (cell?.s as { alignment?: { horizontal?: string } } | undefined)?.alignment?.horizontal;
      const align = horizontal === "center" || horizontal === "fill" || horizontal === "distributed" ? "c" : horizontal === "right" ? "r" : cell?.t === "n" ? "r" : "l";
      const span = merged ? [Math.min(merged.e.r, bounds.r2) - row + 1, Math.min(merged.e.c, bounds.c2) - col + 1] as [number, number] : undefined;
      cells.push({ raw: cellText(cell), align, span });
    }
    grid.push(cells);
  }
  return grid;
}

export type TableCells = { cells: string[][]; aligns: string[] };

/** Cells of a range, written as TeX, and one alignment per column (the most common one in it). Merged cells keep their text in the first cell. With smart formatting, the first row is read as headers when `header` is on. */
export function tableCells(book: Workbook, sheetName: string | undefined, selection?: string, smart?: SmartSetting, header = false): TableCells {
  const source = makeGrid(chooseSheet(book, sheetName), selection);
  // A range drawn past the data (A1:C10 over three rows) would add blank rows; trailing empty rows are left out.
  while (source.length > 1 && source[source.length - 1].every(cell => !cell.raw.trim())) source.pop();
  // The same for trailing empty columns (A1:C10 over two columns of data).
  while (source[0].length > 1 && source.every(row => !row[row.length - 1].raw.trim() && !row[row.length - 1].skip)) for (const row of source) row.pop();
  if (!source.length || !source[0]?.length || source.every(row => row.every(cell => !cell.raw))) throw new Error("The selected range is empty.");
  const cells = formatCells(source.map(row => row.map(cell => cell.skip ? "" : cell.raw)), smartOn(smart), header);
  const aligns = Array.from({ length: cells[0].length }, (_, col) => {
    const counts = new Map<string, number>();
    for (const row of source) if (row[col].raw) counts.set(row[col].align, (counts.get(row[col].align) ?? 0) + 1);
    return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] || "c";
  });
  return { cells, aligns };
}

/** The series of a range: its first column is x and each further column a series of (x, y) pairs. A first row whose cells after the first are not all numbers names the series. */
export function rangeSeries(book: Workbook, sheetName: string | undefined, selection: string): { names: (string | undefined)[]; columns: [number, number][][] } {
  const sheet = chooseSheet(book, sheetName);
  const bounds = parseRange(selection);
  if (bounds.c2 <= bounds.c1) throw new Error(`The range ${selection} needs two or more columns: x, then one column per series.`);
  const value = (row: number, col: number) => sheet[XLSX.utils.encode_cell({ r: row, c: col })]?.v;
  const number = (raw: unknown) => raw === undefined || raw === null || raw === "" ? NaN : typeof raw === "number" ? raw : Number(raw);
  let firstRow = bounds.r1;
  const header: (string | undefined)[] = [];
  for (let col = bounds.c1 + 1; col <= bounds.c2; col++) header.push(value(bounds.r1, col) == null ? undefined : String(value(bounds.r1, col)).trim() || undefined);
  const named = header.some((text, i) => text !== undefined && !Number.isFinite(number(value(bounds.r1, bounds.c1 + 1 + i))));
  if (named) firstRow++;
  const columns: [number, number][][] = header.map(() => []);
  for (let row = firstRow; row <= bounds.r2 && row - firstRow < 5000; row++) {
    const x = number(value(row, bounds.c1));
    if (!Number.isFinite(x)) continue;
    for (let col = bounds.c1 + 1; col <= bounds.c2; col++) {
      const y = number(value(row, col));
      if (Number.isFinite(y)) columns[col - bounds.c1 - 1].push([x, y]);
    }
  }
  if (columns.every(points => points.length < 2)) throw new Error(`The range ${selection} needs at least two rows of numbers.`);
  // The names are data, so TeX's special characters in them are escaped, as in table cells.
  return { names: named ? header.map(name => name === undefined ? undefined : escapeTex(name)) : header.map(() => undefined), columns };
}

/** Numeric (x, y) pairs from two columns; rows without two numbers, such as a header, are skipped. */
export function seriesPoints(book: Workbook, sheetName: string | undefined, xColumn: string, yColumn: string): [number, number][] {
  const sheet = chooseSheet(book, sheetName);
  const column = (value: string) => {
    if (!/^[A-Za-z]{1,3}$/.test(value)) throw new Error(`"${value}" is not a column; use letters such as A and B.`);
    return XLSX.utils.decode_col(value.toUpperCase());
  };
  const x = column(xColumn), y = column(yColumn);
  const bounds = XLSX.utils.decode_range(sheet["!ref"] || "A1");
  const points: [number, number][] = [];
  for (let row = bounds.s.r; row <= bounds.e.r && points.length < 5000; row++) {
    const rawX = sheet[XLSX.utils.encode_cell({ r: row, c: x })]?.v;
    const rawY = sheet[XLSX.utils.encode_cell({ r: row, c: y })]?.v;
    const nx = typeof rawX === "number" ? rawX : Number(rawX);
    const ny = typeof rawY === "number" ? rawY : Number(rawY);
    if (rawX != null && rawY != null && rawX !== "" && rawY !== "" && Number.isFinite(nx) && Number.isFinite(ny)) points.push([nx, ny]);
  }
  if (points.length < 2) throw new Error(`Columns ${xColumn} and ${yColumn} need at least two rows of numbers.`);
  return points;
}
