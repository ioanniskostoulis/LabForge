// Licensed under the GNU General Public License v2 or later. See LICENSE.
// Patches the code in the Plots and Tables panes: an option rewrites only the lines it owns, so hand
// edits elsewhere in the code stay as written.

/** Parts of the code that form fields own. Axis parts are named by their pgfplots key. */
export type CodePart = "settings" | "series" | "columns" | "head" | "data" | `axis:${string}`;

/** Applies the owned parts of `fresh` (the code the form would write) to `current`. Code that lost the structure a part needs is replaced by `fresh`. */
export function patchCode(current: string, fresh: string, parts: Iterable<CodePart>): string {
  if (!current.trim()) return fresh;
  let code = current;
  for (const part of parts) {
    const next = patchPart(code, fresh, part);
    if (next === null) return fresh;
    code = next;
  }
  return code;
}

function patchPart(code: string, fresh: string, part: CodePart): string | null {
  if (part === "settings") {
    const line = fresh.split("\n")[0];
    const lines = code.split("\n");
    if (lines[0].startsWith("% labforge ")) lines[0] = line; else lines.unshift(line);
    return lines.join("\n");
  }
  if (part.startsWith("axis:")) return setAxisOption(code, part.slice(5), axisEntries(fresh)?.find(entry => optionKey(entry) === part.slice(5)) ?? null);
  if (part === "series") return patchSeries(code, fresh);
  if (part === "columns") return patchColumns(code, fresh);
  if (part === "head") return patchHead(code, fresh);
  if (part === "data") return patchTableData(code, fresh);
  return code;
}

const isCode = (line: string) => !line.trimStart().startsWith("%");
/** The line that sets a table's columns: `\begin{labtable}{…}`, or `\tablecolumns{…}` in older files. */
const isColumnsLine = (line: string) => line.startsWith("\\begin{labtable}") || line.startsWith("\\tablecolumns");

/** Sets the column letters in the columns line, keeping its form (`\begin{labtable}` or an older `\tablecolumns`). */
function patchColumns(code: string, fresh: string): string | null {
  const lines = code.split("\n");
  const index = lines.findIndex(line => isCode(line) && isColumnsLine(line.trim()));
  const spec = /\{([^{}]*)\}\s*$/.exec(fresh.split("\n").find(line => isCode(line) && isColumnsLine(line.trim())) ?? "")?.[1];
  if (index < 0 || spec === undefined) return null;
  lines[index] = lines[index].replace(/\{[^{}]*\}(\s*)$/, `{${spec}}$1`);
  return lines.join("\n");
}

function patchHead(code: string, fresh: string): string | null {
  const lines = code.split("\n");
  const head = (line: string) => isCode(line) && line.trim().startsWith("\\tablehead");
  const index = lines.findIndex(head);
  const replacement = fresh.split("\n").find(head);
  if (index >= 0) { if (replacement === undefined) lines.splice(index, 1); else lines[index] = replacement; return lines.join("\n"); }
  if (replacement === undefined) return code;
  const columns = lines.findIndex(line => isCode(line) && isColumnsLine(line.trim()));
  if (columns < 0) return null;
  lines.splice(columns + 1, 0, replacement);
  return lines.join("\n");
}

function dataBounds(lines: string[]): [number, number] | null {
  const start = lines.findIndex(line => /^\s*% data:/.test(line));
  const stop = lines.findIndex((line, index) => index > start && line.trim() === "% end of data");
  return start < 0 || stop < 0 ? null : [start, stop];
}
function patchTableData(code: string, fresh: string): string | null {
  const lines = code.split("\n"), freshLines = fresh.split("\n");
  const here = dataBounds(lines), there = dataBounds(freshLines);
  if (!here || !there) return null;
  lines.splice(here[0], here[1] - here[0] + 1, ...freshLines.slice(there[0], there[1] + 1));
  return lines.join("\n");
}

/** Lines [first, last] of the first `\addplot` statement, which ends at a `;` outside braces and brackets. */
export function firstStatement(lines: string[]): [number, number] | null {
  const first = lines.findIndex(line => isCode(line) && /^\s*\\addplot/.test(line));
  if (first < 0) return null;
  let depth = 0;
  for (let index = first; index < lines.length; index++) {
    const line = lines[index];
    for (let at = 0; at < line.length; at++) {
      const char = line[at];
      if (char === "\\") { at++; continue; }
      if (char === "%") break;
      if (char === "{" || char === "[") depth++;
      else if (char === "}" || char === "]") depth--;
      else if (char === ";" && depth <= 0) return [first, index];
    }
  }
  return null;
}

