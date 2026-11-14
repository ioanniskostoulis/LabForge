// Licensed under the GNU General Public License v2 or later. See LICENSE.
import type { ConsoleListItem } from "forge-shell/app/terminal";
import { commandCategories, standardCommands, type TexCommand } from "./tex-commands";
import { reportPackages, type ReportPackages } from "./report-packages";

/** One key of a framework command, as in the Keys list of `documentation/FRAMEWORK.md`. */
export interface FrameworkKey { name: string; description: string; values?: readonly string[] }

/** One framework command: what the editor hover, completion and the Terminal `latex` verb show. */
export interface FrameworkCommand {
  /** The control sequence without its backslash, with a trailing `*` for the starred form. */
  name: string;
  syntax: string;
  description: string;
  example: string;
  /** Names from `frameworkKeys` that the command takes in square brackets. */
  keys: readonly string[];
  /** Inserted by completion after the backslash; `{}` and `[]` are the cursor stops, the first one wins. */
  snippet: string;
}

const placeValues = ["here", "float", "span", "wrap", "wrap-left"] as const;

/** The keys shared by the `\my…` commands; every command uses the same names. */
export const frameworkKeys: Record<string, FrameworkKey> = {
  label: { name: "label", description: "Name that \\myref uses; graphics, plots and tables default to a kind prefix and the file name" },
  caption: { name: "caption", description: "Caption text; without one there is no number. Braces protect a comma: caption={Mass, time.}" },
  subcaption: { name: "subcaption", description: "For several files, a text under each one after its letter: subcaption={Before, After}" },
  width: { name: "width", description: "A length such as 8cm, or a fraction of the column such as 0.5; with several files, the width of each" },
  height: { name: "height", description: "A length such as 6cm" },
  "caption-align": { name: "caption-align", description: "Alignment of this caption only: justify, center, left or right", values: ["justify", "center", "left", "right"] },
  hyphenate: { name: "hyphenate", description: "Hyphenation in this caption only: true or false", values: ["true", "false"] },
  place: { name: "place", description: "Where the block goes: here, float, span, wrap or wrap-left", values: placeValues },
  spread: { name: "spread", description: "Row height as a line spread of its own, such as 1.2; the text after the table returns to the grid" },
  header: { name: "header", description: "Running header text" },
  title: { name: "title", description: "Report title" },
  author: { name: "author", description: "Author names; \\\\ starts a new line" },
  conducted: { name: "conducted", description: "Date the work was conducted" },
  submitted: { name: "submitted", description: "Date the report was submitted" },
  institution: { name: "institution", description: "Institution name; \\\\ starts a new line" },
  subtitle: { name: "subtitle", description: "Subtitle under the title" },
  email: { name: "email", description: "Contact email address" },
  orcid: { name: "orcid", description: "ORCID identifier" },
  degree: { name: "degree", description: "Degree or kind of work, such as Diploma thesis" },
  supervisor: { name: "supervisor", description: "Supervisor's name" },
  date: { name: "date", description: "Date or year; the current year when omitted" },
};

const entry = (name: string, syntax: string, description: string, example: string, keys: readonly string[], snippet = `${name}{}`): FrameworkCommand =>
  ({ name, syntax, description, example, keys, snippet });

