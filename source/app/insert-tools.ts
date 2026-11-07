// Licensed under the GNU General Public License v2 or later. See LICENSE.
// The toolbar's insert tools: families of report commands that write code at the cursor, and a search over them.
// They never format text; they only place a framework command (`documentation/FRAMEWORK.md`) where the cursor is.
import { toolIcon } from "forge-shell/app/tool-icons";
import { availableCommands, findFrameworkCommand, frameworkCommands } from "./framework-commands";
import type { TexCommand } from "./tex-commands";
import { insertText, type ProjectFile } from "./file-browser";

export interface InsertTool { id: string; label: string; icon: string; /** The command without its backslash; `{}` and `[]` are cursor stops. */ snippet: string }
export interface InsertFamily { id: string; label: string; icon: string; tools: InsertTool[] }

const icons = {
  section: toolIcon('<path d="M3 4h10M3 8h7M3 12h10"/>'),
  subsection: toolIcon('<path d="M3 4h10M6 8h7M6 12h7"/>'),
  subsubsection: toolIcon('<path d="M3 4h10M8 8h5M8 12h5"/>'),
  title: toolIcon('<path d="M3 2.5h10v11H3zM5 5.5h6M8 5.5v5M5 12h5"/>'),
  lineskip: toolIcon('<path d="M8 3v10M5.5 5.5 8 3l2.5 2.5M5.5 10.5 8 13l2.5-2.5"/>'),
  today: toolIcon('<rect x="3" y="4" width="10" height="9" rx="1"/><path d="M3 7h10M6 2.5v3M10 2.5v3"/>'),
  setup: toolIcon('<path d="M3 5h10M3 11h10"/><circle cx="6" cy="5" r="1.4"/><circle cx="10" cy="11" r="1.4"/>'),
  formula: toolIcon('<path d="M11.5 3.5h-7L8 8l-3.5 4.5h7"/>'),
  equation: toolIcon('<path d="M4 6h8M4 10h8"/>'),
  reaction: toolIcon('<path d="M3 8h10M10 5l3 3-3 3"/>'),
  graphic: toolIcon('<rect x="2.5" y="3.5" width="11" height="9" rx="1"/><path d="m3 11 3.5-3.5L9 10l1.5-1.5L13 11"/><circle cx="10.5" cy="6.5" r="0.8"/>'),
  plot: toolIcon('<path d="M3 3v10h10"/><path d="m5 10 2.5-3 2 1.5L12 5"/>'),
  table: toolIcon('<rect x="2.5" y="3.5" width="11" height="9" rx="1"/><path d="M2.5 7h11M2.5 10h11M7 3.5v9"/>'),
  reference: toolIcon('<path d="M6.5 9.5a2.5 2.5 0 0 0 3.5 0l2-2a2.5 2.5 0 0 0-3.5-3.5L8 5M9.5 6.5a2.5 2.5 0 0 0-3.5 0l-2 2a2.5 2.5 0 0 0 3.5 3.5L8 11"/>'),
  number: toolIcon('<path d="M5 6h6M5 10h6M7 4 6 12M10 4 9 12"/>'),
  custom: toolIcon('<path d="M6 3.5C4.5 3.5 4 4 4 5.5v1.2C4 7.4 3.5 8 2.5 8c1 0 1.5.6 1.5 1.3v1.2c0 1.5.5 2 2 2M10 3.5c1.5 0 2 .5 2 2v1.2c0 .7.5 1.3 1.5 1.3-1 0-1.5.6-1.5 1.3v1.2c0 1.5-.5 2-2 2"/>'),
  newCommand: toolIcon('<path d="M8 3.5v9M3.5 8h9"/>'),
  open: toolIcon('<path d="M4 2.5h5l3 3v8H4z"/><path d="M9 2.5v3h3"/>'),
  bibliography: toolIcon('<path d="M4 3h6.5A1.5 1.5 0 0 1 12 4.5V13H5.5A1.5 1.5 0 0 1 4 11.5z"/><path d="M4 11.5A1.5 1.5 0 0 1 5.5 10H12"/>'),
};

const tool = (id: string, label: string, icon: string): InsertTool => ({ id, label, icon, snippet: findFrameworkCommand(id)?.snippet ?? `${id}{}` });

