// Licensed under the GNU General Public License v2 or later. See LICENSE.
// The inspector's Outline: the report's headings and numbered blocks as rows of the shell's file list, numbered as
// the PDF prints them. The row of the block the cursor is in is selected; a click puts the cursor there.
import { setTip } from "forge-shell/app/tips";
import type { IndexEntry, SourceIndex } from "./source-index";

const kindWords: Record<string, { greek: string; english: string }> = {
  figure: { greek: "Σχήμα", english: "Figure" }, plot: { greek: "Σχήμα", english: "Figure" }, table: { greek: "Πίνακας", english: "Table" },
  formula: { greek: "Σχέση", english: "Equation" }, reaction: { greek: "Αντίδραση", english: "Reaction" }, equation: { greek: "Εξίσωση", english: "Equation" },
};

/** The entry the cursor is in, or the last one before it. */
export function currentEntry(index: SourceIndex, offset: number): IndexEntry | undefined {
  let found: IndexEntry | undefined;
  for (const entry of index.entries) if (entry.from <= offset) found = entry; else break;
  return found;
}

/** Draw the outline into `host`. `pick` receives the offset of a chosen row's command. */
export function renderOutline(host: HTMLElement, index: SourceIndex | null, offset: number, language: "greek" | "english", pick: (offset: number) => void): void {
  const list = document.createElement("div");
  list.className = "file-list outline-list";
  list.setAttribute("role", "tree");
  list.setAttribute("aria-label", "Outline");
  const entries = index?.entries ?? [];
  if (!entries.length) {
    const empty = document.createElement("div");
    empty.className = "outline-empty";
    empty.textContent = index ? "No headings or numbered blocks yet." : "No report open.";
    host.replaceChildren(empty);
    return;
  }
  const current = currentEntry(index!, offset);
  // Blocks sit one step under the heading before them.
  let depth = 0;
  for (const entry of entries) {
    if (entry.kind === "section") depth = entry.level - 1;
    const row = document.createElement("button");
    row.type = "button";
    row.className = `tree-row outline-row outline-${entry.kind}`;
    row.setAttribute("role", "treeitem");
    row.style.setProperty("--depth", String(entry.kind === "section" ? depth : depth + 1));
    if (entry === current) { row.classList.add("selected"); row.setAttribute("aria-selected", "true"); }
    const number = document.createElement("span");
    number.className = "outline-number";
    const word = kindWords[entry.kind]?.[language];
    number.textContent = entry.kind === "section" ? entry.number : entry.number ? `${word} ${entry.number}` : word ?? "";
    const title = document.createElement("span");
    title.className = "outline-title";
    // A formula's TeX is long and unreadable here; its label names it better.
    title.textContent = (entry.kind === "formula" || entry.kind === "reaction" || entry.kind === "equation") && entry.label ? entry.label : entry.title;
    row.append(number, title);
    setTip(row, entry.label ? `${entry.title} (${entry.label})` : entry.title);
    row.addEventListener("click", () => pick(entry.from));
    list.append(row);
  }
  host.replaceChildren(list);
  list.querySelector<HTMLElement>(".selected")?.scrollIntoView({ block: "nearest" });
}
