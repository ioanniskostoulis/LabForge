// Licensed under the GNU General Public License v2 or later. See LICENSE.
// The preamble of main.tex: everything between the class line and the main writing section, where a report's
// settings (`\labforgesetup`) and its own commands live. No Node imports, so the renderer and the engine share it.

const classLine = /\\documentclass\s*(?:\[[^\]]*\])?\s*\{\.?labforge\}/;
const marker = /^[ \t]*%[ \t]*Main writing section\b/im;
const rule = /^[ \t]*%[ \t]*={8,}[ \t]*$/;

/** Where the preamble starts (the end of the class line) and ends (just before the rule above the main writing section, else before `\begin{document}`). `null` when main.tex has no class line. */
export function preambleRange(text: string): { from: number; to: number } | null {
  let from = -1;
  let offset = 0;
  for (const line of text.split("\n")) {
    const match = classLine.exec(line.replace(/(^|[^\\])%.*$/, "$1"));
    if (match) { from = offset + match.index + match[0].length; break; }
    offset += line.length + 1;
  }
  if (from < 0) return null;
  const lines = text.split("\n");
  const starts: number[] = [];
  let at = 0;
  for (const line of lines) { starts.push(at); at += line.length + 1; }
  let to = text.length;
  const begin = /^[ \t]*\\begin\{document\}/m.exec(text.slice(from));
  if (begin) to = from + begin.index;
  const section = marker.exec(text.slice(from));
  if (section) {
    const sectionLine = starts.findIndex((start, index) => start <= from + section.index && (index + 1 === starts.length || starts[index + 1] > from + section.index));
    to = sectionLine > 0 && rule.test(lines[sectionLine - 1]) ? starts[sectionLine - 1] : starts[sectionLine];
  }
  return to >= from ? { from, to } : { from, to: from };
}

/** The text of the preamble without the class line, or an empty string. */
export function preambleText(text: string): string {
  const range = preambleRange(text);
  return range ? text.slice(range.from, range.to) : "";
}

/** `text` with `block` (one or more whole lines) added at the end of the preamble, set off by a blank line each side. Returns `null` when main.tex has no class line. */
export function addToPreamble(text: string, block: string): { text: string; at: number } | null {
  const range = preambleRange(text);
  if (!range) return null;
  const before = text.slice(0, range.to).replace(/[ \t\n]*$/, "");
  const after = text.slice(range.to).replace(/^\n*/, "");
  const insert = `${before}\n\n${block.replace(/\n*$/, "")}\n\n`;
  return { text: `${insert}${after}`, at: before.length + 2 };
}
