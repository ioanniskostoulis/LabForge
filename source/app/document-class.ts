// Licensed under the GNU General Public License v2 or later. See LICENSE.
// Reads and rewrites the options of the `\documentclass[…]{.labforge}` line in main.tex, which the
// Builder section and the Terminal's document commands edit. Other options and their order are kept.

export const presets = ["default", "report", "thesis"] as const;
export const languages = ["greek", "english"] as const;
/** The sizes of extarticle, the class that labforge builds on. */
export const fontSizes = ["8pt", "9pt", "10pt", "11pt", "12pt", "14pt", "17pt", "20pt"] as const;

export type ClassOptions = { preset: string; language: string; fontsize: string; bibliography: boolean };
/** The class's own defaults, used when an option is left out of the line. */
export const classDefaults: ClassOptions = { preset: "default", language: "greek", fontsize: "10pt", bibliography: false };

/** Names declared by a report's .settings.tex, in file order. Comments do not define presets. */
export function presetNames(settings: string): string[] {
  const code = settings.split("\n").map(line => line.replace(/(^|[^\\])%.*$/, "$1")).join("\n");
  return [...new Set(["default", ...[...code.matchAll(/\\labforgepreset\s*\{\s*([a-zA-Z][a-zA-Z0-9_-]*)\s*\}\s*\{/g)].map(match => match[1])])];
}

/** The key list of one named style; empty when absent. Braced values may contain nested groups. */
export function presetValues(settings: string, name: string): string {
  const code = settings.split("\n").map(line => line.replace(/(^|[^\\])%.*$/, "$1")).join("\n");
  const open = new RegExp(`\\\\labforgepreset\\s*\\{\\s*${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\}\\s*\\{`, "g").exec(code);
  if (!open) return "";
  let depth = 1;
  const start = open.index + open[0].length;
  for (let index = start; index < code.length; index++) {
    if (code[index] === "{" && code[index - 1] !== "\\") depth++;
    if (code[index] === "}" && code[index - 1] !== "\\" && --depth === 0) return code.slice(start, index);
  }
  return "";
}

type Entry = { key: string; value: string | null };
type ClassLine = { from: number; to: number; className: string; entries: Entry[] };

const linePattern = /\\documentclass\s*(?:\[([^\]]*)\])?\s*\{(\.?labforge)\}/;

function findLine(text: string): ClassLine | null {
  // Only a class line outside a comment counts.
  let offset = 0;
  for (const line of text.split("\n")) {
    const code = line.replace(/(^|[^\\])%.*$/, "$1");
    const match = linePattern.exec(code);
    if (match) {
      const entries = (match[1] ?? "").split(",").map(part => part.trim()).filter(Boolean).map(part => {
        const equals = part.indexOf("=");
        return equals < 0 ? { key: part, value: null } : { key: part.slice(0, equals).trim(), value: part.slice(equals + 1).trim() };
      });
      return { from: offset + match.index, to: offset + match.index + match[0].length, className: match[2], entries };
    }
    offset += line.length + 1;
  }
  return null;
}

/** The options of main.tex's LabForge class line, or null when main.tex does not use the class. */
export function readClassOptions(text: string): ClassOptions | null {
  const line = findLine(text);
  if (!line) return null;
  const value = (key: string): string | undefined => line.entries.find(entry => entry.key === key)?.value ?? undefined;
  const bibliography = line.entries.find(entry => entry.key === "bibliography");
  return {
    preset: value("preset") === "none" ? "default" : value("preset") ?? classDefaults.preset,
    language: value("language") ?? classDefaults.language,
    fontsize: value("fontsize") ?? classDefaults.fontsize,
    bibliography: bibliography ? bibliography.value === null || bibliography.value === "true" : classDefaults.bibliography,
  };
}

/** The change that applies `patch` to the class line, or null when there is no line or nothing changes. */
export function classLineChange(text: string, patch: Partial<ClassOptions>): { from: number; to: number; insert: string } | null {
  const line = findLine(text);
  if (!line) return null;
  const entries = line.entries.map(entry => ({ ...entry }));
  const set = (key: string, value: string) => {
    const entry = entries.find(item => item.key === key);
    if (entry) entry.value = value;
    else if (value !== classDefaults[key as "preset" | "language" | "fontsize"]) entries.push({ key, value });
  };
  if (patch.preset !== undefined) set("preset", patch.preset);
  if (patch.language !== undefined) set("language", patch.language);
  if (patch.fontsize !== undefined) set("fontsize", patch.fontsize);
  if (patch.bibliography !== undefined) {
    const index = entries.findIndex(entry => entry.key === "bibliography");
    if (patch.bibliography) {
      if (index < 0) entries.push({ key: "bibliography", value: null });
      else entries[index].value = null;
    }
    else if (index >= 0) entries.splice(index, 1);
  }
  const options = entries.map(entry => entry.value === null ? entry.key : `${entry.key}=${entry.value}`).join(", ");
  const insert = options ? `\\documentclass[${options}]{${line.className}}` : `\\documentclass{${line.className}}`;
  return insert === text.slice(line.from, line.to) ? null : { from: line.from, to: line.to, insert };
}
