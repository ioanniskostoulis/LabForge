// Licensed under the GNU General Public License v2 or later. See LICENSE.
// Table and plot writers for the report class, the first-line settings comment and the data blocks
// that regenerate replaces. No Node imports, so the renderer can bundle it for the code column.

export type TableSettings = { kind: "table"; source: string; sheet?: string; range: string; header: boolean; columns?: string; /** Smart formatting: `true`, or the older per-kind flags (any of them turns it on). */ smart?: boolean | { general?: boolean; chemistry?: boolean; units?: boolean }; hash?: string };
export type PlotSeries =
  | { type: "data"; source: string; sheet?: string; x: string; y: string; legend?: string; style?: string; hash?: string }
  /** A spreadsheet range: its first column is x, each further column a series. `legends` replace the header names. */
  | { type: "range"; source: string; sheet?: string; range: string; legends?: string[]; style?: string; hash?: string }
  | { type: "function"; expression: string; domain: string; samples?: number; legend?: string; style?: string }
  | { type: "points"; points: [number, number][]; legend?: string; style?: string };
export type PlotSettings = { kind: "plot"; xlabel?: string; ylabel?: string; grid?: boolean; xlog?: boolean; ylog?: boolean; options?: string; series: PlotSeries[] };
export type GeneratorSettings = TableSettings | PlotSettings;

const marker = "% labforge ";

/** A table's columns, `l`, `c` or `r` each with an optional relative width in brackets (`l[0.6] c c[2]`, `lcr`), as one entry per column; `null` when the text is not that. */
export function tableColumns(text: string): string[] | null {
  const spec = text.replace(/\s+/g, "");
  if (!/^(?:[lcr](?:\[\d*\.?\d+\])?)+$/.test(spec)) return null;
  return spec.match(/[lcr](?:\[[^\]]*\])?/g)!.map(column => column.replace(/\[0*(\d)/, "[$1").replace(/\[\./, "[0."));
}

/** The first line of a generated file: its kind and settings as JSON. */
export function settingsComment(settings: GeneratorSettings): string { return `${marker}${settings.kind} ${JSON.stringify(settings)}`; }

/** Reads the settings comment from a generated file, or `null` when the file has none. */
export function readSettings(text: string): GeneratorSettings | null {
  const first = text.split(/\r?\n/, 1)[0] ?? "";
  const match = /^% labforge (table|plot) (\{.*\})\s*$/.exec(first);
  if (!match) return null;
  try { const value = JSON.parse(match[2]) as GeneratorSettings; return value.kind === match[1] ? value : null; } catch { return null; }
}

const begin = (index?: number) => `% data${index ? ` ${index}` : ""}`;
const end = (index?: number) => `% end of data${index ? ` ${index}` : ""}`;

/** A table in the class's `labtable` environment: its columns, an optional header and rows padded so the columns line up, indented in steps of four spaces. */
export function writeTable(settings: TableSettings, cells: string[][], aligns: string[]): string {
  const [comment, columns, ...body] = writeTableLines(settings, cells, aligns).split("\n");
  while (body.length && !body[body.length - 1].trim()) body.pop();
  return [comment, `\\begin{labtable}{${/\{([^}]*)\}/.exec(columns)![1]}}`, ...body.map(line => `    ${line}`), "\\end{labtable}", ""].join("\n");
}

function writeTableLines(settings: TableSettings, cells: string[][], aligns: string[]): string {
  const widths = aligns.map((_, col) => Math.max(0, ...cells.map(row => (row[col] ?? "").length)));
  const line = (row: string[]) => row.map((cell, col) => (cell ?? "").padEnd(widths[col])).join(" & ").trimEnd();
  const head = settings.header ? cells[0] : undefined; const body = settings.header ? cells.slice(1) : cells;
  return [settingsComment(settings), `\\tablecolumns{${settings.columns ?? aligns.join(" ")}}`, ...(head ? [`\\tablehead{${line(head)}}`] : []),
    `${begin()}: ${settings.source}${settings.sheet ? `, ${settings.sheet}` : ""}, ${settings.range}`, ...tableRows(body, line), end(), ""].join("\n");
}
function tableRows(rows: string[][], line: (row: string[]) => string): string[] { return rows.map(row => `${line(row)} \\\\`); }

const coordinates = (points: [number, number][]) => points.map(([x, y]) => `      (${x},${y})`);

/** The axis options a plot's settings write, one `key=value` per entry, in a fixed order. */
export function plotAxisOptions(settings: PlotSettings): string[] {
  return [settings.xlabel && `xlabel={${settings.xlabel}}`, settings.ylabel && `ylabel={${settings.ylabel}}`, settings.grid && "grid=major",
    settings.xlog && "xmode=log", settings.ylog && "ymode=log", settings.options].filter((entry): entry is string => !!entry);
}

/** `\begin{axis}` with its options one per line, or bare when there are none. */
export function axisLines(options: string[]): string[] {
  return options.length ? ["  \\begin{axis}[", ...options.map(option => `    ${option},`), "  ]"] : ["  \\begin{axis}"];
}

/** Column letters, such as B for 1 and AA for 26. */
export function columnLetters(index: number): string {
  let letters = "";
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) letters = String.fromCharCode(65 + ((n - 1) % 26)) + letters;
  return letters;
}

