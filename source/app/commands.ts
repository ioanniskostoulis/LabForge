// Licensed under the GNU General Public License v2 or later. See LICENSE.
import type { CommandSpec } from "forge-shell/app/command-spec";
import type { HelpCatalog, HelpDetails } from "forge-shell/app/command-help";
import { editorChoices, editorFamilies, editorToggles, editorVerbs, familyArguments, valuesOf } from "./editor-settings";
import { latexNames, latexTopics } from "./framework-commands";
import { sharedCommands, sharedHelpDetails, sharedHelpGroups, type SharedCommand, type StandardAction } from "forge-shell/app/shared-commands";
import { forgeApp } from "./profile";

/** LabForge's Terminal commands: syntax, descriptions and argument patterns. Help, usage errors and completion read this list. */
/** Options without a family are commands of their own (`wrap off`); the others share their family's command (`caret blink off`). Both stay forms of `editor`. */
const lower = (text: string) => text[0].toLowerCase() + text.slice(1);
const familyCommand = (family: typeof editorFamilies[number]): CommandSpec => {
  const names = familyArguments(family.name);
  const values = (name: string) => valuesOf(`${family.name} ${name}`);
  const example = names.includes("style") ? `${family.name} style grey` : `${family.name} ${names[0]} off`;
  return { name: family.name, syntax: `${family.name} [<option>] [<value>]`, description: `List or change the ${family.name} options`, example,
    args: new RegExp(`^(?:|${names.map(name => `${name}(?: (?:${values(name).join("|")}))?`).join("|")})$`),
    choices: names,
    subcommands: [{ syntax: family.name, description: `List the ${family.name} options and their states` },
      ...names.map(name => ({ syntax: `${family.name} ${name} [${values(name).join("|")}]`, description: `Show or set ${lower(optionLabel(`${family.name} ${name}`))}` }))] };
};
const optionLabel = (name: string) => [...editorToggles, ...editorChoices].find(item => item.name === name)!.label;
const optionCommands: readonly CommandSpec[] = [
  ...editorToggles.filter(item => !item.family).map(item => ({ name: item.name, syntax: `${item.name} [on|off]`, description: `Show or set ${lower(item.label)}`, args: /^(?:|on|off)$/, choices: ["on", "off"], example: `${item.name} off` })),
  ...editorChoices.filter(item => !item.family).map(item => ({ name: item.name, syntax: `${item.name} [${item.values.join("|")}]`, description: `Show or set the ${lower(item.comment)}`, args: new RegExp(`^(?:|${item.values.join("|")})$`), choices: [...item.values], example: `${item.name} ${item.values[0]}` })),
  ...editorFamilies.map(familyCommand),
];

/** The standard actions LabForge has; the shell's shared commands run them as their menu items do. LabForge has no Save as
 * (Save asks for a place the first time) and no Fit (Actual size is the editor's text size). */
export const ACTIONS: readonly StandardAction[] = ["file.new", "file.open", "file.save", "file.close", "edit.undo", "edit.redo",
  "view.zoomIn", "view.zoomOut", "view.actualSize", "app.settings", "about", "about.whatsNew", "about.shortcuts", "about.licenses"];
/** The bottom panes, Terminal first and Messages last. */
export const PANES = ["terminal", "plots", "tables", "messages"] as const;
/** The shell's shared commands for these actions, including its autosave preference. */
export const shared: readonly SharedCommand[] = sharedCommands(ACTIONS, { autosave: true });
const sharedSpecs: readonly CommandSpec[] = shared.map(({ spec }) => spec.name === "panel"
  ? { ...spec, choices: ["on", "off", ...PANES], example: "panel messages" } : spec);

