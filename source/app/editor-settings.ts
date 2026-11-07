// Licensed under the GNU General Public License v2 or later. See LICENSE.

/** Editor options kept as one app preference object (`editor` in `labforge.settings`). */
export type EditorSettings = {
  wrap: boolean;
  autoClose: boolean;
  bracketColors: boolean;
  bracketDimmed: boolean;
  smoothBlink: boolean;
  smoothCaret: boolean;
  minimap: boolean;
  cursorMargin: boolean;
  selectionWhitespace: boolean;
  activeLine: boolean;
  spellcheck: boolean;
  mathPreview: boolean;
  commandLanguage: boolean;
  trimSave: boolean;
  /** Long options and references shown as summaries while the cursor is elsewhere (code-summaries.ts). Switched off for now: not offered as an option, so it stays false. */
  summaries: boolean;
  tabSize: TabSize;
};
export type EditorToggle = Exclude<keyof EditorSettings, "tabSize">;
export type TabSize = typeof tabSizes[number];

export const tabSizes = [2, 4, 8] as const;

export const editorDefaults: EditorSettings = {
  wrap: true, autoClose: true, bracketColors: true, bracketDimmed: false, smoothBlink: true, smoothCaret: false, minimap: false,
  cursorMargin: true, selectionWhitespace: true, activeLine: true, spellcheck: false, mathPreview: false, commandLanguage: false, trimSave: false, summaries: false, tabSize: 4,
};

/**
 * Each option's Terminal name and its label in View › Editor and in Terminal listings. Options of one family share a command: `brackets dimmed on`,
 * `caret blink off`. Options without a family are commands of their own (`wrap off`).
 */
export const editorFamilies = [
  { name: "brackets", label: "Brackets" },
  { name: "caret", label: "Caret" },
  { name: "highlight", label: "Highlight" },
] as const;
export type EditorFamily = typeof editorFamilies[number]["name"];

type ToggleSpec = { key: EditorToggle; name: string; label: string; family?: EditorFamily };
export const editorToggles: readonly ToggleSpec[] = [
  { key: "wrap", name: "wrap", label: "Word wrap" },
  { key: "minimap", name: "minimap", label: "Minimap" },
  { key: "spellcheck", name: "spellcheck", label: "Spell check" },
  { key: "mathPreview", name: "mathpreview", label: "Math preview" },
  { key: "commandLanguage", name: "commandlanguage", label: "English input for LaTeX commands" },
  { key: "trimSave", name: "trimsave", label: "Trim trailing whitespace on save" },
  { key: "bracketColors", name: "brackets colored", family: "brackets", label: "Bracket pair colors" },
  { key: "bracketDimmed", name: "brackets dimmed", family: "brackets", label: "Dimmed brackets" },
  { key: "autoClose", name: "brackets autoclose", family: "brackets", label: "Auto-close brackets and environments" },
  { key: "smoothBlink", name: "caret blink", family: "caret", label: "Smooth cursor blinking" },
  { key: "smoothCaret", name: "caret smooth", family: "caret", label: "Smooth caret" },
  { key: "cursorMargin", name: "caret margin", family: "caret", label: "Keep cursor in view while typing" },
  { key: "activeLine", name: "highlight line", family: "highlight", label: "Current line highlight" },
  { key: "selectionWhitespace", name: "highlight whitespace", family: "highlight", label: "Whitespace in selection" },
];

/** Options with a fixed set of values. */
type ChoiceSpec = { key: "tabSize"; name: string; label: string; family?: EditorFamily; values: readonly string[]; comment: string; show: (value: string) => string; set: (value: string) => string };
export const editorChoices: readonly ChoiceSpec[] = [
  { key: "tabSize", name: "tabsize", label: "Tab size", values: tabSizes.map(String), comment: "Tab size in spaces",
    show: value => `Tab size is ${value} spaces.`, set: value => `Tab size set to ${value} spaces.` },
];

/** Every Terminal name an editor option answers to: the command words that start `editor` forms and are commands of their own. */
export const editorVerbs: readonly string[] = [...new Set([...editorToggles, ...editorChoices].map(item => item.family ?? item.name))];
const familyOptions = (family: string) => [...editorToggles, ...editorChoices].filter(item => item.family === family);
const subName = (item: { name: string; family?: string }) => item.family ? item.name.slice(item.family.length + 1) : item.name;

