// Licensed under the GNU General Public License v2 or later. See LICENSE.
// What `\cite` and `\myref` can name: the keys of references.bib, and the labels written in the report.

export interface CitationEntry { key: string; detail: string }
export interface LabelEntry { name: string; detail: string }

/** The entries of a .bib file: each key with a short "Author Year, Title" line. Comments, @string and @preamble are skipped. */
export function bibliographyEntries(text: string): CitationEntry[] {
  const entries: CitationEntry[] = [];
  const header = /^[ \t]*@([a-zA-Z]+)\s*[{(]\s*([^,\s{}]+)\s*,/gm;
  const starts = [...text.matchAll(header)].filter(match => !/^(?:comment|string|preamble)$/i.test(match[1]));
  for (const [index, match] of starts.entries()) {
    const body = text.slice(match.index + match[0].length, starts[index + 1]?.index ?? text.length);
    const field = (name: string) => new RegExp(`(?:^|[\\s,])${name}\\s*=\\s*(?:\\{((?:[^{}]|\\{[^{}]*\\})*)\\}|"([^"]*)"|(\\w+))`, "i").exec(body);
    const value = (name: string) => { const found = field(name); return (found?.[1] ?? found?.[2] ?? found?.[3] ?? "").replace(/[{}]/g, "").replace(/\s+/g, " ").trim(); };
    const author = value("author").split(/\s+and\s+/)[0], family = author.includes(",") ? author.split(",")[0] : author.split(" ").at(-1) ?? "";
    const more = /\sand\s/.test(value("author")) ? " et al." : "";
    const detail = [[family && family + more, (value("year") || value("date")).slice(0, 4)].filter(Boolean).join(" "), value("title")].filter(Boolean).join(", ");
    entries.push({ key: match[2], detail });
  }
  return entries;
}

const headingNames: Record<string, string> = { mysection: "Section", mysubsection: "Subsection", mysubsubsection: "Subsubsection", myformula: "Formula", myreaction: "Reaction", myequation: "Equation" };
const filePrefixes: Record<string, [string, string]> = { myfigure: ["fig", "Figure"], myplot: ["plot", "Plot"], mytable: ["tab", "Table"] };

/** The labels in a report: `label=` keys, `\label{…}`, and the default label of a figure, plot or table (its kind and file name, with no folder). */
export function documentLabels(source: string): LabelEntry[] {
  const text = source.split("\n").map(line => line.replace(/(^|[^\\])%.*$/, "$1")).join("\n");
  const found = new Map<string, string>();
  for (const match of text.matchAll(/\\(mysection|mysubsection|mysubsubsection|myformula|myreaction|myequation|myfigure|myplot|mytable)\*?\s*(?:\[((?:[^\]\\]|\\.)*)\])?\s*\{((?:[^{}]|\{[^{}]*\})*)\}/g)) {
    const [, command, keys = "", content] = match;
    const label = /(?:^|,)\s*label\s*=\s*([^,\]]+)/.exec(keys)?.[1].trim();
    const prefix = filePrefixes[command];
    if (prefix) {
      const files = content.split(",").map(file => file.trim()).filter(Boolean);
      const name = label ?? `${prefix[0]}:${(command === "mytable" ? content.trim() : files[0] ?? "").replace(/^.*\//, "").replace(/\.[^.]+$/, "")}`;
      const caption = /(?:^|,)\s*caption\s*=\s*([^,\]]+)/.exec(keys)?.[1].trim();
      found.set(name, caption ? `${prefix[1]}: ${caption}` : `${prefix[1]} ${content.trim()}`);
      // Side-by-side files: each part is name[1], name[2], ... with its letter and subcaption.
      if (command !== "mytable" && files.length > 1) {
        const subcaptions = splitList(/(?:^|,)\s*subcaption\s*=\s*(\{(?:[^{}]|\{[^{}]*\})*\}|[^,\]]+)/.exec(keys)?.[1].trim().replace(/^\{([\s\S]*)\}$/, "$1") ?? "");
        files.forEach((file, index) => {
          const letter = String.fromCharCode(97 + index), subcaption = subcaptions[index];
          found.set(`${name}[${index + 1}]`, `${prefix[1]} part (${letter}): ${subcaption || file}`);
        });
      }
    } else if (label) {
      const title = headingNames[command] === "Formula" || /^my(?:reaction|equation)$/.test(command) ? content.trim().slice(0, 40) : content.trim();
      found.set(label, `${headingNames[command]}: ${title}`);
    }
  }
  for (const match of text.matchAll(/\\label\s*\{([^{}]+)\}/g)) if (!found.has(match[1].trim())) found.set(match[1].trim(), "Label");
  return [...found].map(([name, detail]) => ({ name, detail }));
}

/** A comma-separated key value split at top-level commas, with the braces around an item removed. */
function splitList(value: string): string[] {
  const items: string[] = []; let depth = 0, item = "";
  for (const char of value) {
    if (char === "," && depth === 0) { items.push(item); item = ""; continue; }
    if (char === "{") depth++; else if (char === "}") depth--;
    item += char;
  }
  items.push(item);
  return items.map(entry => entry.trim().replace(/^\{([\s\S]*)\}$/, "$1").trim());
}

export const citeCommands = "cite|citep|citet|citeauthor|citeyear|parencite|textcite|autocite|footcite|smartcite|supercite|nocite";
export const refCommands = "myref|ref|eqref|pageref|autoref|cref|Cref|vref";

/** Which names the cursor is choosing: the command before it, the part of the name typed so far and where that part starts. */
export function nameArgument(before: string): { kind: "citation" | "label"; typed: string; start: number } | null {
  const found = new RegExp(`\\\\(${citeCommands}|${refCommands})\\*?(?:\\[[^\\]]*\\]){0,2}\\{([^{}]*)$`).exec(before);
  if (!found) return null;
  const typed = /[^,\s]*$/.exec(found[2])![0];
  return { kind: new RegExp(`^(?:${citeCommands})$`).test(found[1]) ? "citation" : "label", typed, start: before.length - typed.length };
}

export type FileKind = "figure" | "plot" | "table";
const fileFolders: Record<FileKind, string> = { figure: "graphics", plot: "plots", table: "tables" };
const imageExtensions = /\.(?:png|jpe?g|pdf|svg|eps|gif|tiff?|webp)$/i;

/** Which file the cursor is choosing inside `\myfigure{`, `\myplot{` or `\mytable{`, with the part typed so far and where it starts. */
export function fileArgument(before: string): { kind: FileKind; typed: string; start: number } | null {
  const found = /\\(myfigure|myplot|mytable)\*?(?:\[[^\]]*\])?\{([^{}]*)$/.exec(before);
  if (!found) return null;
  const typed = /[^,]*$/.exec(found[2])![0].replace(/^\s+/, "");
  return { kind: found[1].slice(2) as FileKind, typed, start: before.length - typed.length };
}

/** The files a figure, plot or table can name: those in graphics/, plots/ or tables/, written relative to that folder, minus any already in the list. */
export function fileChoices(kind: FileKind, projectFiles: readonly string[], listed: readonly string[] = []): string[] {
  const folder = `${fileFolders[kind]}/`;
  const accepts = (name: string) => kind === "figure" ? imageExtensions.test(name) : name.endsWith(".tex");
  return projectFiles.filter(path => path.startsWith(folder) && !path.split("/").some(part => part.startsWith(".")) && accepts(path))
    .map(path => path.slice(folder.length)).filter(name => !listed.includes(name)).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}