/** LabForge's own commands, after the shared ones. */
const own: readonly CommandSpec[] = [
  { name: "health", syntax: "health [reminder [off|2|3|4|5|6]]", description: "Show or set active-use break reminders", args: /^(?:|reminder (?:off|2|3|4|5|6))$/, choices: ["reminder"], example: "health reminder off",
    subcommands: [{ syntax: "health", description: "Show the active-use reminder setting" }, { syntax: "health reminder [off|2|3|4|5|6]", description: "Set the active-use break reminder" }] },
  { name: "tabs", syntax: "tabs", description: "List the open reports", args: /^$/ },
  { name: "tab", syntax: "tab <number>", description: "Switch to an open report", args: /^\d+$/, example: "tab 2" },
  { name: "editor", syntax: "editor [<option>] [on|off]", description: "List or change editor options", example: "editor minimap on",
    args: new RegExp(`^(?:|${editorFamilies.map(family => family.name).join("|")}|${[...editorToggles, ...editorChoices].map(item => `${item.name}(?: (?:${valuesOf(item.name).join("|")}))?`).join("|")})$`),
    subcommands: [
      { syntax: "editor", description: "List editor options and their states" },
      { syntax: "editor <option> [<value>]", description: "Show or set one editor option, such as editor brackets dimmed on" },
      { syntax: "editor <family>", description: "List one family's options: brackets, caret or highlight" },
    ] },
  ...optionCommands,
  { name: "hidden", syntax: "hidden [on|off]", description: "Show or set whether hidden files are listed", args: /^(?:|on|off)$/, choices: ["on", "off"], example: "hidden on" },
  { name: "files", syntax: "files", description: "List files or show hidden ones in the inspector", example: "files hidden on",
    args: /^(?:|hidden(?: (?:on|off))?)$/,
    subcommands: [
      { syntax: "files", description: "List the report's files" },
      { syntax: "files hidden [on|off]", description: "Show or set whether hidden files are listed" },
    ] },
  { name: "pdf", syntax: "pdf [follow [on|off]]", description: "Show the PDF preview, or set whether it follows the cursor", args: /^(?:|follow(?: (?:on|off))?)$/, example: "pdf follow on",
    subcommands: [{ syntax: "pdf", description: "Show the PDF preview" }, { syntax: "pdf follow [on|off]", description: "Show or set whether the PDF keeps the cursor's line in view" }] },
  { name: "preset", syntax: "preset [<name>]", description: "Show or select the report style", args: /^(?:|[a-zA-Z][a-zA-Z0-9_-]*)$/,
    example: "preset thesis" },
  { name: "language", syntax: "language [greek|english]", description: "Show or set the document language", args: /^(?:|greek|english)$/,
    choices: ["greek", "english"], example: "language english" },
  { name: "latex", syntax: "latex [<command>|<topic>]", description: "List LaTeX commands or show one command's entry", example: "latex textwidth",
    args: /^(?:|\\?[a-zA-Z]+\*?|new [a-zA-Z]+ \d \S.*)$/,
    subcommands: [
      { syntax: "latex", description: "List LabForge's report commands" },
      { syntax: "latex <topic>", description: "List a topic's commands or the report's custom commands" },
      { syntax: "latex packages", description: "List packages included by LabForge and declared by this report" },
      { syntax: "latex <command>", description: "Show one command's entry" },
      { syntax: "latex new <name> <arguments> <body>", description: "Define a command of your own for this report" },
    ] },
  { name: "bibliography", syntax: "bibliography [on|off]", description: "Show or set whether the report has a bibliography", args: /^(?:|on|off)$/,
    choices: ["on", "off"], example: "bibliography on" },
  { name: "plots", syntax: "plots", description: "List the report's plots and whether their data changed", args: /^$/ },
  { name: "tables", syntax: "tables", description: "List the report's tables and whether their data changed", args: /^$/ },
  { name: "plot", syntax: "plot <action>", description: "Add, open, regenerate or remove a plot, or set plot defaults", example: "plot add function 0.2*x^2 0:5",
    args: /^(?:(?:open|remove) \S+|regenerate \S+|add (?:function \S.*|points \S.*|data \S+ [A-Za-z]{1,3}\d+:[A-Za-z]{1,3}\d+(?: \S.*)?)|default(?: [a-z-]+(?: \S.*)?)?|defaults)$/,
    subcommands: [
      { syntax: "plot add function <expression> [<from>:<to>]", description: "Add a plot of a function of x, from 0 to 10 unless given" },
      { syntax: "plot add points <point>...", description: "Add a plot of typed points" },
      { syntax: "plot add data <file> <range> [<sheet>]", description: "Add a plot of a range of a data file, x in its first column" },
      { syntax: "plot open <item>", description: "Open a plot in its default app" },
      { syntax: "plot regenerate <item>", description: "Read a plot's data files again" },
      { syntax: "plot remove <item>", description: "Move a plot to the Trash" },
      { syntax: "plot default <key> [<value>]", description: "Show or set one plot default for this report" },
      { syntax: "plot defaults", description: "List the plot defaults of this report" },
    ] },
  { name: "table", syntax: "table <action>", description: "Add, open, regenerate or remove a table, or change its format", example: "table add results.xlsx A1:D12",
    args: /^(?:(?:open|remove) \S+|regenerate \S+|add \S+ [A-Za-z]{1,3}\d+:[A-Za-z]{1,3}\d+(?: \S.*)?|(?:header|smart) \S+(?: (?:on|off))?|align \S+(?: (?:auto|(?: ?[lcr](?:\[\d*\.?\d+\])?)+))?)$/,
    subcommands: [
      { syntax: "table add <file> <range> [<sheet>]", description: "Add a table from a range of a data file" },
      { syntax: "table open <item>", description: "Open a table in its default app" },
      { syntax: "table regenerate <item>", description: "Read a table's data file again" },
      { syntax: "table remove <item>", description: "Move a table to the Trash" },
      { syntax: "table header <item> [on|off]", description: "Show or set whether the first row is the header" },
      { syntax: "table align <item> [auto|<columns>]", description: "Show or set column alignment and widths, such as lcr or l c[2] r" },
      { syntax: "table smart <item> [on|off]", description: "Show or set whether formulas, units and symbols are written as TeX" },
    ] },
  { name: "build", syntax: "build [save [on|off]]", description: "Build the report PDF, or set whether Save also builds it", args: /^(?:|save(?: (?:on|off))?)$/, example: "build save on",
    subcommands: [{ syntax: "build", description: "Build the report PDF with the selected builder" }, { syntax: "build save [on|off]", description: "Show or set whether Save also builds the PDF" }] },
  { name: "label", syntax: "label rename <old> <new>", description: "Rename a label and every reference to it", args: /^rename \S+ \S+$/, example: "label rename fig:a fig:setup" },
  { name: "cancel", syntax: "cancel", description: "Cancel the running build", args: /^$/ },
  { name: "finder", syntax: "finder [<file>|all]", description: "Show the report, a file or all open files in Finder", args: /^.*$/, example: "finder references.bib" },
  { name: "status", syntax: "status", description: "Show the report's name, file count and unsaved state", args: /^$/ },
];

