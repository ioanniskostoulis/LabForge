// Licensed under the GNU General Public License v2 or later. See LICENSE.
// Finds mistakes in LaTeX source that can be told from the text alone: braces that do not pair, \begin and
// \end that do not match, a math delimiter that is never closed, and \my… commands that do not exist.
// Comments, \verb and verbatim environments are skipped. Offsets are into the text given.

import { codeEnvironments } from "./source-reader";

export type TexProblem = { from: number; to: number; message: string };

/** Commands that define other commands, so a \my… name that follows them is the report's own. */
const definition = /\\(?:newcommand|renewcommand|providecommand|DeclareSIUnit|DeclareMathOperator|DeclareRobustCommand|NewDocumentCommand|RenewDocumentCommand|ProvideDocumentCommand|NewCommandCopy|newlength|newcounter|newtoks|newdimen|newcount|newbox|newsavebox|def|edef|gdef|xdef|let|newif)\*?\s*\{?\s*\\([a-zA-Z@]+)/g;
/** Names a counter or a switch brings with it: \newcounter{n} makes \thensss, \newif\ifx makes \xtrue and \xfalse. */
const generated = /\\(?:newcounter|newboolean)\s*\{([a-zA-Z]+)\}/g;

export type TexLintOptions = {
  /** True when a command name (without its backslash) is one the report can use. Only names starting with `my` are checked. */
  isKnownCommand?: (name: string) => boolean;
  /** True when a command name (without its backslash) exists in a report. Names not starting with `my` are checked only when this is given and the text loads no packages of its own. */
  isLatexCommand?: (name: string) => boolean;
  /** A list of known names to suggest a correction from. */
  suggestFrom?: () => Iterable<string>;
  /** The keys a command takes in square brackets, by name with its `*` when it has one; undefined when it takes none or is not checked. */
  commandKeys?: (name: string) => readonly string[] | undefined;
  /** The values a key is limited to, such as the places of a block; undefined when any value is allowed. */
  keyValues?: (key: string) => readonly string[] | undefined;
  /** What the braces after a command hold ("file", "title"), or undefined when the command takes no braces. */
  commandArgument?: (name: string) => string | undefined;
  /** Paths currently held by the report, for file-taking commands. Omit for a source-only check. */
  projectFiles?: readonly string[];
};

/** A plain file argument and the project path that a command reads. Macro-built paths are left to TeX. */
function referencedFile(command: string, argument: string, files: readonly string[]): string | null {
  if (!argument || /[\\#{}]/.test(argument) || argument.includes("..")) return null;
  const folder = command === "myfigure" ? "graphics" : command === "myplot" ? "plots" : command === "mytable" ? "tables" : command === "input" ? "" : null;
  if (folder === null) return null;
  const base = folder ? `${folder}/${argument}` : argument;
  const choices = command === "myfigure" ? [base, ...[".png", ".jpg", ".jpeg", ".pdf", ".svg"].map(ext => base + ext)]
    : [base, `${base}.tex`];
  return choices.some(choice => files.includes(choice)) ? null : choices.at(-1)!;
}

/** The closest of `choices` to `word` when it is a likely misspelling, or undefined. */
function nearest(word: string, choices: readonly string[]): string | undefined {
  const distance = (a: string, b: string): number => {
    const row = Array.from({ length: b.length + 1 }, (_, index) => index);
    for (let x = 1; x <= a.length; x++) {
      let diagonal = row[0]; row[0] = x;
      for (let y = 1; y <= b.length; y++) {
        const above = row[y];
        row[y] = Math.min(row[y] + 1, row[y - 1] + 1, diagonal + (a[x - 1] === b[y - 1] ? 0 : 1));
        diagonal = above;
      }
    }
    return row[b.length];
  };
  let best: string | undefined; let bestDistance = 3;
  for (const choice of choices) { const d = distance(word.toLowerCase(), choice); if (d < bestDistance) { best = choice; bestDistance = d; } }
  return best;
}

/** The optional `[…]` after a command: where its keys are, or a problem when it never closes. Returns the offset after the argument. */
function checkKeys(text: string, start: number, command: string, keys: readonly string[], options: TexLintOptions, problems: TexProblem[]): number {
  let at = start;
  while (text[at] === " " || text[at] === "\t") at++;
  if (text[at] !== "[") return start;
  let depth = 0; let close = -1;
  for (let j = at + 1; j < text.length && j < at + 2000; j++) {
    const c = text[j];
    if (c === "\\") { j++; continue; }
    if (c === "{") depth++;
    else if (c === "}") depth--;
    else if (c === "]" && depth === 0) { close = j; break; }
    else if (c === "\n" && /^\n[ \t]*\n/.test(text.slice(j, j + 50))) break;
  }
  if (close < 0) {
    problems.push({ from: at, to: at + 1, message: `This [ after \\${command} is never closed. Add the closing ].` });
    return -1;
  }
  let partStart = at + 1; let braceDepth = 0;
  for (let j = at + 1; j <= close; j++) {
    const c = text[j];
    if (c === "\\") { j++; continue; }
    if (c === "{") braceDepth++;
    else if (c === "}") braceDepth--;
    if ((c === "," && braceDepth === 0) || j === close) {
      const part = text.slice(partStart, j);
      const lead = part.length - part.trimStart().length;
      const trimmed = part.trim();
      if (trimmed) {
        const equals = trimmed.indexOf("=");
        const key = (equals < 0 ? trimmed : trimmed.slice(0, equals)).trim();
        const from = partStart + lead;
        if (!keys.includes(key)) {
          const guess = nearest(key, keys);
          problems.push({ from, to: from + key.length, message: `${key} is not a key of \\${command}. ${guess ? `Did you mean ${guess}?` : `Keys: ${keys.join(", ")}.`}` });
        } else if (equals < 0) {
          problems.push({ from, to: from + key.length, message: `${key} needs a value. Write ${key}=<value>.` });
        } else {
          const allowed = options.keyValues?.(key);
          const value = trimmed.slice(equals + 1).trim();
          if (allowed && value && !allowed.includes(value)) {
            const valueFrom = from + trimmed.indexOf(value, equals + 1);
            problems.push({ from: valueFrom, to: valueFrom + value.length, message: `${value} is not a value of ${key}. Use ${allowed.join(", ")}.` });
          }
        }
      }
      partStart = j + 1;
    }
  }
  return close + 1;
}

/** The problems in `text`, in document order. */
export function checkTex(text: string, options: TexLintOptions = {}): TexProblem[] {
  const problems: TexProblem[] = [];
  const own = new Set<string>();
  for (const match of text.matchAll(definition)) {
    own.add(match[1]);
    if (/^if/.test(match[1])) { own.add(match[1].slice(2) + "true"); own.add(match[1].slice(2) + "false"); }
  }
  for (const match of text.matchAll(generated)) own.add("the" + match[1]);
  // Packages the report loads itself bring commands the list cannot know, so only the class's own are checked.
  const foreign = /^[^%\n]*\\(?:usepackage|RequirePackage|usetikzlibrary|input|include|import)\b/m.test(text);

  const braces: number[] = [];
  const environments: { name: string; from: number; to: number }[] = [];
  let inline = -1;
  let display = -1;
  const endParagraph = (): void => {
    if (inline >= 0) problems.push({ from: inline, to: inline + 1, message: "This $ is never closed. Add the closing $ before the blank line." });
    if (display >= 0) problems.push({ from: display, to: display + 2, message: "This $$ is never closed. Add the closing $$ before the blank line." });
    inline = display = -1;
  };

  const length = text.length;
  let i = 0;
  while (i < length) {
    const char = text[i];
    if (char === "%") {
      while (i < length && text[i] !== "\n") i++;
      continue;
    }
    if (char === "\n") {
      const blank = /^\n[ \t]*\n/.exec(text.slice(i, i + 200));
      if (blank) { endParagraph(); i += blank[0].length - 1; }
      i++;
      continue;
    }
    if (char === "\\") {
      const word = /^\\([a-zA-Z@]+)(\*?)/.exec(text.slice(i, i + 80));
      if (!word) { i += 2; continue; }   // \{, \}, \%, \$, \\ and the other one-character commands
      const name = word[1];
      const end = i + word[0].length;
      if (name === "verb") {
        const delimiter = text[end];
        const close = delimiter && delimiter !== "\n" ? text.indexOf(delimiter, end + 1) : -1;
        const closed = close >= 0 && !text.slice(end, close).includes("\n");
        if (delimiter && delimiter !== "\n" && !closed) problems.push({ from: i, to: end + 1, message: `This \\verb is never closed on its line. Add the closing ${delimiter}.` });
        i = closed ? close + 1 : end;
        continue;
      }
      if (name === "begin" || name === "end") {
        const argument = /^\s*\{([^{}\n]*)\}/.exec(text.slice(end, end + 120));
        if (argument) {
          const to = end + argument[0].length;
          const environment = argument[1].trim();
          if (name === "begin") {
            environments.push({ name: environment, from: i, to });
            if (codeEnvironments.has(environment)) {
              const close = text.indexOf(`\\end{${environment}}`, to);
              i = close >= 0 ? close : length;
              continue;
            }
          } else {
            const top = environments[environments.length - 1];
            if (top?.name === environment) environments.pop();
            else {
              const open = environments.map(item => item.name).lastIndexOf(environment);
              if (open >= 0) {
                for (const item of environments.splice(open + 1)) problems.push({ from: item.from, to: item.to, message: `\\begin{${item.name}} is never closed. Add \\end{${item.name}}.` });
                environments.pop();
              } else if (top) problems.push({ from: i, to, message: `\\end{${environment}} does not match \\begin{${top.name}}.` });
              else problems.push({ from: i, to, message: `\\end{${environment}} has no \\begin{${environment}}.` });
            }
          }
          i = to;
          continue;
        }
      }
      if (name.startsWith("my") && options.isKnownCommand && !own.has(name) && !options.isKnownCommand(name))
        problems.push({ from: i, to: end, message: `\\${name} is not a LabForge command. Check the spelling or define it with \\newcommand.` });
      else if (!name.startsWith("my") && options.isLatexCommand && !foreign && !own.has(name) && !options.isLatexCommand(name)) {
        const guess = options.suggestFrom ? nearest(name, [...options.suggestFrom()].filter(choice => Math.abs(choice.length - name.length) < 3 && choice[0] === name[0])) : undefined;
        problems.push({ from: i, to: end, message: `\\${name} is not a command LaTeX knows here. ${guess ? `Did you mean \\${guess}? ` : ""}Check the spelling or define it with \\newcommand.` });
      }
      const full = name + word[2];
      const keys = !own.has(name) ? options.commandKeys?.(full) : undefined;
      let after = end;
      if (keys && keys.length) after = checkKeys(text, end, full, keys, options, problems);
      else {
        // An optional argument that is not a key list, such as \myref[nom], is skipped.
        const optional = /^[ \t]*\[[^\]\n]*\]/.exec(text.slice(end, end + 200));
        if (optional) after = end + optional[0].length;
      }
      const argument = !own.has(name) && after >= 0 ? options.commandArgument?.(full) : undefined;
      if (argument) {
        let at = after;
        while (/[ \t\n]/.test(text[at] ?? "") && !/^\n[ \t]*\n/.test(text.slice(at, at + 50))) at++;
        if (text[at] !== "{") problems.push({ from: i, to: end, message: `\\${full} needs {${argument}} after it.` });
        else if (options.projectFiles && ["myfigure", "myplot", "mytable", "input"].includes(name)) {
          const close = text.indexOf("}", at + 1);
          if (close > at && !text.slice(at + 1, close).includes("\n")) {
            // \myfigure and \myplot take several files side by side; each is checked on its own.
            const parts = name === "myfigure" || name === "myplot" ? text.slice(at + 1, close).split(",") : [text.slice(at + 1, close)];
            let from = at + 1;
            for (const part of parts) {
              const value = part.trim(), start = from + part.indexOf(value);
              const missing = referencedFile(name, value, options.projectFiles);
              if (missing) problems.push({ from: parts.length > 1 ? start : at + 1, to: parts.length > 1 ? start + value.length : close, message: `${missing} is not in this report. Add the file or correct its name.` });
              from += part.length + 1;
            }
          }
        }
      }
      if (name === "mybibliography" && !/\\documentclass\s*\[[^\]]*\bbibliography\b[^\]]*\]\s*\{\.?labforge\}/.test(text))
        problems.push({ from: i, to: end, message: "\\mybibliography needs the bibliography class option. Enable Bibliography in Builder." });
      i = after > end ? after : end;
      continue;
    }
    if (char === "{") braces.push(i);
    else if (char === "}") {
      if (braces.length) braces.pop();
      else problems.push({ from: i, to: i + 1, message: "This } has no matching {. Remove it or add the opening {." });
    } else if (char === "$") {
      if (text[i + 1] === "$") { display = display >= 0 ? -1 : i; i += 2; continue; }
      inline = inline >= 0 ? -1 : i;
    }
    i++;
  }
  endParagraph();
  for (const from of braces) problems.push({ from, to: from + 1, message: "This { is never closed. Add the closing }." });
  for (const item of environments) problems.push({ from: item.from, to: item.to, message: `\\begin{${item.name}} is never closed. Add \\end{${item.name}}.` });
  return problems.sort((a, b) => a.from - b.from);
}