/** The plot's series: from the first `\addplot` statement to the line before `\end{axis}`, legend entries included. */
function seriesRegion(lines: string[]): [number, number] | null {
  const first = firstStatement(lines);
  const end = lines.findIndex(line => isCode(line) && /^\s*\\end\{axis\}/.test(line));
  if (end < 0) return null;
  return [first ? first[0] : end, end];
}

/** Replaces the series written from the options (a function, typed points, or one series per range column) with the fresh ones. */
function patchSeries(code: string, fresh: string): string | null {
  const lines = code.split("\n"), freshLines = fresh.split("\n");
  const here = seriesRegion(lines), there = seriesRegion(freshLines);
  if (!here || !there || there[0] === there[1]) return null;
  lines.splice(here[0], here[1] - here[0], ...freshLines.slice(there[0], there[1]));
  return lines.join("\n");
}

type AxisBlock = { start: number; end: number; indent: string; items: string[] };

/** The `\begin{axis}` block: its first and last line and its options, one entry or comment per item. */
function axisBlock(lines: string[]): AxisBlock | null {
  const start = lines.findIndex(line => isCode(line) && /^\s*\\begin\{axis\}/.test(line));
  if (start < 0) return null;
  const indent = /^\s*/.exec(lines[start])![0];
  const head = lines[start].trim().slice("\\begin{axis}".length);
  if (!head.startsWith("[")) return head.trim() ? null : { start, end: start, indent, items: [] };
  let depth = 0, text = "";
  for (let index = start; index < lines.length; index++) {
    const line = index === start ? head : lines[index];
    for (let at = 0; at < line.length; at++) {
      const char = line[at];
      if (char === "%" && line[at - 1] !== "\\") { text += line.slice(at) + "\n"; break; }
      if (char === "[" || char === "{") depth++;
      if (char === "]" || char === "}") depth--;
      if (depth === 0 && char === "]") {
        if (line.slice(at + 1).trim()) return null;
        return { start, end: index, indent, items: splitOptions(text.slice(1)) };
      }
      text += char;
    }
    if (!text.endsWith("\n")) text += "\n";
  }
  return null;
}

/** Splits option text into entries at top-level commas; comment lines stay whole. */
function splitOptions(text: string): string[] {
  const items: string[] = [];
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith("%")) { items.push(trimmed); continue; }
    let depth = 0, entry = "";
    for (const char of trimmed) {
      if (char === "{" || char === "[") depth++;
      if (char === "}" || char === "]") depth--;
      if (char === "," && depth === 0) { if (entry.trim()) items.push(entry.trim()); entry = ""; continue; }
      entry += char;
    }
    if (entry.trim()) items.push(entry.trim());
  }
  return items;
}

const optionKey = (entry: string) => entry.split("=")[0].trim();
const axisOrder = ["xlabel", "ylabel", "grid", "xmode", "ymode"];

function axisEntries(code: string): string[] | null {
  const block = axisBlock(code.split("\n"));
  return block ? block.items.filter(item => !item.startsWith("%")) : null;
}

function renderAxis(block: AxisBlock): string[] {
  if (!block.items.length) return [`${block.indent}\\begin{axis}`];
  // \begin{axis} sits one indent step in, so its options sit one more step in.
  const step = block.indent || "  ";
  return [`${block.indent}\\begin{axis}[`, ...block.items.map(item => `${block.indent}${step}${item}${item.startsWith("%") ? "" : ","}`), `${block.indent}]`];
}

/** Sets, replaces or removes (`entry` null) the axis option with this key. */
export function setAxisOption(code: string, key: string, entry: string | null): string | null {
  const lines = code.split("\n");
  const block = axisBlock(lines);
  if (!block) return null;
  const index = block.items.findIndex(item => !item.startsWith("%") && optionKey(item) === key);
  if (index >= 0) { if (entry === null) block.items.splice(index, 1); else block.items[index] = entry; }
  else if (entry !== null) {
    const rank = axisOrder.indexOf(key);
    let at = 0;
    block.items.forEach((item, position) => { const other = axisOrder.indexOf(optionKey(item)); if (!item.startsWith("%") && other >= 0 && other < rank) at = position + 1; });
    block.items.splice(at, 0, entry);
  } else return code;
  lines.splice(block.start, block.end - block.start + 1, ...renderAxis(block));
  return lines.join("\n");
}