export const commands: readonly CommandSpec[] = [...sharedSpecs, ...own];

/** Commands and forms that work with no report open. `files` and `panel` also have forms that need one. */
export const availableOnWelcome: ReadonlySet<string> = new Set([...shared.filter(entry => !entry.document).map(entry => entry.spec.name),
  "editor", ...optionCommands.map(command => command.name), "health", "hidden", "files", "tabs"]);

const details: Record<string, HelpDetails> = {
  health: { notes: ["Active-use history stays on this device.", "The reminder is shown after the selected number of active hours in a day."] },
  editor: {
    choices: [...editorToggles.map(toggle => [toggle.name, toggle.label] as [string, string]), ...editorChoices.map(item => [item.name, item.comment] as [string, string])],
    notes: ["Editor options are app preferences and apply to every report.", "Brackets, caret and highlight are also commands: brackets dimmed on, caret blink off."],
  },
  finder: { notes: ["With no value, the report folder is shown; all shows every open file."] },
  files: { notes: ["Listing files needs an open report; the hidden form works at any time."] },
  latex: { notes: ["Names work with or without the backslash.", "Hovering a command in the editor shows the same entry.", "A new command is written to the preamble of main.tex and then completes like the others."] },
  tabs: { notes: ["The numbers are positions; they shift when a report opens or closes."] },
  tab: { notes: ["The number is the position shown by tabs."] },
  build: { notes: ["Press Ctrl+C to cancel the build while it runs."] },
  cancel: { notes: ["The last good PDF stays in the preview."] },
  bibliography: { notes: ["On reads references.bib and runs the bibliography tool; write \\mybibliography where the list belongs."] },
  preset: { notes: ["Names come from the active report's .settings.tex.", "Edits the class line of main.tex; undo reverts it."] },
  language: { notes: ["Edits the class line of main.tex; undo reverts it."] },
  plots: { notes: ["Plots are the .tex files in plots/. Out of date means a data file changed since the plot was written."] },
  tables: { notes: ["Tables are the .tex files in tables/. Out of date means its data file changed since the table was written."] },
  plot: { notes: ["<item> is a number from plots or a file name; regenerate also takes all.", "A <point> is x,y, such as 1,2.5.", "A <range> has x in its first column and a series in each further column; a header row names them.", "Spreadsheets are read from the folder of the report file; write a name, or a path from that folder.", "Regenerate replaces only the data lines, so your other edits stay.", "Defaults are written to the preamble of main.tex as \\labforgesetup{plot-<key> = <value>}."] },
  table: { notes: ["<item> is a number from tables or a file name; regenerate also takes all.", "Spreadsheets are read from the folder of the report file; write a name, or a path from that folder.", "Regenerate replaces only the rows; header, align and smart write the table again from its settings."] },
};