/** The owner's keep list from `documentation/FRAMEWORK.md`. It follows the framework when the framework changes. */
export const frameworkCommands: readonly FrameworkCommand[] = [
  entry("myfigure", "\\myfigure[<keys>]{<file>, …}", "Insert an image from graphics/, or several side by side", "\\myfigure[caption={Setup.}, subcaption={Before, After}]{before.png, after.png}", ["label", "caption", "subcaption", "caption-align", "hyphenate", "width", "height", "place"]),
  entry("myplot", "\\myplot[<keys>]{<file>, …}", "Insert a pgfplots file from plots/, or several side by side", "\\myplot[caption={Absorbance.}, place=span]{absorbance}", ["label", "caption", "subcaption", "caption-align", "hyphenate", "width", "height", "place"]),
  entry("mytable", "\\mytable[<keys>]{<file>}", "Insert a table file from tables/", "\\mytable[caption={Mass, time and yield.}]{yields}", ["label", "caption", "caption-align", "hyphenate", "width", "spread", "place"]),
  entry("myformula", "\\myformula[<keys>]{<math>}", "Write a numbered formula; & aligns rows and each \\\\ row gets a number", "\\myformula[label=equilibrium]{K = \\frac{[C]}{[A][B]}}", ["label", "place"]),
  entry("myequation", "\\myequation[<keys>]{<math>}", "Write an unnumbered equation", "\\myequation{E = mc^2}", ["place"]),
  entry("myreaction", "\\myreaction[<keys>]{<formula>}", "Write a numbered mhchem reaction (R1, R2…); with \\\\ the rows are aligned and \\ce{…} holds the chemistry", "\\myreaction[label=formation]{2H2 + O2 -> 2H2O}", ["label", "place"]),
  entry("mysection", "\\mysection[<keys>]{<title>}", "Start a section", "\\mysection[label=intro]{Introduction}", ["label"]),
  entry("mysubsection", "\\mysubsection[<keys>]{<title>}", "Start a subsection", "\\mysubsection{Method}", ["label"]),
  entry("mysubsubsection", "\\mysubsubsection[<keys>]{<title>}", "Start a subsubsection", "\\mysubsubsection{Reagents}", ["label"]),
  entry("myreport", "\\myreport[<keys>]", "Write a report's title block; \\\\ in a value starts a new line", "\\myreport[title={Titration}, author={A. Author \\\\ B. Author}]", ["header", "title", "author", "conducted", "submitted", "institution"], "myreport[]"),
  entry("mythesis", "\\mythesis[<keys>]", "Write a thesis title block; \\\\ in a value starts a new line", "\\mythesis[title={Nitrogen fixation}, author={A. Author}, institution={University \\\\ Department}, place={Athens}]", ["title", "subtitle", "author", "email", "orcid", "degree", "supervisor", "institution", "place", "date"], "mythesis[]"),
  entry("mylineskip", "\\mylineskip", "Leave one blank line of the grid", "\\mylineskip", [], "mylineskip"),
  entry("mytoday", "\\mytoday", "Write today's date", "\\mytoday", [], "mytoday"),
  entry("myref", "\\myref[nom]{<label>, …}", "Refer by name and number to figures, plots, tables, formulas, reactions or sections", "\\myref{fig:photo, tab:yields}", []),
  entry("myref*", "\\myref*{<label>}", "Refer to an equation or reaction by its number alone", "\\myref*{equilibrium}", [], "myref*{}"),
  entry("mybibliography", "\\mybibliography", "Print the bibliography; needs the bibliography option", "\\mybibliography", [], "mybibliography"),
  entry("labforgesetup", "\\labforgesetup{<key>=<value>, …}", "Set margins, spacing, section and caption options in the preamble", "\\labforgesetup{margin=0.8in, margin-left=1in, line-spread=1.15}", [], "labforgesetup{}"),
];

/** The commands the open report defines itself, in the preamble of main.tex. */
let customCommands: readonly TexCommand[] = [];
let cachedCommands: readonly FrameworkCommand[] | null = null;
export function setCustomCommands(commands: readonly TexCommand[]): void { customCommands = commands; cachedCommands = null; }
export const getCustomCommands = (): readonly TexCommand[] => customCommands;

let packages: ReportPackages = reportPackages("\\documentclass{.labforge}");
export function setReportPackageSource(mainTex: string): void { packages = reportPackages(mainTex); cachedCommands = null; }
export function getReportPackages(): ReportPackages { return packages; }

/** One report-aware catalogue shared by completion, search, hover and Terminal help. */
export function availableCommands(): readonly FrameworkCommand[] {
  if (cachedCommands) return cachedCommands;
  const found = new Map<string, FrameworkCommand>();
  for (const command of [...frameworkCommands, ...customCommands]) if (!found.has(command.name)) found.set(command.name, command);
  for (const command of standardCommands) if ((command.package === "LaTeX" || packages.names.has(command.package)) && !found.has(command.name)) found.set(command.name, command);
  return cachedCommands = [...found.values()];
}

/** The entry for a command name, with or without its backslash and `*`; the starred form falls back to the plain one. LabForge's own commands come first, then the report's, then the standard ones. */
export function findFrameworkCommand(name: string): FrameworkCommand | undefined {
  const bare = name.replace(/^\\/, "");
  const search = (word: string) => availableCommands().find(command => command.name === word);
  return search(bare) ?? search(bare.replace(/\*$/, ""));
}

/** The keys a command takes, with their descriptions. */
export const commandKeys = (command: FrameworkCommand): FrameworkKey[] => command.keys.map(name => frameworkKeys[name]);

