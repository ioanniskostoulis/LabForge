// Licensed under the GNU General Public License v2 or later. See LICENSE.
// Reads the diagnostics of an explicit TeX build. The source location is kept separate from the
// message so the editor can mark a token only when the build still describes its current text.

export type BuildDiagnostic = { severity: "error" | "warning"; message: string; file?: string; line?: number; token?: string };

const located = /^(?:\.\/)?(.+?\.(?:tex|bib|sty|cls)):(\d+):\s*(.+)$/i;
const warning = /^(?:LaTeX|Package [^:]+|Overfull|Underfull).*Warning:|^(?:Overfull|Underfull) \\hbox/i;

/** The command TeX printed after `l.<number>` for an undefined control sequence. */
function contextToken(lines: string[], start: number, line: number): string | undefined {
  for (const raw of lines.slice(start + 1, start + 5)) {
    const context = /^l\.(\d+)\s*(.*)$/.exec(raw.trimStart());
    if (context && Number(context[1]) === line) {
      const commands = [...context[2].matchAll(/\\[A-Za-z@]+\*?|\\./g)];
      // TeX sometimes prints several commands in the context line. In that case
      // the output does not identify which one failed, so leave the range unmarked.
      return commands.length === 1 ? commands[0][0] : undefined;
    }
    if (located.test(raw.trim()) || /^!\s/.test(raw.trim())) break;
  }
  return undefined;
}

/** Actionable errors and warnings in output order; duplicate latexmk summaries are omitted. */
export function parseBuildDiagnostics(output: string): BuildDiagnostic[] {
  const lines = output.split(/\r?\n/);
  const found: BuildDiagnostic[] = [];
  const seen = new Set<string>();
  const add = (item: BuildDiagnostic): void => {
    const key = `${item.severity}\0${item.file ?? ""}\0${item.line ?? ""}\0${item.message}`;
    if (!seen.has(key)) { seen.add(key); found.push(item); }
  };
  for (let index = 0; index < lines.length; index++) {
    const text = lines[index].trim();
    const place = located.exec(text);
    if (place) {
      const message = place[3].trim();
      const severity = warning.test(message) ? "warning" : "error";
      const line = Number(place[2]);
      add({ severity, message, file: place[1], line,
        ...(severity === "error" && /Undefined control sequence/i.test(message) ? { token: contextToken(lines, index, line) } : {}) });
      continue;
    }
    if (warning.test(text)) { add({ severity: "warning", message: text }); continue; }
    if (/^No pages of output\.?$/i.test(text)) {
      add({ severity: "error", message: "The document produced no pages. Add content inside the document environment." });
      continue;
    }
    // Some failures have no file-line prefix (for example a missing font or package).
    if (/^!\s+/.test(text) && !lines.slice(Math.max(0, index - 3), index).some(raw => located.test(raw.trim())))
      add({ severity: "error", message: text.replace(/^!\s+/, "") });
  }
  // latexmk's exit sentence describes the result, not its cause.
  return found.slice(0, 100);
}

/** A short sentence for the build result, with a real error preferred over warnings and exit codes. */
export function buildFailureSummary(diagnostics: readonly BuildDiagnostic[], code: number | null): string {
  return diagnostics.find(item => item.severity === "error")?.message ?? `PDF build failed (${code ?? "unknown"}).`;
}

/** Files TeX can open while reading a report; anything else in parentheses (such as `(5.9pt too wide)`) only keeps the count. */
const openedFile = /^\(((?:\.{0,2}\/|[A-Za-z]:[\\/])?[^\s()]+\.(?:tex|ltx|sty|cls|cfg|def|fd|clo|ldf|aux|toc|lof|lot|out|bbl|nav|snm|vrb|lua))(?=[\s()]|$)/;
const warningLine = /(?:on input line|detected at line|at lines?) (\d+)/;

/** Each warning line of a TeX transcript with the report file TeX was reading and the input line it names. TeX wraps
 * transcript lines at 79 characters, so a line of that length continues on the next one. A new run starts a new stack. */
export function warningLocations(transcript: string): { text: string; file?: string; line?: number }[] {
  const lines = transcript.split(/\r?\n/);
  const found: { text: string; file?: string; line?: number }[] = [];
  let stack: (string | null)[] = [];
  for (let index = 0; index < lines.length; index++) {
    const raw = lines[index];
    if (/^This is (?:Xe|pdf|Lua(?:HB)?|e-)?TeX\b/.test(raw)) stack = [];
    const text = raw.trim();
    if (warning.test(text) && !located.test(text)) {
      // The warning and the lines that continue it: wrapped lines and `(package)` continuation lines.
      let logical = raw, next = index;
      while (next + 1 < lines.length && (lines[next].length === 79 || /^\([A-Za-z@-]+\)\s/.test(lines[next + 1]))) logical += (lines[next].length === 79 ? "" : " ") + lines[++next];
      const file = [...stack].reverse().find(item => item !== null) ?? undefined;
      const number = warningLine.exec(logical);
      const local = file && !/^(?:\/|[A-Za-z]:[\\/])/.test(file) && /\.(?:tex|ltx)$/.test(file) ? file.replace(/^\.\//, "") : undefined;
      found.push({ text, ...(local && number ? { file: local, line: Number(number[1]) } : {}) });
    }
    // Parentheses open and close files; a wrapped name is read whole by joining the next line.
    const joined = raw.length === 79 && index + 1 < lines.length ? raw + lines[index + 1] : raw;
    for (let at = 0; at < raw.length; at++) {
      if (raw[at] === "(") { const name = openedFile.exec(joined.slice(at)); stack.push(name ? name[1] : null); }
      else if (raw[at] === ")") stack.pop();
    }
  }
  return found;
}

/** Give located warnings their file and input line from TeX transcripts (the .log first, then the build output). Messages and kinds stay as they are. */
export function locateWarnings(issues: readonly BuildDiagnostic[], ...transcripts: string[]): BuildDiagnostic[] {
  const entries = transcripts.flatMap(transcript => warningLocations(transcript)).filter(entry => entry.file);
  return issues.map(issue => {
    if (issue.severity !== "warning" || issue.file) return issue;
    const entry = entries.find(item => item.text === issue.message);
    return entry ? { ...issue, file: entry.file, line: entry.line } : issue;
  });
}