/** Overlay stored values on the defaults; a missing or invalid value keeps its default. `legacyWrap` is the earlier top-level `editorWrap`. */
export function restoreEditorSettings(stored: unknown, legacyWrap?: unknown): EditorSettings {
  const source = stored && typeof stored === "object" ? stored as Record<string, unknown> : {};
  const settings = { ...editorDefaults };
  for (const { key } of editorToggles) if (typeof source[key] === "boolean") settings[key] = source[key] as boolean;
  if (typeof source.wrap !== "boolean" && typeof legacyWrap === "boolean") settings.wrap = legacyWrap;
  if (tabSizes.includes(source.tabSize as TabSize)) settings.tabSize = source.tabSize as TabSize;
  // The earlier "Bracket style: grey scale" choice is now the dimmed option.
  if (source.bracketStyle === "grey" && typeof source.bracketDimmed !== "boolean") { settings.bracketDimmed = true; settings.bracketColors = false; }
  return settings;
}

type ListItem = { label: string; comment: string; enabled?: boolean; marker?: string };
export type EditorCommandResult = { lines: (string | ListItem)[]; patch?: Partial<EditorSettings> };

const listItem = (item: ToggleSpec | ChoiceSpec, settings: EditorSettings): ListItem => "values" in item
  ? { marker: `[${settings[item.key]}]`, label: item.name, comment: item.comment }
  : { marker: settings[item.key] ? "[on]" : "[off]", enabled: settings[item.key], label: item.name, comment: item.label };

/**
 * `editor`, `editor <option> [value]` and, with the family as the command, `brackets`, `brackets dimmed on`, `caret blink off`.
 * A family alone lists its options. Returns `null` for invalid arguments.
 */
export function editorCommand(args: readonly string[], settings: EditorSettings): EditorCommandResult | null {
  if (!args.length) return { lines: [...editorToggles, ...editorChoices].map(item => listItem(item, settings)) };
  const words = args.map(arg => arg.toLowerCase());
  const family = editorFamilies.some(item => item.name === words[0]) ? words[0] : undefined;
  if (family && words.length === 1) return { lines: familyOptions(family).map(item => listItem(item, settings)) };
  const name = family ? `${words[0]} ${words[1]}` : words[0];
  const value = words[family ? 2 : 1];
  if (words.length > (family ? 3 : 2)) return null;
  const choice = editorChoices.find(item => item.name === name);
  if (choice) {
    if (value === undefined) return { lines: [choice.show(String(settings[choice.key]))] };
    if (!choice.values.includes(value)) return null;
    return { lines: [choice.set(value)], patch: { [choice.key]: choice.key === "tabSize" ? Number(value) : value } as Partial<EditorSettings> };
  }
  const toggle = editorToggles.find(item => item.name === name);
  if (!toggle) return null;
  if (value === undefined) return { lines: [`${toggle.label} is ${settings[toggle.key] ? "on" : "off"}.`] };
  if (value !== "on" && value !== "off") return null;
  const on = value === "on";
  if (settings[toggle.key] === on) return { lines: [`${toggle.label} is already ${value}.`] };
  return { lines: [`${toggle.label} ${on ? "enabled" : "disabled"}.`], patch: { [toggle.key]: on } };
}

/** Tab completion for the `editor` verb and the family commands (`editor brackets di`, which the caller may also pass without `editor`). */
export function editorCompletions(line: string): string[] {
  const parts = line.split(" ");
  if (parts.length === 2) return [...editorVerbs.map(name => `editor ${name}`)].filter(item => item.startsWith(line));
  const family = editorFamilies.some(item => item.name === parts[1]);
  if (parts.length === 3) {
    const choices = family ? familyOptions(parts[1]).map(subName) : valuesOf(parts[1]);
    return choices.map(choice => `editor ${parts[1]} ${choice}`).filter(item => item.startsWith(line));
  }
  if (parts.length === 4 && family) return valuesOf(`${parts[1]} ${parts[2]}`).map(choice => `editor ${parts[1]} ${parts[2]} ${choice}`).filter(item => item.startsWith(line));
  return [];
}

/** The values an option takes: on and off for a toggle, its own list for a choice, none for an unknown name. */
export function valuesOf(name: string): string[] {
  const choice = editorChoices.find(item => item.name === name);
  if (choice) return [...choice.values];
  return editorToggles.some(item => item.name === name) ? ["on", "off"] : [];
}

/** The option names a family takes as its first argument, without the family word. */
export const familyArguments = (family: string): string[] => familyOptions(family).map(subName);