/** The command whose name the position `offset` of `line` touches, if the text there is a framework command. */
export function commandAt(line: string, offset: number): { command: FrameworkCommand; from: number; to: number } | null {
  for (const match of line.matchAll(/\\([a-zA-Z@]+)(\*?)/g)) {
    const from = match.index!;
    if (offset < from || offset > from + match[0].length) continue;
    const command = findFrameworkCommand(match[1] + match[2]);
    return command ? { command, from, to: from + 1 + match[1].length + (command.name.endsWith("*") ? 1 : 0) } : null;
  }
  return null;
}

/** The key list of the unfinished `[…]` just before the cursor in `\my…[a=b, ` text, or `null` when the cursor is not inside key brackets. */
export function keysContext(before: string): { command: FrameworkCommand; typed: string; used: string[] } | null {
  const open = /\\([a-zA-Z]+)\[((?:[^\]{}]|\{[^}]*\})*)$/.exec(before);
  const command = open && findFrameworkCommand(open[1]);
  if (!open || !command || !command.keys.length) return null;
  const parts = open[2].split(/,(?![^{]*\})/);
  return { command, typed: parts[parts.length - 1].trimStart(), used: parts.slice(0, -1).map(part => part.split("=")[0].trim()) };
}

/* `\myref[nom]`: the Greek nominative. Only "Πίνακας" changes form, so only articles that mark a subject matter. */

const nominativeArticles = new Set(["ο", "η", "οι"]);

/** True when the word right before a `\myref` is a nominative article (ο, η, οι, in any case, with or without an accent). */
export function afterNominativeArticle(before: string): boolean {
  const word = /([\p{L}]+)\s*$/u.exec(before)?.[1];
  if (!word) return false;
  return nominativeArticles.has(word.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""));
}

/** The text completion inserts for `\myref`: `\myref[nom]{}` after a nominative article, else `\myref{}`. */
export function refSnippet(before: string): string {
  return afterNominativeArticle(before) ? "myref[nom]{}" : "myref{}";
}

/* The Terminal `latex` verb. */

/** Names for `latex <command>`: written without a backslash. The report's own commands come after LabForge's, and the standard ones last. */
export function latexNames(): string[] { return availableCommands().map(command => command.name); }
export const frameworkCommandNames: string[] = frameworkCommands.map(command => command.name);

/** The topics of `latex <topic>` besides a command name. */
export const latexTopics = [...commandCategories, "packages", "custom"] as const;

const listing = (commands: readonly FrameworkCommand[]): ConsoleListItem[] => {
  const width = Math.max(12, ...commands.map(command => command.name.length + 1));
  return commands.map(command => ({ label: command.name, comment: command.description.replace(/;.*$/, ""), labelWidth: width }));
};

/** `latex` lists LabForge's commands; topics list indexed commands, report packages or custom commands; `latex <command>` shows one entry. Returns `null` for an unknown name. */
export function latexHelp(arg: string): (string | ConsoleListItem)[] | null {
  const topic = arg.trim().replace(/^\\/, "").toLowerCase();
  if (!topic) return ["latex <command> for details.", `latex <topic> lists more: ${latexTopics.join(", ")}.`, ...listing(frameworkCommands)];
  if (topic === "packages") {
    const width = Math.max(12, ...packages.included.map(item => item.name.length + 1), ...packages.added.map(name => name.length + 1));
    return ["Included by LabForge:", ...packages.included.map(item => ({ label: item.name, comment: `${item.description}; ${item.gives}`, labelWidth: width })),
      "Added in this report:", ...(packages.added.length ? packages.added.map(name => ({ label: name, comment: "Declared in main.tex", labelWidth: width })) : ["No additional packages declared."])];
  }
  if (topic === "custom") return customCommands.length ? ["The commands this report defines.", ...listing(customCommands)] : ["No custom commands yet. Add one with latex new or in the preamble of main.tex."];
  if ((commandCategories as readonly string[]).includes(topic)) return listing(availableCommands().filter((command): command is TexCommand => "category" in command && command.category === topic));
  const command = findFrameworkCommand(arg);
  if (!command) return null;
  const keys = commandKeys(command);
  const source = (command as Partial<TexCommand>).package;
  return [
    { label: command.syntax, comment: command.description },
    ...(source ? [{ label: "From", comment: source }] : []),
    ...(keys.length ? [{ label: "Keys", comment: "", subdued: true }, ...keys.map(key => ({ label: key.name, comment: key.description, indent: 1 }))] : []),
    { label: "Example", comment: command.example },
  ];
}
