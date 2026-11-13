// Licensed under the GNU General Public License v2 or later. See LICENSE.
// The inspector's Files section: the shell's file tree (`renderFileTree`) with LabForge's rules, which paths are locked,
// which must stay in their folder, where a dropped file goes, and the framework command that places a file in the text.
import { buildTree, moveTarget as shellMoveTarget, renameProblem as shellRenameProblem, renameTarget, renderFileTree, topLevel, type FileSelection, type FileTreeHost, type MoveRules, type TreeFile, type TreeNode } from "forge-shell/app/file-tree";
import type { MenuEntry } from "forge-shell/app/context-menu";
import { isProtectedProjectPath, renameBlockReason } from "../engine/project-paths";
import { supportingFileEditable, supportingTextFile } from "./supporting-file-rules";
import type { FilesSettings } from "./file-settings";
export { filesDefaults, restoreFilesSettings, type FilesSettings } from "./file-settings";
export { buildTree, renameTarget, topLevel, type FileSelection, type TreeNode };

export type FileKind = "folder" | "tex" | "pdf" | "image" | "spreadsheet" | "text" | "other";
export type ProjectFile = { path: string; kind: FileKind; size: number; hidden?: true };

/** What the report class and LabForge find by name keeps its path; main.tex must also stay at the root. */
const reserved = (target: string): string | null => target === "main.tex" ? "main.tex must stay at the project root." : null;

/** Why a path cannot be renamed or moved, shown as its lock. */
export const lockedReason = (path: string): string | null => renameBlockReason(path)?.replace(" cannot be renamed:", " is locked:") ?? null;

/** Why a path cannot be removed. */
export const keepReason = (path: string): string | null => isProtectedProjectPath(path) ? `${path} is part of the report and cannot be removed.` : null;

/** Rules for dragging: locked items stay, and generated plots and tables stay in their folders so regenerate and the preview find them. */
export const moveRules: MoveRules = {
  blocked: from => renameBlockReason(from)?.replace("renamed", "moved") ?? null,
  refuse: (from, folder) => {
    const home = from.split("/")[0];
    return (home === "plots" || home === "tables") && from.includes("/") && folder.split("/")[0] !== home ? `${from} stays in ${home}/ so regenerate and the preview can find it.` : null;
  },
};

/** Why renaming `from` to `target` is refused, or `null`. */
export const renameProblem = (from: string, target: string | null, files: readonly ProjectFile[]): string | null => shellRenameProblem(from, target, files, reserved);

/** The path a dragged item takes when dropped on `folder` ("" is the root), or the reason it cannot move there. */
export const moveTarget = (from: string, folder: string, files: readonly ProjectFile[]) => shellMoveTarget(from, folder, files, { ...moveRules, reserved });

/** Where a file dropped on the tree root goes: images to `graphics/`, anything else stays at the root. */
export function dropFolder(name: string): string {
  const dot = name.lastIndexOf(".");
  const extension = dot > 0 ? name.slice(dot).toLowerCase() : "";
  if ([".png", ".jpg", ".jpeg", ".pdf", ".svg", ".eps", ".gif", ".webp", ".tif", ".tiff"].includes(extension)) return "graphics";
  return "";
}

/** The framework command that places a file from `graphics/`, `plots/` or `tables/` in the text, or `null` for any other file. */
export function insertText(file: ProjectFile): string | null {
  const slash = file.path.indexOf("/");
  if (file.kind === "folder" || slash < 0) return null;
  const folder = file.path.slice(0, slash), name = file.path.slice(slash + 1);
  if (folder === "graphics" && file.kind === "image") return `\\myfigure{${name}}`;
  if (folder === "plots" && file.kind === "tex") return `\\myplot{${name}}`;
  if (folder === "tables" && file.kind === "tex") return `\\mytable{${name}}`;
  return null;
}