/** The families, in toolbar order. Figures also lists the report's own files; see `figureTools`. */
export const insertFamilies: readonly InsertFamily[] = [
  { id: "insert-title", label: "Title", icon: icons.title, tools: [
    tool("myreport", "Report title", icons.title), tool("mythesis", "Thesis title", icons.title)] },
  { id: "insert-structure", label: "Structure", icon: icons.section, tools: [
    tool("mysection", "Section", icons.section), tool("mysubsection", "Subsection", icons.subsection), tool("mysubsubsection", "Subsubsection", icons.subsubsection),
    tool("mylineskip", "Line skip", icons.lineskip), tool("mytoday", "Today's date", icons.today), tool("labforgesetup", "Setup options", icons.setup)] },
  { id: "insert-maths", label: "Maths", icon: icons.formula, tools: [
    tool("myformula", "Formula", icons.formula), tool("myequation", "Equation", icons.equation), tool("myreaction", "Reaction", icons.reaction)] },
  { id: "insert-figures", label: "Figures", icon: icons.graphic, tools: [
    tool("myfigure", "Figure", icons.graphic), tool("myplot", "Plots", icons.plot), tool("mytable", "Tables", icons.table)] },
  { id: "insert-references", label: "References", icon: icons.reference, tools: [
    tool("myref", "Reference", icons.reference), tool("myref*", "Reference by number", icons.number), tool("mybibliography", "Bibliography", icons.bibliography)] },
];

/** The Figures family followed by one tool for each file in `graphics/`, `plots/` and `tables/`, which writes the command with the file's name. */
export function figureTools(files: readonly ProjectFile[]): InsertTool[] {
  const family = insertFamilies.find(item => item.id === "insert-figures")!;
  const icon = (path: string) => path.startsWith("graphics/") ? icons.graphic : path.startsWith("plots/") ? icons.plot : icons.table;
  const own = files.filter(file => !file.hidden && insertText(file)).map(file => ({ id: `file:${file.path}`, label: file.path, icon: icon(file.path), snippet: insertText(file)!.slice(1) }));
  return [...family.tools, ...own];
}

export interface CommandHit { id: string; label: string; category: string; detail: string; snippet: string }

/**
 * The command finder searches every available command's name, syntax, description, example, keys and package.
 * Exact name prefixes rank first; all matches remain in the shell's scrollable results panel.
 */
export function searchCommands(query: string, files: readonly ProjectFile[] = [], custom: readonly TexCommand[] = []): CommandHit[] {
  const needle = query.trim().replace(/^\\/, "").toLowerCase();
  const terms = needle.split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  const hits: (CommandHit & { rank: number })[] = [];
  const consider = (id: string, label: string, name: string, text: string, category: string, detail: string, snippet: string) => {
    const haystack = `${name} ${label} ${text}`.toLowerCase();
    const rank = !terms.every(term => haystack.includes(term)) ? -1 : name.toLowerCase().startsWith(needle) ? 0
      : name.toLowerCase().includes(needle) || label.toLowerCase().includes(needle) ? 1 : 2;
    if (rank >= 0) hits.push({ id, label, category, detail, snippet, rank });
  };
  const toolNames = new Map<string, { id: string; label: string; category: string }>();
  for (const family of insertFamilies) {
    const tools = family.id === "insert-figures" ? figureTools(files) : family.tools;
    for (const item of tools) {
      const command = item.snippet.replace(/[{[].*$/s, "").toLowerCase();
      const own = item.id.startsWith("file:");
      if (own) consider(item.id, `\\${item.snippet}`, command, item.label, family.label, item.label, item.snippet);
      else toolNames.set(command, { id: item.id, label: item.label, category: family.label });
    }
  }
  const commands = new Map([...availableCommands(), ...custom].map(command => [command.name, command]));
  for (const command of commands.values()) {
    const tool = toolNames.get(command.name);
    const framework = frameworkCommands.includes(command);
    const source = "category" in command && command.category === "custom" ? "Custom"
      : "package" in command && typeof command.package === "string" ? command.package : framework ? "LabForge" : "Custom";
    const category = tool?.category ?? ("category" in command ? String(command.category).replace(/^./, letter => letter.toUpperCase()) : source);
    const id = tool?.id ?? (source === "Custom" ? `custom:${command.name}` : `std:${command.name}`);
    const text = [command.description, command.syntax, command.example, command.keys.join(" "), source, tool?.label ?? ""].join(" ");
    consider(id, `\\${command.name}`, command.name, text, category, command.description.replace(/;.*$/, ""), command.snippet);
  }
  return hits.sort((a, b) => a.rank - b.rank || a.label.localeCompare(b.label)).map(({ rank: _rank, ...hit }) => hit);
}

/** The report's own commands as a family: a form to define a new one, a jump to the preamble where they live, then each command. */
export function customTools(commands: readonly TexCommand[]): InsertTool[] {
  return [
    { id: "custom:new", label: "New command…", icon: icons.custom, snippet: "" },
    { id: "custom:goto", label: "Go to preamble", icon: icons.open, snippet: "" },
    ...commands.map(command => ({ id: `custom:${command.name}`, label: `\\${command.name}`, icon: icons.custom, snippet: command.snippet })),
  ];
}