export const helpCatalog: HelpCatalog = {
  commands,
  helpCommands: commands,
  availableOnWelcome,
  // The shared commands' help first, so that they read the same as in every Forge app; LabForge's own entries follow.
  details: { ...sharedHelpDetails(shared), ...details },
  welcomeForms: {},
  welcomeTopics: {},
  groups: helpGroups(),
  alwaysChoices: new Set(["inspector", "panel", "theme", "preset", "language", "bibliography", "hidden", ...optionCommands.map(command => command.name)]),
  noDocumentMessage: "Open a report project first.",
};

/** The shared groups with LabForge's commands added, in menu order: File, Edit, View, Editor, Document, Help, then
 * Plots and tables (bottom panes, not a menu) and Console last. */
function helpGroups(): [string, string[]][] {
  const groups = new Map(sharedHelpGroups(shared));
  const add = (group: string, names: string[]) => groups.set(group, [...(groups.get(group) ?? []), ...names]);
  add("File", ["tabs", "tab", "finder"]);
  add("View", ["files", "hidden", "pdf"]);
  add("View", ["health"]);
  const order: [string, string[]][] = [["File", []], ["Edit", []], ["View", []], ["Editor", ["editor", ...optionCommands.map(command => command.name)]],
    ["Document", ["preset", "language", "bibliography", "latex", "label", "build", "cancel", "status"]], ["Help", []], ["Plots and tables", ["plots", "tables", "plot", "table"]], ["Console", []]];
  return order.map(([group, names]) => [group, [...(groups.get(group) ?? []), ...names]] as [string, string[]]).filter(([, names]) => names.length);
}

export const findCommand = (name: string): CommandSpec | undefined => commands.find(command => command.name === name);

/** Words that may follow `verb` as its first argument, for Tab completion. */
export function firstArguments(verb: string, welcome: boolean): string[] {
  if (verb === "help") return commands.filter(command => !welcome || availableOnWelcome.has(command.name)).map(command => command.name);
  if (verb === "editor") return [...editorVerbs];
  if (editorFamilies.some(family => family.name === verb)) return familyArguments(verb);
  if (verb === "files") return ["hidden"];
  if (verb === "history") return ["clear"];
  if (verb === "latex") return [...latexTopics, "new", ...latexNames()];
  if (verb === "plot") return ["add", "open", "regenerate", "remove", "default", "defaults"];
  if (verb === "table") return ["add", "open", "regenerate", "remove", "header", "align", "smart"];
  if (verb === "health") return ["reminder"];
  if (verb === "panel" && welcome) return ["on", "off", "terminal"];
  return findCommand(verb)?.choices ?? [];
}
