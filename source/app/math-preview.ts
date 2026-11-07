// Licensed under the GNU General Public License v2 or later. See LICENSE.
// Finds the math expression enclosing the cursor without compiling the report.

import { displayMathEnvironments } from "./source-reader";

export interface MathPreviewRange { from: number; to: number; tex: string }


/** Replace comments with spaces so their delimiters cannot start or end a preview, and the preview shows no comment text. */
function withoutComments(source: string): string {
  const chars = source.split("");
  for (let at = 0; at < chars.length; at++) {
    if (chars[at] !== "%") continue;
    let slashes = 0;
    for (let before = at - 1; before >= 0 && chars[before] === "\\"; before--) slashes++;
    if (slashes % 2) continue;
    while (at < chars.length && chars[at] !== "\n") chars[at++] = " ";
  }
  return chars.join("");
}

function closingBrace(source: string, open: number): number {
  let depth = 0;
  for (let at = open; at < source.length; at++) {
    if (source[at] === "\\") { at++; continue; }
    if (source[at] === "{") depth++;
    if (source[at] === "}" && --depth === 0) return at;
  }
  return -1;
}

/** Return at most one expression. Large documents are scanned only near the cursor. */
export function mathAtCursor(text: string, cursor: number): MathPreviewRange | null {
  if (cursor < 0 || cursor > text.length) return null;
  const start = Math.max(0, cursor - 8192), end = Math.min(text.length, cursor + 8192);
  const source = text.slice(start, end), masked = withoutComments(source), at = cursor - start;
  const ranges: MathPreviewRange[] = [];
  for (const match of masked.matchAll(/\\(myformula|myequation)(?:\[[^\]\n]*\])?\s*\{/g)) {
    const from = match.index + match[0].length, close = closingBrace(masked, from - 1), to = close < 0 ? at : close;
    if (from <= at && at <= to && to - from <= 4000) {
      let tex = masked.slice(from, to).trim();
      if ((tex.includes("&") || tex.includes("\\\\")) && !/^\\begin\{(?:align|aligned|alignedat|gather|gathered|split)/.test(tex)) tex = `\\begin{aligned}${tex}\\end{aligned}`;
      ranges.push({ from: start + from, to: start + to, tex });
    }
  }
  for (const match of masked.matchAll(/\\begin\{([a-zA-Z*]+)\}/g)) {
    const name = match[1];
    // Inner environments such as aligned or cases are shown with the math around them.
    if (!displayMathEnvironments.has(name)) continue;
    const from = match.index + match[0].length, token = new RegExp(`\\\\(?:begin|end)\\{${name.replaceAll("*", "\\*")}\\}`, "g");
    token.lastIndex = from;
    let depth = 1, to = -1;
    for (let next; (next = token.exec(masked));) {
      depth += next[0].startsWith("\\begin") ? 1 : -1;
      if (!depth) { to = next.index; break; }
    }
    if (to < 0) to = at;
    if (from <= at && at <= to && to - match.index <= 4000)
      ranges.push({ from: start + from, to: start + to, tex: masked.slice(match.index, to) + `\\end{${name}}` });
  }
  const delimiters: { open: string; from: number; start: number }[] = [];
  for (let i = 0; i < masked.length; i++) {
    if (masked[i] === "\\" && (masked[i + 1] === "(" || masked[i + 1] === "[")) {
      delimiters.push({ open: masked[i + 1], from: i + 2, start: i }); i++; continue;
    }
    if (masked[i] === "\\" && (masked[i + 1] === ")" || masked[i + 1] === "]")) {
      const open = masked[i + 1] === ")" ? "(" : "[";
      const last = delimiters.at(-1);
      if (last?.open === open) {
        delimiters.pop();
        if (last.from <= at && at <= i && i - last.from <= 4000) ranges.push({ from: start + last.from, to: start + i, tex: masked.slice(last.from, i) });
      }
      i++; continue;
    }
    if (masked[i] === "$" && masked[i - 1] !== "\\") {
      const display = masked[i + 1] === "$", open = display ? "$$" : "$", last = delimiters.at(-1);
      if (last?.open === open) {
        delimiters.pop();
        if (last.from <= at && at <= i && i - last.from <= 4000) ranges.push({ from: start + last.from, to: start + i, tex: masked.slice(last.from, i) });
      } else delimiters.push({ open, from: i + open.length, start: i });
      if (display) i++;
    }
  }
  for (const last of delimiters) {
    if (last.from <= at && at - last.from <= 4000)
      ranges.push({ from: start + last.from, to: cursor, tex: masked.slice(last.from, at) });
  }
  return ranges.sort((a, b) => a.from - b.from)[0] ?? null;
}