/** One \myfigure or \myplot that sets several selected images, or several plots, side by side; `null` for any other selection. */
export function sideBySideText(selected: readonly ProjectFile[]): string | null {
  const texts = selected.map(insertText);
  if (selected.length < 2 || texts.some(text => !text)) return null;
  const command = /^\\(my\w+)\{/.exec(texts[0]!)![1];
  if (command === "mytable" || texts.some(text => !text!.startsWith(`\\${command}{`))) return null;
  return `\\${command}{${selected.map(file => file.path.slice(file.path.indexOf("/") + 1)).join(", ")}}`;
}

/** The class's default label for a plot or table with a caption: its kind and file name, with no folder. */
export function referenceText(file: ProjectFile): string | null {
  const match = /^(plots|tables)\/(.+)\.tex$/.exec(file.path);
  if (!match || file.kind !== "tex") return null;
  return `\\myref{${match[1] === "plots" ? "plot" : "tab"}:${match[2].replace(/^.*\//, "")}}`;
}

/** Copy generated TeX without its private regeneration settings line. */
export function copyableSource(text: string): string {
  return text.split("\n").filter(line => !/^% labforge (?:plot|table) \{.*\}$/.test(line)).join("\n");
}

export interface FileAreaHost {
  /** False on the welcome screen: controls render but do nothing. */
  enabled: boolean;
  settings: FilesSettings;
  /** The rows the user selected, kept across redraws of the inspector. */
  selection: FileSelection;
  /** Folder paths the user collapsed; kept for the session. */
  collapsed: Set<string>;
  open(file: ProjectFile): void;
  reveal(path: string): void;
  /** Delete a file or folder: it goes to the system Trash or Recycle Bin, where it can be recovered. */
  trash(path: string): void;
  add(folder: string): void;
  drop(folder: string, files: File[]): void;
  /** Rename or move `from` to `to` (both project paths). */
  rename(from: string, to: string): void;
  /** Create an empty file or folder in `folder` and return its path. */
  newFile(folder: string): Promise<string | void>;
  newFolder(folder: string): Promise<string | void>;
  /** Copy `from` to the free path `to`. */
  copy(from: string, to: string): void;
  /** Tell the user something about their action (a warning in Messages). */
  warn(text: string): void;
  /** Report a rejected input (an error in Messages and the status bar). */
  problem(text: string): void;
  /** Put text at the editor's cursor. */
  insert(text: string): void;
  /** Read a plot or table file and write text to the system clipboard. */
  readText(path: string): Promise<string>;
  copyText(text: string): Promise<void>;
  notice(text: string): void;
  /** `main.tex` is edited in the center, so clicking it focuses the editor. */
  editMain(): void;
  rerender(): void;
}

/**
 * The Files section: the report's files as the shell's file tree. Showing hidden files is a preference, so it is set in
 * Settings › Files, View › Show hidden files or the Terminal, never here.
 */
export function renderFileArea(section: HTMLElement, files: readonly ProjectFile[], host: FileAreaHost): void {
  const list = document.createElement("div");
  section.append(list);

  // The shell has one icon for text files, so a .tex file is drawn as text; the report's own kind is looked up by path.
  const own = (file: TreeFile) => files.find(item => item.path === file.path)!;
  const tree: TreeFile[] = files.map(file => ({ path: file.path, kind: file.kind === "tex" ? "text" : file.kind, size: file.size, ...(file.hidden ? { hidden: true as const } : {}) }));
  const copy = (value: string | Promise<string>, message: string): void => {
    void Promise.resolve(value).then(text => host.copyText(text)).then(() => host.notice(message)).catch(error => host.problem(`Could not copy: ${error instanceof Error ? error.message : String(error)}`));
  };
  const treeHost: FileTreeHost = {
    enabled: host.enabled, showHidden: host.settings.showHidden,
    selection: host.selection, collapsed: host.collapsed, label: "Project files", dragType: "application/x-labforge-path",
    open: file => host.open(own(file)), activate: file => (file.path === "main.tex" ? host.editMain() : host.open(own(file))),
    reveal: host.reveal, trash: host.trash, add: host.add, drop: host.drop, rename: host.rename, warn: host.warn, problem: host.problem, rerender: host.rerender,
    newFile: host.newFile, newFolder: host.newFolder, copy: host.copy,
    lockedReason, keepReason, reserved, moveRules, dropFolder,
    menu: (file): MenuEntry[] => {
      const item = own(file), text = insertText(item);
      return text && !referenceText(item) ? [{ label: "Insert in editor", action: () => host.insert(text) }] : [];
    },
    contextMenu: target => {
      if (target.paths.length > 1) {
        const selected = target.paths.map(path => files.find(item => item.path === path)).filter((item): item is ProjectFile => !!item);
        const row = selected.length === target.paths.length ? sideBySideText(selected) : null;
        return row ? [{ label: "Insert side by side", title: "Sets the selected files in one row under one caption.", action: () => host.insert(row) }] : [];
      }
      if (!target.file || target.paths.length !== 1) return [];
      const file = own(target.file), insertion = insertText(file), reference = referenceText(file);
      if (!insertion || !reference) return [];
      return [
        { label: "Insert in editor", action: () => host.insert(insertion) },
        { label: "Copy insertion command", action: () => copy(insertion, `Copied the insertion command for ${file.path}.`) },
        { label: "Copy reference", title: "Works after insertion with a caption. Use the value of label= instead if you changed the default label.", action: () => copy(reference, `Copied the default reference for ${file.path}.`) },
        { label: "Copy TeX source", action: () => copy(host.readText(file.path).then(copyableSource), `Copied the TeX source of ${file.path}.`) },
      ];
    },
    // Every file shows its status: main.tex and the editable supporting files can be edited here; the rest are read-only.
    status: file => (file.path === "main.tex" || (supportingTextFile(file.path) && supportingFileEditable(file.path)) ? "editable" : "readOnly"),
    moved: from => { if (from.startsWith("graphics/")) host.warn(`${from} moved. A \\myfigure line that names it needs the new path.`); },
  };
  renderFileTree(list, tree, treeHost);
}