/** The indent step of generated code: the leading spaces of its first indented line (`\begin{axis}`, or a table's header or first row), or none for a table written flat. */
export function indentUnitOf(code: string): string {
  return /^( +)\S/m.exec(code)?.[1] ?? "";
}

/** Re-indents code written in steps of `from` into steps of `to`; lines that are not on a step keep their spaces. */
export function reindent(code: string, to: string, from = indentUnitOf(code)): string {
  if (to === from || !from) return code;
  return code.split("\n").map(line => {
    const spaces = /^ */.exec(line)![0].length;
    return spaces && spaces % from.length === 0 ? to.repeat(spaces / from.length) + line.slice(spaces) : line;
  }).join("\n");
}

/** A pgfplots picture for `\myplot`; spreadsheet series take their points from `data`, one array per data block in order, and a range's header names from `names`. Indented in steps of four spaces, the editor's default tab size. */
export function writePlot(settings: PlotSettings, data: [number, number][][] = [], names: (string | undefined)[] = []): string {
  return reindent(writePlotLines(settings, data, names), "    ", "  ");
}

function writePlotLines(settings: PlotSettings, data: [number, number][][], names: (string | undefined)[]): string {
  const lines = [settingsComment(settings), "\\begin{tikzpicture}", ...axisLines(plotAxisOptions(settings))];
  let dataIndex = 0;
  settings.series.forEach(series => {
    if (series.type === "range") {
      // One series per column after the first; the range's own columns name each block.
      const start = /^([A-Za-z]+)\d+:([A-Za-z]+)\d+$/.exec(series.range);
      const first = start ? [...start[1].toUpperCase()].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1 : 0;
      const last = start ? [...start[2].toUpperCase()].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1 : 1;
      for (let column = first + 1; column <= last; column++) {
        dataIndex++;
        lines.push(`    \\addplot[${series.style ?? "mark=*"}] coordinates {`,
          `      ${begin(dataIndex)}: ${series.source}${series.sheet ? `, ${series.sheet}` : ""}, ${series.range}, column ${columnLetters(column)}`,
          ...coordinates(data[dataIndex - 1] ?? []), `      ${end(dataIndex)}`, "    };");
        const legend = series.legends?.[column - first - 1] ?? names[dataIndex - 1];
        if (legend) lines.push(`    \\addlegendentry{${legend}}`);
      }
      return;
    }
    if (series.type === "function") lines.push(`    \\addplot[${series.style ?? `domain=${series.domain}, samples=${series.samples ?? 100}`}] {${series.expression}};`);
    else {
      lines.push(`    \\addplot[${series.style ?? "mark=*"}] coordinates {`);
      if (series.type === "data") { dataIndex++; lines.push(`      ${begin(dataIndex)}: ${series.source}${series.sheet ? `, ${series.sheet}` : ""}, columns ${series.x} and ${series.y}`, ...coordinates(data[dataIndex - 1] ?? []), `      ${end(dataIndex)}`); }
      else lines.push(...coordinates(series.points));
      lines.push("    };");
    }
    if (series.legend) lines.push(`    \\addlegendentry{${series.legend}}`);
  });
  lines.push("  \\end{axis}", "\\end{tikzpicture}", "");
  return lines.join("\n");
}

function blockBounds(all: string[], index?: number): [number, number] {
  const start = all.findIndex(line => line.trim().startsWith(`${begin(index)}:`));
  const stop = all.findIndex((line, i) => i > start && line.trim() === end(index));
  if (start < 0 || stop < 0) throw new Error(`The data block${index ? ` ${index}` : ""} markers were removed; generate the file again from its source.`);
  return [start, stop];
}

/** The lines between a data block's markers; plots number their blocks from 1, tables have one without a number. */
export function readDataBlock(text: string, index?: number): string[] {
  const all = text.split("\n");
  const [start, stop] = blockBounds(all, index);
  return all.slice(start + 1, stop);
}

/** Replaces the lines between a data block's markers, keeping everything else the user wrote. */
export function replaceDataBlock(text: string, lines: string[], index?: number): string {
  const all = text.split("\n");
  const [start, stop] = blockBounds(all, index);
  return [...all.slice(0, start + 1), ...lines, ...all.slice(stop)].join("\n");
}

/** Replaces the settings comment on the first line. */
export function replaceSettings(text: string, settings: GeneratorSettings): string {
  const rest = readSettings(text) ? text.slice(text.indexOf("\n") + 1) : text;
  return `${settingsComment(settings)}\n${rest}`;
}

/** The next free automatic name: `plot_1.tex`, `table_2.tex` or `<data file>_plot_1.tex`. */
export function nextGeneratedName(existing: string[], kind: "plot" | "table", source?: string): string {
  const stem = source ? `${source.split("/").pop()!.replace(/\.[^.]+$/, "").trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_\-Ͱ-Ͽ]/g, "")}_` : "";
  const taken = new Set(existing.map(name => name.toLowerCase()));
  for (let n = 1; ; n++) if (!taken.has(`${stem}${kind}_${n}.tex`)) return `${stem}${kind}_${n}.tex`;
}

