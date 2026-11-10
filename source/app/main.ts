// Licensed under the GNU General Public License v2 or later. See LICENSE.
import { DocumentTabs } from "forge-shell/app/tabs";
import { attachFileDrop } from "forge-shell/app/file-drop";
import { createButton, createButtonGroup, createCheckRow, createField, createRow } from "forge-shell/app/builders";
import { createBottomTabs } from "forge-shell/app/bottom-tabs";
import { createPanelLayout } from "forge-shell/app/panel-layout";
import { createToolStrip } from "forge-shell/app/tool-strip";
import { StatusBar } from "forge-shell/app/status-bar";
import { ConditionWatch, MessageLog, MessagesPanel, type MessageKind } from "forge-shell/app/messages";
import { TerminalPanel, type ConsoleResult } from "forge-shell/app/terminal";
import { createSettingsStore } from "forge-shell/app/settings";
import { InspectorSections, SECTION_CHEVRON } from "forge-shell/app/inspector-sections";
import { createEmptyState } from "forge-shell/app/empty-state";
import { showContextMenu, showFieldPopover } from "forge-shell/app/context-menu";
import { shellPreferenceCommand } from "forge-shell/app/shell-preferences";
import { setTip } from "forge-shell/app/tips";
import { attachRename, validateName } from "forge-shell/app/rename";
import { applyDesktopClasses } from "forge-shell/app/desktop-classes";
import { commandHelp, generalHelp, helpAlias, invalidUsage } from "forge-shell/app/command-help";
import { ACTIONS, PANES, availableOnWelcome, commands, findCommand, firstArguments, helpCatalog, shared } from "./commands";
import { runSharedCommand } from "forge-shell/app/shared-commands";
import { askExternalChange, externalAction } from "forge-shell/app/external-change";
import { classLineChange, fontSizes, presetNames, readClassOptions, type ClassOptions } from "./document-class";
import { renderMenubar, matchesKey, collectShortcuts, drawsMenubar, shortcutText, titleBarColors, type MenuNode } from "forge-shell/app/menus";
import { newEntryName } from "forge-shell/app/file-tree";
import { moveItem } from "forge-shell/app/content-selection";
import { askToChoose, askToSave } from "forge-shell/app/dialogs";
import { exportFiles, type ExportBridge } from "forge-shell/app/export-files";
import type { ExportFormat } from "forge-shell/app/export-plan";
import { TOOL_ICONS, UI_ICONS } from "forge-shell/app/tool-icons";
import { createFlyoutGroup } from "forge-shell/app/tool-flyout";
import { createToolSearch } from "forge-shell/app/tool-search";
import { createSelectControl } from "forge-shell/app/select-control";
import { customTools, figureTools, insertFamilies, searchCommands, type InsertTool } from "./insert-tools";
import { commandDefinition, commandProblem, parseCustomCommands } from "./tex-commands";
import { addToPreamble } from "../engine/preamble";
import { findFrameworkCommand, getCustomCommands, latexHelp, setCustomCommands, setReportPackageSource } from "./framework-commands";
import { settingsStorageKey, terminalHistoryStorageKey } from "forge-shell/app/profile";
import { createAutosave, createRecovery, askToRecover, type AutosaveChoice } from "forge-shell/app/saving";
import { createHealthTracker, healthCommand, healthPage, type HealthTracker } from "forge-shell/app/health";
import { forgeApp } from "./profile";
import { infoOptions, showAbout, showLicenses, showWritingHelper } from "./about";
import { menuShortcutGroups, showShortcuts, showWhatsNew } from "forge-shell/app/about";
import { showUpdateNotice, type InstallResult, type ReleaseAsset } from "forge-shell/app/updates";
import { generalPage, showSettings, terminalPage, updatesPage, type SettingsPage } from "forge-shell/app/settings-dialog";
import { createRecentFiles } from "forge-shell/app/saving";
import { menuForState, type MenuState } from "./menu-definition";
import { PdfViewer } from "./pdf-viewer";
import type { PdfView } from "./pdf-stage";
import { filesDefaults, renderFileArea, restoreFilesSettings, type FilesSettings, type ProjectFile } from "./file-browser";
import { LatexEditor, bracketDepths, latexRuns, setCitationSource } from "./latex-editor";
import { flashLine } from "./line-flash";
import { entryAt, indexSource, labelAt, referenceProblems, renameLabel, targetAt, type CodeTarget, type SourceIndex } from "./source-index";
import { renderOutline } from "./outline";
import { renderBlockForm, type BlockEdit } from "./block-form";
import { applyFindTips, type FindBar } from "forge-shell/app/find-bar";
import { editorCommand, editorCompletions, editorDefaults, editorFamilies, editorToggles, editorVerbs, restoreEditorSettings, type EditorSettings, type EditorToggle, type TabSize } from "./editor-settings";
import type { EditorState } from "@codemirror/state";
import { redo as redoSupporting, selectAll as selectAllSupporting, undo as undoSupporting } from "@codemirror/commands";
import { SupportingViews, type SupportingView } from "./supporting-views";
import { supportingTextFile } from "./supporting-file-rules";
import { tableColumns, type GeneratorSettings } from "../engine/generators";
import type { PreviewResult } from "./generator-preview";
import type { BuildDiagnostic } from "../engine/tex-diagnostics";
import { GeneratorPane, type GeneratorHost } from "./generator-pane";
import { codeShare, optionsShare, restoreShare } from "./generator-layout";
import { includeLine } from "./generator-form";
import { isDataSpreadsheet } from "../engine/project-paths";
import { smartOn } from "../engine/smart-formatting";
import { findGenerated, listingComment, plotDefaults, plotFromArguments, readPlotDefaults, setPlotDefault, tableFromArguments, type GeneratedListing } from "./generator-commands";

declare const __FORGE_VERSION__: string;
declare const __LABFORGE_LOGO__: string;
declare const __LABFORGE_WELCOME__: string;

type ProjectBuilder = "xelatex" | "pdflatex" | "lualatex";
type Snapshot = { id: string; name: string; projectName: string; builder: ProjectBuilder; archive: string | null; files: ProjectFile[]; inputs: string[]; presets: string[]; hasPdf: boolean; building: boolean; pdfStale: boolean; staleGenerated?: string[] };
type ProjectView = Snapshot & { path: string | null; dirty: boolean; text: string; revision: number; pdfBuiltRevision: number; /** What main.tex held when LabForge last read or wrote it. */ diskText: string; asking: boolean; loaded: boolean; editorState: EditorState | null; pdfOpen: boolean; pdfWidth: number; pdfView: PdfView | null; pdfBuildState: "idle" | "succeeded" | "failed"; buildProblem: string; logs: MessageLog };
type Api = {
  platform: string; preview?: boolean;
  listOpen(): Promise<Snapshot[]>; create(): Promise<Snapshot | null>; open(): Promise<string[]>; activate(id: string): Promise<Snapshot>;
  /** Whether a path is an older ZIP report that needs the in-page conversion choice. */
  isLegacyArchive?(file: string): Promise<boolean>;
  /** Open a report by its path after the in-page legacy conversion choice. Desktop only. */
  openPath?(file: string, convertLegacy?: boolean): Promise<Snapshot | null>;
  onOpenRequest?(callback: (file: string) => void): void;
  /** The path on disk of a file dropped on the window (Electron's `webUtils`). Desktop only. */
  pathForFile?(file: File): string;
  /** Download and install an update, then restart into it (the shell's `registerUpdater`). Desktop only. */
  installUpdate?(asset: ReleaseAsset): Promise<InstallResult>;
  onUpdateProgress?(listener: (progress: { done: number; total: number }) => void): void;
  exportZipBytes?(id: string): Promise<Uint8Array>;
  exportDialog?(name: string, formats?: readonly string[]): Promise<string | null>;
  exportFolder?(title?: string): Promise<{ folder: string; names: string[] } | null>;
  exportFolderNames?(path: string): Promise<string[]>;
  writeExport?(path: string, bytes: Uint8Array, originals?: readonly string[], replace?: boolean): Promise<void>;
  save(id: string): Promise<Snapshot | null>; configure(id: string, patch: { name?: string; builder?: ProjectBuilder }): Promise<Snapshot>; close(id: string): Promise<boolean>; files(id: string): Promise<ProjectFile[]>;
  read(id: string, file: string): Promise<string>; write(id: string, file: string, content: string): Promise<Snapshot>;
  copyText(text: string): Promise<void>;
  misspelledWords?(words: string[]): Promise<string[]>;
  wordSuggestions?(word: string): Promise<string[]>;
  addWord?(word: string): Promise<void>;
  ignoreWord?(word: string): Promise<void>;
  commandInputSource(action: "begin" | "restore"): boolean;
  commandInputContext(active: boolean): void;
  rename(id: string, from: string, to: string): Promise<Snapshot>; add(id: string, folder: string): Promise<Snapshot>;
  mkdir(id: string, folder: string): Promise<Snapshot>; copy(id: string, from: string, to: string): Promise<Snapshot>;
  /** Recolour the Windows window controls beside the drawn menu bar. */
  setTitleBar?(colors: { color: string; symbolColor: string }): void;
  addDropped(id: string, folder: string, files: File[]): Promise<Snapshot>;
  /** SyncTeX: the source line at a point of the PDF, and the boxes a line was set in. Desktop only. */
  sourceAt?(id: string, page: number, x: number, y: number): Promise<{ file: string; line: number } | null>;
  pdfAt?(id: string, file: string, line: number): Promise<{ page: number; left: number; top: number; width: number; height: number }[]>;
  external(id: string, file: string): Promise<void>; reveal(id: string, file: string): Promise<void>; trash(id: string, file: string): Promise<Snapshot>; contents(id: string): Promise<void>; pdf(id: string): Promise<string | null>; build(id: string): Promise<{ success: boolean; summary: string; hasPdf: boolean; stale: boolean; diagnostics: string[]; issues: BuildDiagnostic[]; cancelled?: boolean }>; cancelBuild(id: string): Promise<boolean>; checkTex(builder: ProjectBuilder): Promise<{ ok: boolean; missing: string[]; message: string; url: string }>; openLink(url: string): Promise<void>;
  onOpened(callback: (project: Snapshot) => void): void; onChanged(callback: (project: Snapshot) => void): void;
  onError(callback: (id: string, error: string) => void): void;
  onCommand(callback: (id: string) => void): void; onCloseRequest(callback: () => void): void; closeReady(): void; closeCancel(): void;
  onFullScreen(callback: (on: boolean) => void): void;
  updateMenuState(state: MenuState): void;
  generated(id: string, kind: "plot" | "table"): Promise<GeneratedListing[]>; regenerate(id: string, files: string[]): Promise<{ file: string; changed?: boolean; error?: string }[]>;
  previewGenerated(id: string, kind: "plot" | "table", code: string, keys?: string): Promise<PreviewResult>;
  pickSpreadsheet(id: string): Promise<string | null>; sheets(id: string, source: string): Promise<string[]>; generatedCode(id: string, settings: GeneratorSettings): Promise<string>;
  saveGenerated(id: string, kind: "plot" | "table", code: string, source?: string): Promise<string>;
  createGenerated(id: string, settings: GeneratorSettings): Promise<string>; rewriteGenerated(id: string, file: string, settings: GeneratorSettings): Promise<void>;
};
declare global { interface Window { labforge?: Api } }

function browserAdapter(): Api {
  const sample = new Map<string, { snapshot: Snapshot; text: string; others: Map<string, string> }>();
  const make = async (): Promise<Snapshot> => {
    const id = crypto.randomUUID();
    let number = 1;
    while ([...sample.values()].some(item => item.snapshot.name === `Untitled ${number}`)) number++;
    const response = await fetch("report-main.tex");
    if (!response.ok) throw new Error("The LabForge TeX template is unavailable.");
    const tex = await response.text();
    const settingsResponse = await fetch("report-settings.tex");
    if (!settingsResponse.ok) throw new Error("The LabForge styles template is unavailable.");
    const settings = await settingsResponse.text();
    const [classResponse, bibliographyResponse] = await Promise.all([fetch("report-class.cls"), fetch("report-references.bib")]);
    if (!classResponse.ok || !bibliographyResponse.ok) throw new Error("The LabForge report files are unavailable.");
    const reportClass = await classResponse.text();
    const bibliography = await bibliographyResponse.text();
    const metadata = JSON.stringify({ name: `Untitled ${number}`, builder: "xelatex" }, null, 2) + "\n";
    const latexmk = "# LabForge build settings, read by latexmk.\n$pdf_mode = 5;\n$aux_dir = '.build';\n$out_dir = '.';\n";
    const snapshot: Snapshot = { id, name: `Untitled ${number}`, projectName: `Untitled ${number}`, builder: "xelatex", archive: null, inputs: [], files: [{ path: ".labforge.json", kind: "other", size: metadata.length, hidden: true }, { path: ".latexmkrc", kind: "other", size: latexmk.length, hidden: true }, { path: ".labforge.cls", kind: "text", size: reportClass.length, hidden: true }, { path: "main.tex", kind: "tex", size: tex.length }, { path: ".settings.tex", kind: "tex", size: settings.length, hidden: true }, ...["graphics", "plots", "tables"].map(folder => ({ path: folder, kind: "folder" as const, size: 0 })), { path: "references.bib", kind: "text", size: bibliography.length }], presets: presetNames(settings), hasPdf: false, building: false, pdfStale: false };
    sample.set(id, { snapshot, text: tex, others: new Map([[".settings.tex", settings], [".labforge.cls", reportClass], [".labforge.json", metadata], [".latexmkrc", latexmk], ["references.bib", bibliography]]) });
    return snapshot;
  };
  const unavailable = () => { throw new Error("This action needs the LabForge desktop app."); };
  return { platform: navigator.platform.includes("Mac") ? "darwin" : "browser", preview: true,
    async listOpen() { return []; }, async create() { return make(); }, async open() { return []; },
    async activate(id) { return sample.get(id)!.snapshot; }, async save() { return unavailable(); },
    async configure(id, patch) {
      const item = sample.get(id)!;
      const snapshot = item.snapshot;
      if (patch.name) snapshot.projectName = snapshot.name = patch.name;
      if (patch.builder) snapshot.builder = patch.builder;
      item.others.set(".labforge.json", JSON.stringify({ name: snapshot.name, builder: snapshot.builder }, null, 2) + "\n");
      return snapshot;
    },
    async close(id) { return sample.delete(id); }, async files(id) { return sample.get(id)!.snapshot.files; },
    async read(id, file) { const item = sample.get(id)!; if (file === "main.tex") return item.text; const text = item.others.get(file); if (text === undefined) throw new Error(`${file} is not in this report.`); return text; },
    async copyText(text) { await navigator.clipboard.writeText(text); },
    commandInputSource() { return false; },
    commandInputContext() {},
    async write(id, file, text) {
      const item = sample.get(id)!;
      if (file === "main.tex") item.text = text;
      else { item.others.set(file, text); if (!item.snapshot.files.some(entry => entry.path === file)) item.snapshot.files = [...item.snapshot.files, { path: file, kind: "tex", size: text.length }]; else item.snapshot.files = item.snapshot.files.map(entry => entry.path === file ? { ...entry, size: text.length } : entry); if (file === ".settings.tex") item.snapshot.presets = presetNames(text); }
      return item.snapshot;
    },
    async rename() { return unavailable(); }, async mkdir() { return unavailable(); }, async copy() { return unavailable(); }, async add() { return unavailable(); }, async addDropped() { return unavailable(); }, async external() { return unavailable(); }, async reveal() { return unavailable(); }, async trash() { return unavailable(); }, async contents() { return unavailable(); },
    async pdf() { return null; }, async build() { return unavailable(); }, async cancelBuild() { return false; }, async checkTex() { return new URLSearchParams(location.search).has("tex-missing") ? { ok: false, missing: ["latexmk", "xelatex", "biber"], message: "TeX is not fully installed (missing: latexmk, xelatex, biber), so PDFs cannot be built. Editing and saving still work. Install a TeX distribution from https://tug.org/mactex/, restart LabForge, then build again. The smaller BasicTeX also works, with latexmk and biber added through tlmgr.", url: "https://tug.org/mactex/" } : { ok: true, missing: [], message: "", url: "" }; }, async openLink() {},
    async generated() { return []; }, async regenerate() { return unavailable(); }, async previewGenerated() { return unavailable(); }, async pickSpreadsheet() { return null; }, async sheets() { return []; }, async generatedCode() { return unavailable(); }, async saveGenerated() { return unavailable(); }, async createGenerated() { return unavailable(); }, async rewriteGenerated() { return unavailable(); }, onOpened() {}, onChanged() {}, onError() {}, onFullScreen() {}, onCommand() {}, onCloseRequest() {}, closeReady() {}, closeCancel() {}, updateMenuState() {} };
}
const api = window.labforge ?? browserAdapter();
/** Menus, tips and the Shortcuts dialog name the keys of this platform (the browser preview on a Mac counts as macOS). */
const isMac = api.platform === "darwin";
/** Reports opened or saved lately, for File › Open recent (desktop). */
const recentReports = createRecentFiles(`${settingsStorageKey(forgeApp)}.recent`);
function rememberReport(value: Snapshot): void {
  if (api.preview || !value.archive) return;
  recentReports.add(value.archive);
  refreshMenu();
}
const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
const projects: ProjectView[] = [];
let active: ProjectView | null = null;
/** True while an outside change is being put into the editor, or a saved fold is being restored: neither is a user edit. */
let importing = false;
let statusTimer: number | undefined;
let editorSize = 14;
let terminal: TerminalPanel;
let status: StatusBar;
let tabs: DocumentTabs<ProjectView>;
/** Pane names are lowercase: the shell's CSS matches `data-tab="terminal"` and `data-active="messages"`, and shows them in capitals. */
let selectBottom: (name: "terminal" | "tables" | "plots" | "messages") => void;
let applyLayout: () => void;
let generatorPanes: GeneratorPane[] = [];
/** The report the Plots and Tables panes show. */
let paneProject: string | null = null;
const inspectorSections: Record<"builder" | "files", boolean> = { builder: true, files: true };
/** Tree view folders the user collapsed, per report, for this session. */
const collapsedFolders = new Map<string, Set<string>>();
/** The selected row of the Files tree, per report. */
const selectedFiles = new Map<string, { path: string | null }>();
const findBar: FindBar = {
  root: $("editor-find"), find: $<HTMLInputElement>("editor-find-input"), replace: $<HTMLInputElement>("editor-replace-input"), replaceRow: $("editor-replace-row"), replaceToggle: $<HTMLButtonElement>("editor-replace-toggle"),
  count: $("editor-find-count"), caseSensitive: $<HTMLButtonElement>("editor-find-case"), wholeWord: $<HTMLButtonElement>("editor-find-word"), regexp: $<HTMLButtonElement>("editor-find-regexp"),
  previous: $<HTMLButtonElement>("editor-find-previous"), next: $<HTMLButtonElement>("editor-find-next"), close: $<HTMLButtonElement>("editor-find-close"),
  replaceOne: $<HTMLButtonElement>("editor-replace-one"), replaceEvery: $<HTMLButtonElement>("editor-replace-all"),
};
findBar.replaceToggle.innerHTML = UI_ICONS.chevronRight;
findBar.previous.innerHTML = UI_ICONS.chevronUp;
findBar.next.innerHTML = UI_ICONS.chevronDown;
findBar.close.innerHTML = UI_ICONS.close;
{
  // Find tile tips name the action and its shortcut from the menu registry, written out for the platform.
  // The shell's tips still read the bare ids (`replace`, `findNext`, `findPrevious`), so the standard ids are given without `edit.`.
  const keys = new Map(collectShortcuts(menuForState({ hasReport: true, showInspector: true, showBottomPanel: true, editor: editorDefaults, files: filesDefaults, appearance: "dark" }, { desktop: false, mac: isMac })).map(item => [item.id.replace(/^edit\./, ""), item.key]));
  applyFindTips(findBar, keys);
}
const pdfViewer = new PdfViewer();
pdfViewer.onSource = (page, x, y) => { void jumpFromPdf(page, x, y); };
/** The PDF was built from older text, so a SyncTeX position can be a line or two off. */
const pdfBehind = (project: ProjectView): boolean => project.pdfStale || project.revision !== project.pdfBuiltRevision;
/** ⌘-click on the PDF: put the cursor on the source line of that spot, in main.tex or the file it comes from. */
async function jumpFromPdf(page: number, x: number, y: number): Promise<void> {
  const project = active;
  if (!project || !api.sourceAt) return;
  const found = await api.sourceAt(project.id, page, x, y).catch(() => null);
  if (project !== active) return;
  if (!found) { updateStatus("No source line for this spot. Build PDF to link the PDF and the text.", "warning"); return; }
  if (found.file !== "main.tex" && !project.files.some(file => file.path === found.file)) { updateStatus("This spot is set by the report class, not by a file of the report.", "info"); return; }
  if (found.file === "main.tex") flashLine(editor.view, found.line);
  else {
    try { await openSupportingFile(project, found.file); } catch (error) { report(`Could not open ${found.file}: ${problemText(error)}`, "error", project); return; }
    const view = supportingViews.find(project.id, found.file)?.view;
    if (view) flashLine(view, found.line);
  }
  if (pdfBehind(project)) updateStatus("The PDF is older than the text, so the line may be off. Build PDF to update it.", "info");
}
// ---- Navigation in the code: outline, block form, ⌘-click, label renaming, reference check, PDF following ----

let indexCache: { text: string; index: SourceIndex } | null = null;
/** The active report's main.tex read for navigation, kept until the text changes. */
function sourceIndex(): SourceIndex | null {
  if (!active) return null;
  const text = editor.text;
  if (indexCache?.text !== text) indexCache = { text, index: indexSource(text) };
  return indexCache.index;
}
const reportLanguage = (): "greek" | "english" => readClassOptions(editor.text)?.language === "english" ? "english" : "greek";
let outlineHost: HTMLElement | null = null, blockHost: HTMLElement | null = null;
/** What the Block section shows: the text and command it was drawn for, so a field never writes into changed text. */
let shownBlock: { text: string; from: number } | null = null;
let navigationTimer: number | undefined;
function scheduleNavigation(): void {
  if (navigationTimer) clearTimeout(navigationTimer);
  navigationTimer = window.setTimeout(renderNavigation, 150);
}
function renderNavigation(): void {
  const index = sourceIndex(), offset = editor.state.selection.main.head;
  if (outlineHost) renderOutline(outlineHost, index, offset, reportLanguage(), at => goToOffset(at));
  if (!blockHost || blockHost.contains(document.activeElement)) return;
  const entry = index ? entryAt(index, offset) : undefined, text = editor.text;
  if (shownBlock && entry && shownBlock.text === text && shownBlock.from === entry.from) return;
  shownBlock = entry ? { text, from: entry.from } : null;
  renderBlockForm(blockHost, entry, text, edit => applyBlockEdit(edit, text));
}
/** Write a Block field into main.tex as one undoable edit, unless the text moved on since the form was drawn. */
function applyBlockEdit(edit: BlockEdit, drawnFor: string): void {
  if (!active || editor.text !== drawnFor) { shownBlock = null; scheduleNavigation(); return; }
  if (edit.from === edit.to && !edit.insert) return;
  editor.replace(edit.from, edit.to, edit.insert);
  shownBlock = null;
  scheduleNavigation();
}
function goToOffset(offset: number): void { flashLine(editor.view, editor.state.doc.lineAt(offset).number, offset); }

/** ⌘-click in the code: true when the click names a label, file or citation, which then opens. */
function followCode(offset: number): boolean {
  const index = sourceIndex();
  const target = index ? targetAt(index, offset) : null;
  if (!target) return false;
  void openCodeTarget(target);
  return true;
}
async function openCodeTarget(target: CodeTarget): Promise<void> {
  const project = active;
  if (!project) return;
  if (target.kind === "label") {
    if (target.at) goToOffset(target.at.from); else updateStatus(`No label named ${target.name} in main.tex.`, "warning");
    return;
  }
  const path = target.kind === "file" ? target.path : bibliographyPath(project);
  if (!path) { updateStatus("This report has no references.bib.", "warning"); return; }
  if (!project.files.some(file => file.path === path)) { updateStatus(`${path} is not in the report.`, "warning"); return; }
  try { await openSupportingFile(project, path); } catch (error) { report(`Could not open ${path}: ${problemText(error)}`, "error", project); return; }
  if (target.kind !== "citation") return;
  const view = supportingViews.find(project.id, path)?.view;
  if (!view) return;
  const key = target.key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const at = new RegExp(`@\\w+\\s*[{(]\\s*${key}\\s*,`).exec(view.state.doc.toString());
  if (at) flashLine(view, view.state.doc.lineAt(at.index).number); else updateStatus(`No entry ${target.key} in ${path}.`, "warning");
}

/** Why `from` cannot be renamed to `to`, or null. */
function renameProblem(from: string | undefined, to: string | undefined): string | null {
  const index = sourceIndex();
  if (!index || !from || !to) return helpCatalog.noDocumentMessage;
  if (!index.labels.has(from)) return `No label named ${from} in main.tex.`;
  if (/[\s,{}\\%#\[\]]/.test(to)) return "A label cannot contain spaces, commas, brackets, braces, backslashes or % and #.";
  if (to !== from && index.labels.has(to)) return `Label ${to} already exists. Choose another name.`;
  return null;
}
/** Rename a label and every reference to it in main.tex as one undoable edit; returns the result sentence. */
function applyRename(from: string, to: string): string {
  const index = sourceIndex()!;
  if (from === to) return `${from} is already the name.`;
  const edits = renameLabel(index, from, to);
  editor.view.dispatch({ changes: edits, userEvent: "input" });
  const text = `Renamed ${from} to ${to} in ${edits.length} ${edits.length === 1 ? "place" : "places"}.`;
  if (active) report(text, "info", active);
  return text;
}
/** Edit › Rename label: the label at the cursor, or the one a reference there names. */
function renameLabelAtCursor(): void {
  const index = sourceIndex(), head = editor.state.selection.main.head;
  const label = index ? labelAt(index, head) : null;
  if (!label) { updateStatus("Put the cursor on a label or a reference to rename it.", "warning"); return; }
  const at = editor.view.coordsAtPos(head);
  showFieldPopover(at?.left ?? 200, (at?.bottom ?? 120) + 4, "Rename label", [{ label: "New name", value: label }], values => {
    const name = values[0].trim();
    const problem = renameProblem(label, name);
    if (problem) return { field: 0, error: problem };
    applyRename(label, name);
    return null;
  });
}

type ReferenceSubject = { projectId: string; name: string; problem: "undefined" | "duplicate" | "unused" };
function isReferenceSubject(subject: object): subject is ReferenceSubject { return "projectId" in subject && "problem" in subject && "name" in subject; }
/** Reference problems go to Messages as standing conditions, after Save and after a build. */
function checkReferences(project: ProjectView): void {
  if (project !== active) return;
  const index = sourceIndex();
  if (!index) return;
  let watch = conditionWatches.get(project); if (!watch) conditionWatches.set(project, watch = new ConditionWatch());
  const texts = { undefined: (name: string) => `Reference to ${name}, which no label defines.`, duplicate: (name: string) => `Label ${name} is defined more than once.`, unused: (name: string) => `Label ${name} is never referenced.` };
  watch.update(project.logs, referenceProblems(index).map(problem => [`reference-${problem.kind}:${problem.name}`, problem.kind === "unused" ? "info" : "warning",
    texts[problem.kind](problem.name), { projectId: project.id, name: problem.name, problem: problem.kind } satisfies ReferenceSubject]));
  messages.refresh(true);
}
function selectReferenceProblem(subject: ReferenceSubject): void {
  const index = sourceIndex();
  const found = index && referenceProblems(index).find(problem => problem.kind === subject.problem && problem.name === subject.name);
  if (!found) { updateStatus("This finding no longer applies to the current text.", "info"); return; }
  editor.selectProblem({ from: found.span.from, to: found.span.to, message: "" });
}

let followTimer: number | undefined, followed = 0;
/** View › PDF follows cursor: keep the cursor's line in view in the PDF, without moving it when it is already shown. */
function scheduleFollow(): void {
  if (!prefs.pdfFollow || api.preview || !api.pdfAt) return;
  if (followTimer) clearTimeout(followTimer);
  followTimer = window.setTimeout(() => {
    const project = active;
    if (!project?.pdfOpen || !project.hasPdf || !editor.hasFocus) return;
    const line = editor.state.doc.lineAt(editor.state.selection.main.head).number;
    if (line === followed) return;
    followed = line;
    void api.pdfAt!(project.id, "main.tex", line).then(boxes => {
      if (project === active && boxes.length) pdfViewer.follow(boxes[0].page, boxes[0].left, boxes[0].top, boxes[0].width, boxes[0].height);
    }).catch(() => {});
  }, 350);
}

/** Document › Show in PDF: outline where the cursor's line was set in the PDF. */
async function showInPdf(): Promise<void> {
  const project = active;
  if (!project || !api.pdfAt) return;
  const side = supportingViews.focused() ?? (lastFocus ? supportingViews.files(project.id).find(file => file.root.contains(lastFocus)) : undefined);
  const view = side?.view ?? editor.view;
  const file = side?.path ?? "main.tex";
  const line = view.state.doc.lineAt(view.state.selection.main.head).number;
  const boxes = await api.pdfAt(project.id, file, line).catch(() => []);
  if (project !== active) return;
  if (!boxes.length) { updateStatus(project.hasPdf ? "This line is not in the PDF. Build PDF to update it." : "No PDF in this report yet. Build to preview it.", "warning"); return; }
  if (!project.pdfOpen) { project.pdfOpen = true; renderTree(); await loadPdf(); }
  // A line wrapped over several rows gives a box for each; outline them together on the first page.
  const page = boxes[0].page, same = boxes.filter(box => box.page === page);
  const left = Math.min(...same.map(box => box.left)), top = Math.min(...same.map(box => box.top));
  const right = Math.max(...same.map(box => box.left + box.width)), bottom = Math.max(...same.map(box => box.top + box.height));
  pdfViewer.reveal(page, left, top, right - left, bottom - top);
  if (pdfBehind(project)) updateStatus("The PDF is older than the text, so the place may be off. Build PDF to update it.", "info");
}

type Preferences = { generatorOptionsShare: number; generatorCodeShare: number; appearance: "dark" | "light" | "pride"; showInspector: boolean; inspectorSide: "left" | "right"; inspectorWidth: number; showBottomPanel: boolean; bottomPanelHeight: number; editorFontSize: number; editor: EditorSettings; files: FilesSettings; terminalFontSize: number; autosave: AutosaveChoice; pdfFollow: boolean; buildOnSave: boolean };
const defaults: Preferences = { generatorOptionsShare: optionsShare.initial, generatorCodeShare: codeShare.initial, appearance: "dark", showInspector: true, inspectorSide: "right", inspectorWidth: 246, showBottomPanel: true, bottomPanelHeight: 246, editorFontSize: 14, editor: editorDefaults, files: filesDefaults, terminalFontSize: 12, autosave: "off", pdfFollow: false, buildOnSave: false };
const settingsStore = createSettingsStore<Preferences>(settingsStorageKey(forgeApp), defaults, stored => {
  const validNumber = (value: unknown, min: number, max: number, fallback: number): number =>
    typeof value === "number" && Number.isFinite(value) && value >= min && value <= max ? value : fallback;
  return {
    appearance: stored.appearance === "light" || stored.appearance === "pride" ? stored.appearance : defaults.appearance,
    showInspector: typeof stored.showInspector === "boolean" ? stored.showInspector : defaults.showInspector,
    inspectorSide: stored.inspectorSide === "left" ? "left" : defaults.inspectorSide,
    inspectorWidth: validNumber(stored.inspectorWidth, 246, 420, defaults.inspectorWidth),
    showBottomPanel: typeof stored.showBottomPanel === "boolean" ? stored.showBottomPanel : defaults.showBottomPanel,
    bottomPanelHeight: validNumber(stored.bottomPanelHeight, 246, 640, defaults.bottomPanelHeight),
    editorFontSize: validNumber(stored.editorFontSize, 10, 24, defaults.editorFontSize),
    // `editorWrap` was a top-level preference before the editor options moved into `editor`.
    editor: restoreEditorSettings(stored.editor, (stored as Record<string, unknown>).editorWrap),
    files: restoreFilesSettings(stored.files),
    terminalFontSize: validNumber(stored.terminalFontSize, 10, 24, defaults.terminalFontSize),
    autosave: (stored.autosave === "1m" || stored.autosave === "5m" || stored.autosave === "focus" ? stored.autosave : defaults.autosave),
    pdfFollow: stored.pdfFollow === true,
    buildOnSave: stored.buildOnSave === true,
    generatorOptionsShare: restoreShare(stored.generatorOptionsShare, optionsShare),
    generatorCodeShare: restoreShare(stored.generatorCodeShare, codeShare),
  };
});
const prefs = settingsStore.settings;
const recovery = createRecovery(`${settingsStorageKey(forgeApp)}.drafts`);
const health: HealthTracker = createHealthTracker({ storageKey: `${settingsStorageKey(forgeApp)}.health` });
const supportingViews = new SupportingViews(prefs.editor, prefs.editorFontSize,
  file => { if (active) { renderTabs(); if (file.path === bibliographyPath(active)) refreshCitations(); } }, file => { void closeSupportingView(file); }, file => { revealFiles([file.path]); });
const editor = new LatexEditor({
  parent: $("editor-surface"),
  // Menu accelerators reach the app's own handler, so the editor does not bind them (CodeMirror binds Mod-i, for one).
  reservedKeys: collectShortcuts(menuForState({ hasReport: true, showInspector: true, showBottomPanel: true, editor: editorDefaults, files: filesDefaults, appearance: "dark" }, { desktop: false, mac: isMac })).map(item => item.key),
  findBar,
  settings: prefs.editor,
  onChange: text => editorChanged(text),
  onCommandInputSource: action => api.commandInputSource(action),
  onCommandInputContext: active => api.commandInputContext(active),
  onSelection: () => { renderStatus(); scheduleNavigation(); scheduleFollow(); },
  onCodeClick: offset => followCode(offset),
});
function updatePrefs(patch: Partial<Preferences>): void {
  settingsStore.updateSettings(patch);
  document.body.dataset.theme = prefs.appearance;
  document.body.dataset.inspectorSide = prefs.inspectorSide;
  if (patch.appearance) editor.refreshDiagnosticColors();
  applyLayout?.(); refreshMenu();
  if (prefs.showBottomPanel && $("bottom-tabs").dataset.active === "messages") { active?.logs.markSeen(); renderStatus(); }
}

function currentMenuState(): MenuState {
  return { hasReport: !!active, showInspector: prefs.showInspector, showBottomPanel: prefs.showBottomPanel, editor: prefs.editor, files: prefs.files, appearance: prefs.appearance, building: !!active?.building, pdfFollow: prefs.pdfFollow, buildOnSave: prefs.buildOnSave, recent: api.preview ? [] : recentReports.list() };
}
function refreshMenu(): void {
  const state = currentMenuState();
  // The browser and Windows draw the menus in the page; on Windows the bar is the title bar, beside the window controls.
  if (drawsMenubar(api.platform, !api.preview)) {
    renderMenubar($("menubar"), menuForState(state, { desktop: !api.preview, mac: isMac }), id => { void runAction(id); }, { titleBar: !api.preview });
    if (!api.preview) api.setTitleBar?.(titleBarColors());
  } else api.updateMenuState(state);
}

function report(text: string, kind: MessageKind = "info", target = active): void {
  if (target) {
    target.logs.add(kind, text);
    if (prefs.showBottomPanel && $("bottom-tabs").dataset.active === "messages" && target === active) target.logs.markSeen();
    messages.refresh(true);
  }
  updateStatus(text, kind);
}
let statusDetail = "", statusKind: MessageKind = "info";
/** The editor's readouts at the right of the status bar: the cursor, a selection, and the text size as a zoom (14 px is 100%). */
function editorReadouts(): string[] {
  if (!active) return [];
  const selection = editor.state.selection.main, line = editor.state.doc.lineAt(selection.head);
  return [`Ln ${line.number}, Col ${selection.head - line.from + 1}`, ...(selection.empty ? [] : [`${Math.abs(selection.to - selection.from)} selected`]), `${Math.round(editorSize / 14 * 100)}%`];
}
function renderStatus(): void {
  if (!status) return;
  const persistentProblem = active?.building ? "" : active?.buildProblem ?? "";
  status.render({ stateLabel: active?.building ? "Building" : "Ready", stateColor: statusKind === "error" || persistentProblem ? "var(--error)" : active?.building ? "var(--accent-light)" : "var(--text3)",
    summary: active?.name ?? "", detail: statusDetail || persistentProblem || active?.archive || "", hint: statusDetail || persistentProblem || null, unseenProblems: active?.logs.unseen ?? 0, problemKind: active?.logs.worstUnseen ?? undefined,
    readouts: editorReadouts() });
}
function updateStatus(detail = "", kind: MessageKind = "info"): void {
  if (statusTimer) clearTimeout(statusTimer);
  statusDetail = detail; statusKind = kind;
  renderStatus();
  if (detail) statusTimer = window.setTimeout(() => updateStatus(), 4000);
}
const clearMessages = Object.assign(document.createElement("button"), { className: "tab-action messages-clear", textContent: "Clear" });
type DiagnosticSubject = { projectId: string; revision: number; file: string; line: number; token?: string };
function isDiagnosticSubject(subject: object): subject is DiagnosticSubject { return "projectId" in subject && "file" in subject && "line" in subject; }
const messages = new MessagesPanel($("messages-pane"), {
  subjectName: subject => subject === texLink ? "Download TeX" : isDiagnosticSubject(subject) ? `${subject.file}:${subject.line}` : isReferenceSubject(subject) ? subject.name : null,
  selectSubject: subject => {
    if (subject === texLink && texLink) { void api.openLink(texLink.url); return; }
    if (isReferenceSubject(subject)) { if (active?.id === subject.projectId) selectReferenceProblem(subject); return; }
    if (!isDiagnosticSubject(subject) || active?.id !== subject.projectId) return;
    if (active.revision !== subject.revision) { updateStatus("This finding is for older text. Build PDF again to check the current report.", "warning"); return; }
    if (subject.file === "main.tex") {
      const line = editor.state.doc.line(Math.min(subject.line, editor.state.doc.lines));
      const index = subject.token ? line.text.lastIndexOf(subject.token) : -1;
      editor.selectProblem({ from: line.from + Math.max(0, index), to: line.from + (index < 0 ? 0 : index + subject.token!.length), message: "" });
    } else {
      const project = projects.find(item => item.id === subject.projectId);
      if (project) void openSupportingFile(project, subject.file).then(() => {
        const file = supportingViews.find(project.id, subject.file);
        if (!file) return;
        const line = file.view.state.doc.line(Math.min(subject.line, file.view.state.doc.lines));
        file.view.dispatch({ selection: { anchor: line.from }, scrollIntoView: true });
        file.view.focus();
      }).catch(error => report(`Could not open ${subject.file}: ${problemText(error)}`, "error", project));
    }
  },
}, clearMessages);

function wrapSnapshot(value: Snapshot): ProjectView {
  return { ...value, path: value.archive, dirty: false, text: "", revision: 0, pdfBuiltRevision: 0, diskText: "", asking: false, loaded: false, editorState: null, pdfOpen: false, pdfWidth: 48, pdfView: null, pdfBuildState: "idle", buildProblem: "", logs: new MessageLog() };
}
function renderPdfBuildState(project: ProjectView | null = active): void {
  const indicator = $("pdf-build-state");
  const text = !project?.pdfOpen ? "" : project.building ? "Building…" : project.pdfBuildState === "failed"
    ? project.hasPdf ? "Build failed. Showing last preview." : "Build failed."
    : project.pdfStale || project.revision !== project.pdfBuiltRevision && project.hasPdf ? "Preview out of date."
    : project.pdfBuildState === "succeeded" ? "Build succeeded." : "";
  indicator.textContent = text;
  indicator.hidden = !text;
}
function updateSnapshot(value: Snapshot): ProjectView {
  let project = projects.find(item => item.id === value.id);
  if (!project) { project = wrapSnapshot(value); projects.push(project); }
  Object.assign(project, value);
  project.path = value.archive;
  if (project === active) { editor.setProjectFiles(project.files.filter(file => file.kind !== "folder").map(file => file.path)); refreshCitations(); refreshMenu(); document.title = `${project.name}: ${forgeApp.identity.name}`; if (figureTools(project.files).map(item => item.id).join("\n") !== figuresShown) { buildInsertFamilies(); setInsertEnabled(true); } renderTree(); renderTabs(); updateStatus(); renderPdfBuildState(); for (const pane of generatorPanes) pane.refreshSources(); }
  return project;
}
function renderTabs(): void {
  const mainDirty = projects.map(project => project.dirty);
  projects.forEach(project => { project.dirty ||= supportingViews.hasDirty(project.id); });
  try { tabs.render(projects, active); }
  finally { projects.forEach((project, index) => { project.dirty = mainDirty[index]; }); }
}
function writingLanguage(project: ProjectView): string { return readClassOptions(project.text)?.language === "english" ? "en" : "el"; }
async function openSupportingFile(project: ProjectView, path: string): Promise<void> {
  if (path === "main.tex") { if (project !== active) await activate(project); editor.focus(); return; }
  if (!supportingTextFile(path)) { await api.external(project.id, path); return; }
  if (project !== active) await activate(project);
  const existing = supportingViews.find(project.id, path);
  if (existing) { existing.view.focus(); return; }
  const text = await api.read(project.id, path);
  if (project !== active) return;
  supportingViews.open(project.id, path, text);
  supportingViews.showProject(project.id, project.pdfOpen, writingLanguage(project));
}
async function saveSupportingFile(file: SupportingView): Promise<boolean> {
  if (!file.dirty) return true;
  const project = projects.find(item => item.id === file.projectId);
  if (!project) return false;
  try {
    const written = file.view.state.doc.toString();
    const prior = file.diskText; file.diskText = written;
    try { updateSnapshot(await api.write(project.id, file.path, written)); }
    catch (error) { file.diskText = prior; throw error; }
    file.dirty = file.view.state.doc.toString() !== written;
    file.root.querySelector<HTMLElement>(".side-view-dirty")!.hidden = !file.dirty;
    renderTabs();
    return true;
  } catch (error) { report(`Could not save ${file.path}: ${problemText(error)}`, "error", project); return false; }
}
async function saveSupportingFiles(project: ProjectView): Promise<boolean> {
  for (const file of supportingViews.files(project.id)) if (!(await saveSupportingFile(file))) return false;
  return true;
}
async function closeSupportingView(file: SupportingView): Promise<void> {
  if (file.dirty) {
    const choice = await askToSave(file.path);
    if (choice === "cancel" || (choice === "save" && !(await saveSupportingFile(file)))) return;
  }
  supportingViews.remove(file);
  renderTabs();
}
async function checkSupportingExternal(project: ProjectView): Promise<void> {
  for (const file of supportingViews.files(project.id)) {
    if (file.asking) continue;
    let disk: string;
    try { disk = await api.read(project.id, file.path); } catch { continue; }
    if (disk === file.diskText) continue;
    if (file.dirty) {
      if (project !== active) continue;
      file.asking = true;
      const choice = await askExternalChange(file.path, forgeApp.identity.name).finally(() => { file.asking = false; });
      if (choice === "keep") { file.diskText = disk; continue; }
      disk = await api.read(project.id, file.path);
    }
    file.diskText = disk;
    const old = file.view.state.doc.toString();
    if (old !== disk) file.view.dispatch({ changes: { from: 0, to: old.length, insert: disk } });
    file.dirty = false;
    file.root.querySelector<HTMLElement>(".side-view-dirty")!.hidden = true;
    renderTabs();
    report(`${file.path} was updated from outside LabForge.`, "info", project);
  }
}
function setWorkspace(): void {
  const open = !!active;
  $("empty-state").hidden = open;
  $("writing-workspace").hidden = !open;
  document.body.classList.toggle("no-docs", !open);
  $("inspector").inert = !open;
  if (paneProject !== (active?.id ?? null)) { paneProject = active?.id ?? null; for (const pane of generatorPanes) pane.showProject(paneProject); }
  if (!open) renderTree();
  supportingViews.showProject(active?.id ?? null, active?.pdfOpen ?? false, active ? writingLanguage(active) : "el");
  document.title = active ? `${active.name}: ${forgeApp.identity.name}` : forgeApp.identity.name;
  toolbar.setMode(open ? "LaTeX editor" : "");
  for (const id of Object.keys(TOOL_LABELS)) toolbar.setEnabled(id, open);
  buildInsertFamilies(); setInsertEnabled(open);
  renderTabs(); updateStatus(); refreshMenu();
}
async function activate(project: ProjectView): Promise<void> {
  if (active === project) return;
  if (active) active.editorState = editor.state;
  // Unsaved edits stay with their tab until Save or Build: switching tabs writes nothing.
  active = project;
  await api.activate(project.id);
  if (!project.loaded) { project.text = project.diskText = await api.read(project.id, "main.tex"); project.loaded = true; }
  editor.setState(project.editorState ?? (project.editorState = editor.createState(project.text)));
  editor.view.contentDOM.lang = writingLanguage(project);
  editor.setProjectFiles(project.files.filter(file => file.kind !== "folder").map(file => file.path));
  messages.setLog(project.logs);
  terminal?.clearHistory();
  selectBottom("terminal");
  setWorkspace(); renderTree(); await loadPdf();
  rebuildCustomCommands(true);
  refreshCitations();
  await checkExternal(project);
}
/** Compare main.tex on disk with the editor after a change outside the editor: import it, or ask when the editor has unsaved edits. */
async function checkExternal(project: ProjectView): Promise<void> {
  if (!project.loaded || project.asking || project.building) return;
  let onDisk: string;
  try { onDisk = await api.read(project.id, "main.tex"); } catch { return; }
  const action = externalAction(onDisk, project.diskText, project.text);
  if (action === "none") { if (onDisk === project.text) project.diskText = onDisk; return; }
  if (action === "ask") {
    if (project !== active) return;
    project.asking = true;
    const choice = await askExternalChange("main.tex", forgeApp.identity.name).finally(() => { project.asking = false; });
    if (choice === "keep") { project.diskText = onDisk; report("Kept your version of main.tex; the next save replaces the outside one.", "warning", project); return; }
    onDisk = await api.read(project.id, "main.tex");
  }
  project.diskText = onDisk;
  project.text = onDisk;
  project.revision++;
  project.dirty = false;
  if (project === active) {
    importing = true;
    try { editor.replaceAll(onDisk); } finally { importing = false; }
    syncClassControls();
    editor.view.contentDOM.lang = writingLanguage(project);
    supportingViews.setLanguage(writingLanguage(project));
  } else project.editorState = null;
  renderTabs();
  report("main.tex was updated from outside LabForge. Undo restores the earlier text.", "info", project);
}
const conditionWatches = new WeakMap<ProjectView, ConditionWatch>();
/** Set once at startup: the warning when the TeX tools are missing, else empty. */
let texWarning = "";
/** The Messages link of that warning: its name is the link text and selecting it opens the download page. */
let texLink: { url: string } | null = null;
/** Puts the missing-TeX warning in a report's Messages, once (a standing condition). */
function warnTex(project: ProjectView): void {
  if (!texWarning) return;
  let watch = conditionWatches.get(project); if (!watch) conditionWatches.set(project, watch = new ConditionWatch());
  watch.update(project.logs, [["tex-missing", "warning", texWarning, texLink ?? undefined]]);
  if (project === active) { messages.refresh(true); updateStatus(); }
}
async function include(value: Snapshot): Promise<void> {
  const existing = projects.some(item => item.id === value.id);
  const prior = active;
  const project = updateSnapshot(value);
  if (!existing && prior) {
    projects.splice(projects.indexOf(project), 1);
    projects.splice(projects.indexOf(prior) + 1, 0, project);
  }
  await activate(project);
  warnTex(project);
  rememberReport(value);
  // Sent once, when the report opens: plots and tables whose data file changed since they were generated.
  const stale = existing ? [] : value.staleGenerated ?? [];
  // A standing condition: logged once under its key, and again only after it has been gone for 30 s (shell ConditionWatch).
  if (stale.length) {
    const text = stale.length === 1 ? `The data of ${stale[0]} changed or is missing since it was generated. Regenerate it to update it.`
      : `The data of ${stale.length} plots and tables changed or is missing since they were generated: ${stale.join(", ")}. Regenerate them to update them.`;
    let watch = conditionWatches.get(project); if (!watch) conditionWatches.set(project, watch = new ConditionWatch());
    watch.update(project.logs, [["generated-data-stale", "warning", text]]);
    if (project === active) { messages.refresh(true); updateStatus(); }
  }
  // Reports made before the preamble held everything may still have these files; the class no longer reads them.
  const legacy = ["custom.tex", "custom-commands.tex"].filter(name => value.files.some(file => file.path === name));
  if (legacy.length && !existing) {
    let watch = conditionWatches.get(project); if (!watch) conditionWatches.set(project, watch = new ConditionWatch());
    watch.update(project.logs, [["legacy-custom-files", "warning", `${legacy.join(" and ")} ${legacy.length === 1 ? "is" : "are"} no longer read. Move its settings and commands into the preamble of main.tex, above the main writing section, then remove ${legacy.length === 1 ? "the file" : "the files"}.`]]);
    if (project === active) { messages.refresh(true); updateStatus(); }
  }
}
async function create(): Promise<void> {
  const value = await api.create();
  if (!value) return;
  await include(value);
  editor.goToWriting(); editor.focus();
}
/** Restore drafts left in local storage by a previous crash. Normal saves and discarded closes clear them. */
async function restoreDrafts(): Promise<void> {
  const drafts = recovery.list();
  if (!drafts.length) return;
  const chosen = await askToRecover(drafts, forgeApp.identity.name);
  if (!chosen?.length) return;
  for (const draft of drafts.filter(item => chosen.includes(item.key))) {
    try {
      let project: ProjectView | undefined;
      if (draft.path && api.openPath) {
        await openReportAt(draft.path);
        project = projects.find(item => item.path === draft.path);
      } else if (!draft.path) {
        const value = await api.create();
        if (value) { await include(value); project = projects.find(item => item.id === value.id); }
      }
      if (!project) continue;
      await activate(project);
      editor.replaceAll(draft.text);
      editor.focus();
      recovery.clear(draft.key);
      report(`Recovered unsaved changes in ${draft.name}.`, "info", project);
    } catch (error) { report(`Could not recover ${draft.name}: ${problemText(error)}`, "error"); }
  }
}
/** Open reports from the Open dialog; returns how many were opened. */
async function open(): Promise<number> {
  const files = await api.open();
  if (files.length && projects.length === 1 && !projects[0].archive && !projects[0].dirty) await close(projects[0]);
  let opened = 0;
  for (const file of files) if (await openReportAt(file)) opened++;
  return opened;
}
async function saveText(project = active): Promise<boolean> {
  if (!project || !project.dirty) return true;
  if (prefs.editor.trimSave && project === active) editor.trimWhitespace();
  try {
    const written = project.text, before = project.diskText;
    project.diskText = written;
    try { if (written !== before) await api.write(project.id, "main.tex", written); }
    catch (error) { project.diskText = before; throw error; }
    if (project.archive && project.text === written) project.dirty = false;
    renderTabs();
    return true;
  } catch (error) { report(`Could not save main.tex: ${problemText(error)}`, "error", project); return false; }
}
async function save(project = active, announce = true): Promise<boolean> {
  if (!project) return false;
  if (!(await saveText(project))) return false;
  if (!(await saveSupportingFiles(project))) return false;
  try {
    const result = await api.save(project.id);
    if (!result) return false;
    updateSnapshot(result);
    rememberReport(result);
    project.dirty = false;
    recovery.clear(project.id);
    renderTabs();
    if (announce) report("Report saved.", "info", project);
    checkReferences(project);
    if (prefs.buildOnSave && !api.preview && project === active && !project.building) void buildPdf();
    return true;
  } catch (error) { report(`Could not save the report: ${problemText(error)}`, "error", project); return false; }
}
const autosave = createAutosave<ProjectView>({
  choice: () => prefs.autosave,
  canSave: project => !!project.path,
  save: project => save(project, false),
});
async function close(project = active): Promise<boolean> {
  if (!project) return true;
  if (project.dirty || supportingViews.hasDirty(project.id)) {
    const choice = await askToSave(project.name);
    if (choice === "cancel" || (choice === "save" && !(await save(project)))) return false;
  }
  try { await api.close(project.id); }
  catch (error) { report(`Could not close the report: ${problemText(error)}`, "error", project); return false; }
  if (project === active) pdfViewer.close();
  supportingViews.forget(project.id);
  autosave.forget(project);
  recovery.clear(project.id);
  for (const pane of generatorPanes) pane.forget(project.id);
  const index = projects.indexOf(project); projects.splice(index, 1);
  if (active === project) { active = null; const next = projects[Math.min(index, projects.length - 1)]; if (next) await activate(next); else setWorkspace(); }
  else renderTabs();
  return true;
}
function editorChanged(text: string): void {
  if (!active) return;
  active.text = text;
  active.revision++;
  scheduleCustomMain();
  scheduleNavigation();
  if (importing) return;
  // Edits stay dirty until Save, Build PDF or an enabled autosave writes them; closing or quitting asks first.
  active.dirty = true;
  recovery.keep({ key: active.id, name: active.name, path: active.path, text });
  autosave.edited(active);
  renderPdfBuildState();
  renderTabs(); syncClassControls();
  const language = writingLanguage(active);
  editor.view.contentDOM.lang = language;
  supportingViews.setLanguage(language);
}
/** The text view that Find acts on: the focused file beside main.tex or Plots and Tables code, otherwise the editor. */
function findTarget(): Pick<LatexEditor, "openFind" | "findNext" | "findPrevious"> | null {
  const focus = document.activeElement && document.activeElement !== document.body ? document.activeElement : lastFocus;
  const side = supportingViews.focused() ?? (focus ? supportingViews.files(active?.id ?? "").find(file => file.root.contains(focus)) : undefined);
  if (side) return side.finder;
  const pane = focus ? generatorPanes.find(candidate => candidate.ownsCode(focus)) : undefined;
  if (pane) return pane.finder;
  return active ? editor : null;
}
/** Undo, redo and clipboard act on a focused text field, otherwise on the editor (a toolbar click leaves focus on its button). */
function editAction(id: "undo" | "redo" | "cut" | "copy" | "paste"): void {
  const focused = document.activeElement;
  const side = supportingViews.focused() ?? (lastFocus ? supportingViews.files(active?.id ?? "").find(file => file.root.contains(lastFocus)) : undefined);
  if (side) {
    side.view.focus();
    if (id === "undo") undoSupporting(side.view);
    else if (id === "redo") redoSupporting(side.view);
    else document.execCommand(id);
    return;
  }
  const field = !editor.hasFocus && (focused instanceof HTMLInputElement || focused instanceof HTMLTextAreaElement || (focused instanceof HTMLElement && focused.isContentEditable));
  if (field) { document.execCommand(id); return; }
  if (!active) return;
  editor.focus();
  if (id === "undo") editor.undo();
  else if (id === "redo") editor.redo();
  else document.execCommand(id);
}
/** The Builder's class controls, kept in step with the class line of main.tex. */
const classControls: { preset?: HTMLButtonElement; language?: HTMLButtonElement; fontsize?: HTMLButtonElement; bibliography?: HTMLInputElement } = {};
function syncClassControls(): void {
  const options = active ? readClassOptions(active.text) : null;
  for (const key of ["preset", "language", "fontsize"] as const) {
    const select = classControls[key]; if (!select) continue;
    select.disabled = !options; select.setAttribute("aria-disabled", String(!options));
  }
  const bibliography = classControls.bibliography;
  if (bibliography) { bibliography.disabled = !options; bibliography.checked = options?.bibliography ?? false; }
}
/** Edit the class line through the editor, so the change can be undone. Returns false when there is nothing to change. */
function setClassOptions(patch: Partial<ClassOptions>): boolean {
  if (!active) return false;
  const change = classLineChange(editor.text, patch);
  if (!change) return false;
  editor.replace(change.from, change.to, change.insert);
  return true;
}
function selectField(label: string, tooltip: string, choices: readonly (readonly [string, string])[], value: string, change: (value: string) => void): [HTMLLabelElement, HTMLButtonElement] {
  const field = document.createElement("label"); field.className = "field"; setTip(field, tooltip);
  const name = document.createElement("span"); name.className = "label"; name.textContent = label;
  const select = createSelectControl({ label, choices: choices.filter(([choice]) => choice !== "-").map(([choice, text]) => ({ value: choice, label: text })), value, onChange: change });
  field.append(name, select);
  return [field, select];
}
function renderTree(): void {
  const inspector = $("inspector"); inspector.replaceChildren();
  const sections = new InspectorSections({ root: inspector, keys: ["builder", "files"] as const,
    isOpen: key => inspectorSections[key], setOpen: (key, open) => { inspectorSections[key] = open; } });
  const builder = sections.create("Builder", "builder");
  // The report's name is renamed here only (shell 1.5.5); a saved report keeps its .lfg file name.
  const named = active;
  const nameField = createRow("Name", named?.projectName ?? "", document, named ? { label: "Report name", current: () => named.projectName,
    onError: text => report(text, "error", named),
    apply: name => { void api.configure(named.id, { name }).then(value => { updateSnapshot(value); report(`Report renamed to ${name}.`, "info", named); }).catch(error => report(`Could not rename the report: ${problemText(error)}`, "error", named)); } } : undefined);
  nameField.classList.add("empty-name-row");
  let builderValue = active?.builder ?? "xelatex";
  const builderSelect = createSelectControl({ label: "PDF builder", choices: [["xelatex", "XeLaTeX"], ["lualatex", "LuaLaTeX"]].map(([value, label]) => ({ value, label })), value: builderValue, onChange: value => {
    builderValue = value as ProjectBuilder;
    if (!active) return;
    const project = active;
    void api.configure(project.id, { builder: value as ProjectBuilder }).then(updateSnapshot).catch(error => { builderValue = project.builder; renderTree(); report(`Could not change the builder: ${problemText(error)}`, "error", project); });
  } });
  const builderField = createField("Builder", builderSelect);
  // While a build runs the same button cancels it: its label names what a click does next (toggle buttons).
  const build = createButton({ label: active?.building ? "Cancel" : "Build PDF", primary: true, disabled: !active || !!api.preview, onClick: () => { if (active?.building) void cancelBuild(); else void buildPdf(); } });
  if (api.preview) setTip(build, "Building needs the LabForge desktop app.");
  const openPdf = createButton({ label: "Open PDF", disabled: !active?.hasPdf, onClick: () => { if (active) void api.external(active.id, "main.pdf").catch(error => report(`Could not open the PDF: ${problemText(error)}`, "error")); } });
  const previewField = createCheckRow("Preview PDF", active?.pdfOpen ?? false, checked => { if (!active) return; active.pdfOpen = checked; void loadPdf(); });
  const definedPresets = active?.presets ?? ["default", "report", "thesis"];
  const selectedPreset = active ? readClassOptions(active.text)?.preset : null;
  const presetChoices: [string, string][] = definedPresets.map(name => [name, name[0].toUpperCase() + name.slice(1)]);
  if (selectedPreset && !definedPresets.includes(selectedPreset)) presetChoices.push([selectedPreset, `${selectedPreset} (not defined)`]);
  const [presetField, presetSelect] = selectField("Preset", "Sets preset= in the class line of main.tex.",
    presetChoices, selectedPreset ?? presetChoices[0][0], value => setClassOptions({ preset: value }));
  const [languageField, languageSelect] = selectField("Language", "Sets language= in the class line of main.tex.",
    [["greek", "Greek"], ["english", "English"]], readClassOptions(active?.text ?? "")?.language ?? "greek", value => setClassOptions({ language: value }));
  const [fontsizeField, fontsizeSelect] = selectField("Font size", "Sets fontsize= in the class line of main.tex.",
    fontSizes.map(size => [size, size.replace("pt", " pt")] as const), readClassOptions(active?.text ?? "")?.fontsize ?? "10pt", value => setClassOptions({ fontsize: value }));
  const bibliographyField = createCheckRow("Bibliography", false, checked => setClassOptions({ bibliography: checked }));
  setTip(bibliographyField, "Sets bibliography in the class line of main.tex; biber then reads references.bib.");
  const bibliography = bibliographyField.querySelector("input")!;
  Object.assign(classControls, { preset: presetSelect, language: languageSelect, fontsize: fontsizeSelect, bibliography });
  syncClassControls();
  builder.append(createButtonGroup([build, openPdf]), nameField, builderField, presetField, languageField, fontsizeField, bibliographyField, previewField);

  // The Outline and Block sections (outline.ts, block-form.ts) are switched off for now; with no host they draw nothing.

  const files = sections.create("Files", "files");
  const project = active;
  if (project && !collapsedFolders.has(project.id)) collapsedFolders.set(project.id, new Set());
  if (project && !selectedFiles.has(project.id)) selectedFiles.set(project.id, { path: null });
  renderFileArea(files, project?.files ?? [], {
    enabled: !!project,
    settings: prefs.files,
    selection: project ? selectedFiles.get(project.id)! : { path: null },
    collapsed: project ? collapsedFolders.get(project.id)! : new Set(),
    setSettings: patch => setFilesSettings(patch),
    open: file => { if (project) void openSupportingFile(project, file.path).catch(error => report(`Could not open ${file.path}: ${problemText(error)}`, "error", project)); },
    trash: path => { if (project) void api.trash(project.id, path).then(value => { updateSnapshot(value); report(`Moved ${path} to the ${api.platform === "win32" ? "Recycle Bin" : "Trash"}.`, "info", project); }).catch(error => report(`Could not remove ${path}: ${problemText(error)}`, "error", project)); },
    reveal: path => { if (project) void api.reveal(project.id, path).catch(error => report(`Could not show ${path}: ${problemText(error)}`, "error", project)); },
    add: folder => { if (project) void api.add(project.id, folder).then(updateSnapshot).catch(error => report(`Could not add files: ${problemText(error)}`, "error", project)); },
    drop: (folder, dropped) => { if (project) void api.addDropped(project.id, folder, dropped).then(updateSnapshot).catch(error => report(`Could not add files: ${problemText(error)}`, "error", project)); },
    rename: (from, to) => { if (project) void api.rename(project.id, from, to).then(updateSnapshot).catch(error => report(`Could not rename ${from}: ${problemText(error)}`, "error", project)); },
    // New entries take the platform's first free name; the tree then renames them in place.
    newFile: async folder => {
      if (!project) return;
      const path = newEntryName("untitled.tex", folder, project.files);
      try { updateSnapshot(await api.write(project.id, path, "")); return path; } catch (error) { report(`Could not create ${path}: ${problemText(error)}`, "error", project); }
    },
    newFolder: async folder => {
      if (!project) return;
      const path = newEntryName(api.platform === "win32" ? "New folder" : "untitled folder", folder, project.files);
      try { updateSnapshot(await api.mkdir(project.id, path)); return path; } catch (error) { report(`Could not create ${path}: ${problemText(error)}`, "error", project); }
    },
    copy: (from, to) => { if (project) void api.copy(project.id, from, to).then(updateSnapshot).catch(error => report(`Could not copy ${from}: ${problemText(error)}`, "error", project)); },
    insert: text => { editor.insertAtCursor(text); },
    readText: path => api.read(project!.id, path),
    copyText: text => api.copyText(text),
    notice: text => report(text, "info", project ?? active),
    warn: text => report(text, "warning", project ?? active),
    problem: text => report(text, "error", project ?? active),
    editMain: () => editor.focus(),
    rerender: () => renderTree(),
  });
}
function setFilesSettings(patch: Partial<FilesSettings>): void {
  updatePrefs({ files: { ...prefs.files, ...patch } });
  renderTree();
}
async function loadPdf(): Promise<void> {
  if (!active) return;
  const project = active;
  supportingViews.setPdfOpen(project.pdfOpen);
  renderPdfBuildState(project);
  $<HTMLElement>("pdf-side").style.width = `${project.pdfWidth}%`;
  pdfViewer.close();
  if (!project.hasPdf || !project.pdfOpen) return;
  try {
    const data = await api.pdf(project.id);
    if (project !== active || !project.pdfOpen || !data) return;
    const bytes = Uint8Array.from(atob(data), character => character.charCodeAt(0));
    await pdfViewer.open(bytes, project.pdfView, view => { project.pdfView = view; });
  } catch (error) { report(`Could not preview the PDF: ${problemText(error)}`, "error", project); }
}
/** Build the active report's PDF; returns the result as a sentence for the Terminal. */
async function cancelBuild(): Promise<string> {
  if (!active?.building) return "No build is running.";
  const stopped = await api.cancelBuild(active.id);
  return stopped ? "Cancelling the build." : "No build is running.";
}
/** Build the active report's PDF; returns the result as a sentence for the Terminal. `signal` (Ctrl+C in Terminal) cancels it. */
async function buildPdf(signal?: AbortSignal): Promise<string> {
  if (!active) return helpCatalog.noDocumentMessage;
  const project = active;
  signal?.addEventListener("abort", () => { void api.cancelBuild(project.id); }, { once: true });
  if (!(await saveText(project))) return "Could not save main.tex, so the PDF was not built. See Messages.";
  if (!(await saveSupportingFiles(project))) return "Could not save a supporting file, so the PDF was not built. See Messages.";
  const builtText = project.text;
  const builtRevision = project.revision;
  project.building = true;
  renderPdfBuildState(project); renderStatus();
  try {
    const result = await api.build(project.id);
    project.hasPdf = result.hasPdf;
    project.pdfStale = result.stale;
    if (result.success) project.pdfBuiltRevision = builtRevision;
    project.pdfBuildState = result.success ? "succeeded" : result.cancelled ? "idle" : "failed";
    project.buildProblem = result.success || result.cancelled ? "" : result.issues.find(issue => issue.severity === "error")?.message ?? result.summary;
    const current = project.revision === builtRevision && project.text === builtText;
    if (current && project === active) editor.setBuildDiagnostics(result.issues);
    for (const issue of result.issues) {
      const subject: DiagnosticSubject | undefined = current && issue.file && issue.line ? { projectId: project.id, revision: builtRevision, file: issue.file.replace(/^\.\//, ""), line: issue.line, token: issue.token } : undefined;
      const location = issue.file && issue.line ? `${issue.file}:${issue.line}: ` : "";
      project.logs.add(issue.severity, `${location}${issue.message}`, subject);
    }
    if (result.issues.length) { messages.refresh(true); updateStatus(result.issues[0].message, result.issues[0].severity); }
    if (!current && result.issues.length) report("The report changed during the build. Build again to check the current text.", "warning", project);
    report(result.summary, result.success || result.cancelled ? "info" : "error", project);
    checkReferences(project);
    await loadPdf();
    return result.success ? "PDF built." : result.cancelled ? "Build cancelled." : "The PDF build failed. See Messages.";
  } catch (error) {
    const text = `Could not build the PDF: ${problemText(error)}`;
    project.pdfBuildState = "failed";
    project.buildProblem = text;
    report(text, "error", project);
    return text;
  } finally {
    project.building = false;
    if (project === active) { renderPdfBuildState(project); renderStatus(); }
  }
}

const toolbar = createToolStrip($("toolstrip"), id => { void runAction(id); });
/** The tool strip's actions, by their menu ids; a tool takes its label and shortcut from the same menu item. */
const TOOL_LABELS = { "edit.undo": "Undo", "edit.redo": "Redo", "edit.cut": "Cut", "edit.copy": "Copy", "edit.paste": "Paste", "view.actualSize": "Actual size", "view.zoomIn": "Zoom in", "view.zoomOut": "Zoom out" } as const;
type ToolAction = keyof typeof TOOL_LABELS;
function setupToolbar(): void {
  // Read accelerators from the open-report menu: on welcome the view items are disabled and carry none.
  const keys = new Map(collectShortcuts(menuForState({ ...currentMenuState(), hasReport: true }, { desktop: false, mac: isMac })).map(item => [item.id, item.key]));
  const tool = (id: ToolAction, icon: keyof typeof TOOL_ICONS) => toolbar.tool({ id, icon: TOOL_ICONS[icon], label: TOOL_LABELS[id], shortcut: keys.get(id), enabled: false });
  toolbar.group([tool("edit.undo", "undo"), tool("edit.redo", "redo")], "", "history");
  toolbar.group([tool("edit.cut", "cut"), tool("edit.copy", "copy"), tool("edit.paste", "paste")], "", "clipboard");
  toolbar.group([tool("view.zoomOut", "zoomOut"), tool("view.zoomIn", "zoomIn"), tool("view.actualSize", "fit")], "", "view");
  // Families of report commands: choosing one writes it at the cursor, and the button then shows the last one used.
  for (const id of [...insertFamilies.map(family => family.id), "insert-custom"]) {
    const slot = document.createElement("span"); slot.className = "flyout-slot"; slot.dataset.family = id;
    insertSlots.set(id, slot);
  }
  toolbar.group([...insertSlots.values()], "flyout-group");
  buildInsertFamilies();
  const search = createToolSearch({ name: "commands", search: query => searchCommands(query, active?.files ?? [], getCustomCommands())
    .map(hit => ({ id: hit.id, label: hit.label, category: hit.detail })), onSelect: id => insertById(id), icon: UI_ICONS.search });
  insertSearch = search.input;
  $("toolstrip").append(search.root);
  // A result lives in the shell's overlay, outside the input. Keep it clickable;
  // a pointer press anywhere else clears both the query and the results list.
  document.addEventListener("pointerdown", event => {
    if (!search.input.value || !(event.target instanceof Element) || event.target.closest("#toolstrip-search, #tool-search-results")) return;
    search.input.value = "";
    search.input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  toolbar.finish();
  setInsertEnabled(false);
}
const insertSlots = new Map<string, HTMLElement>();
let insertSearch: HTMLInputElement | undefined;
let insertTools = new Map<string, InsertTool>();
let figuresShown = "";
/** Fill each family's slot with its flyout; Figures is drawn again when the report's graphics, plots or tables change. */
/** The commands the report defines in main.tex, offered by completion, hover, Terminal and the toolbar's Custom commands menu. */
let customShown = "";
/** The report's .bib file: references.bib, or data/references.bib in older reports. */
function bibliographyPath(project: ProjectView): string | undefined {
  return ["references.bib", "data/references.bib"].find(path => project.files.some(file => file.path === path));
}
let citationsShown = "";
/** Gives `\cite{` the keys of the report's .bib file; an open .bib view is read as typed, a closed one when its size changes. */
function refreshCitations(): void {
  const project = active, path = project && bibliographyPath(project);
  if (!project || !path) { citationsShown = ""; setCitationSource(null); return; }
  const open = supportingViews.find(project.id, path);
  if (open) { citationsShown = ""; setCitationSource(open.view.state.doc.toString()); return; }
  const signature = `${project.id}:${path}:${project.files.find(file => file.path === path)!.size}`;
  if (signature === citationsShown) return;
  citationsShown = signature;
  void api.read(project.id, path).then(text => { if (active === project) setCitationSource(text); }).catch(() => { citationsShown = ""; setCitationSource(null); });
}
function rebuildCustomCommands(force = false): void {
  const project = active;
  setReportPackageSource(project?.text ?? "\\documentclass{.labforge}");
  const commands = project ? parseCustomCommands(project.text) : [];
  const signature = commands.map(command => `${command.name}:${command.snippet}`).join("|");
  setCustomCommands(commands);
  if (!force && signature === customShown) return;
  customShown = signature;
  buildInsertFamilies(); setInsertEnabled(!!project);
}
let customMainTimer: number | undefined;
/** Read the commands main.tex defines a moment after the text stops changing. */
function scheduleCustomMain(): void {
  if (customMainTimer) clearTimeout(customMainTimer);
  customMainTimer = window.setTimeout(() => rebuildCustomCommands(), 180);
}
/** Write a new command at the end of the preamble of main.tex, as one undoable edit. Returns the reason it cannot, or null. */
async function addCustomCommand(name: string, args: string, body: string, description: string): Promise<string | null> {
  const project = active;
  if (!project) return helpCatalog.noDocumentMessage;
  const problem = commandProblem(name, args, body, word => !!findFrameworkCommand(word));
  if (problem) return problem;
  const added = addToPreamble(editor.text, commandDefinition(name, Number(args), body, description));
  if (!added) return "main.tex has no \\documentclass{.labforge} line. Add one to define commands.";
  editor.applyText(added.text, added.at);
  rebuildCustomCommands();
  await saveText(project);
  report(`Added \\${name} to the preamble of main.tex.`, "info", project);
  return null;
}
/** The form that defines a new command, opened under the Custom commands button. */
function newCommandForm(): void {
  const button = insertSlots.get("insert-custom")?.querySelector("button");
  const box = button?.getBoundingClientRect();
  showFieldPopover(box?.left ?? 200, (box?.bottom ?? 40) + 2, "New command", [{ label: "Name", value: "" }, { label: "Arguments", value: "0" }, { label: "Description", value: "" }, { label: "Body", value: "" }],
    values => {
      const [name, args, description, body] = values.map(value => value.trim());
      const problem = commandProblem(name, args, body, word => !!findFrameworkCommand(word));
      if (problem) return { field: /name|exists/i.test(problem) ? 0 : /Arguments|number/.test(problem) ? 1 : 3, error: problem };
      void addCustomCommand(name, args, body, description).then(error => { if (error) report(error, "error"); });
      return null;
    });
}
function buildInsertFamilies(): void {
  const files = active?.files ?? [];
  figuresShown = figureTools(files).map(item => item.id).join("\n");
  insertTools = new Map();
  for (const family of insertFamilies) {
    const tools = family.id === "insert-figures" ? figureTools(files) : family.tools;
    for (const item of tools) insertTools.set(item.id, item);
    const group = createFlyoutGroup({ id: family.id, label: family.label, tools: tools.map(item => ({ id: item.id, icon: item.icon, label: item.label })), onSelect: id => insertById(id) });
    group.button.disabled = !active;
    insertSlots.get(family.id)!.replaceChildren(group.button);
  }
  const custom = customTools(getCustomCommands());
  for (const item of custom) insertTools.set(item.id, item);
  const customGroup = createFlyoutGroup({ id: "insert-custom", label: "Custom commands", tools: custom.map(item => ({ id: item.id, icon: item.icon, label: item.label })),
    onSelect: id => { insertById(id); customGroup.setTool("custom:new"); } });
  customGroup.button.disabled = !active;
  insertSlots.get("insert-custom")!.replaceChildren(customGroup.button);
}
function insertById(id: string): void {
  if (!active) return;
  if (id === "custom:new") { newCommandForm(); return; }
  if (id === "custom:goto") { if (!editor.revealPreamble()) report("main.tex has no \\documentclass{.labforge} line.", "warning"); return; }
  const standard = id.startsWith("std:") ? standardSnippet(id.slice(4)) : undefined;
  const item = insertTools.get(id);
  const snippet = standard ?? item?.snippet;
  if (snippet) editor.insertCommand(snippet);
}
const standardSnippet = (name: string): string | undefined => findFrameworkCommand(name)?.snippet;
function setInsertEnabled(open: boolean): void {
  for (const slot of insertSlots.values()) for (const button of slot.querySelectorAll("button")) button.disabled = !open;
  if (insertSearch) insertSearch.disabled = !open;
}
function setEditorSize(size: number): void {
  editorSize = Math.min(24, Math.max(10, size));
  // On the root, so the Plots and Tables code uses the same size as the editor.
  document.documentElement.style.setProperty("--editor-size", `${editorSize}px`);
  editor.setFontSize(editorSize);
  supportingViews.configure(prefs.editor, editorSize);
  if (status) renderStatus();
  for (const pane of generatorPanes) pane.configureEditor();
  updatePrefs({ editorFontSize: editorSize });
}
function setEditorSettings(patch: Partial<EditorSettings>): void {
  updatePrefs({ editor: { ...prefs.editor, ...patch } });
  editor.configure(prefs.editor);
  supportingViews.configure(prefs.editor, editorSize);
  for (const pane of generatorPanes) pane.configureEditor();
}
/** The element that last had focus, for commands chosen from a menu that takes the focus away. */
let lastFocus: Element | null = null;
document.addEventListener("focusin", event => { if (event.target instanceof Element && event.target !== document.body) lastFocus = event.target; });
/** Show project files in the file manager. */
function revealFiles(paths: string[]): void {
  const project = active;
  if (!project) return;
  for (const path of paths) void api.reveal(project.id, path).catch(error => report(`Could not show ${path}: ${problemText(error)}`, "error", project));
}
async function runAction(id: string): Promise<void> {
  try {
    if (id === "file.new") await create();
    else if (id === "file.open") await open();
    else if (id === "file.save") await save();
    else if (id === "file.close") await close();
    else if (id === "app.settings") showSettings({ pages: settingsPages() });
    else if (id === "showContents" && active) await api.contents(active.id);
    else if (id === "showInFinder" && active) revealFiles([supportingViews.focused()?.path ?? "main.tex"]);
    else if (id === "exportZip" && active && api.exportZipBytes) {
      const project = active;
      const format: ExportFormat = { id: "zip", name: "ZIP archive", extensions: ["zip"], mime: "application/zip" };
      const result = await exportFiles({ bridge: api.preview ? null : api as ExportBridge, formats: [format], overwrite: "ask", protectedPaths: () => [] },
        [{ name: project.name, format, bytes: () => api.exportZipBytes!(project.id) }]);
      if (result?.written[0]) report(`Exported ${result.written[0]}.`, "info", project);
    }
    else if (id === "build" && !api.preview && !active?.building) await buildPdf();
    else if (id === "cancelBuild" && !api.preview) await cancelBuild();
    else if (id === "edit.find" || id === "edit.replace") findTarget()?.openFind(id === "edit.replace");
    else if (id === "edit.findNext") findTarget()?.findNext();
    else if (id === "edit.findPrevious") findTarget()?.findPrevious();
    else if (id === "edit.goToLine" && active) editor.gotoLine();
    // Select all follows the focus: the Terminal's transcript or prompt, the editor's whole document, or the focused field.
    else if (id === "edit.selectAll") {
      // Choosing it from a drawn menu leaves the page with no focused element, so the last one that had focus is the target.
      const target = document.activeElement && document.activeElement !== document.body ? document.activeElement : lastFocus;
      if (target && $("terminal-pane").contains(target)) terminal.selectAll();
      else if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) target.select();
      else if (editor.hasFocus || (target && $("editor-surface").contains(target))) editor.selectAll(); else {
        const side = supportingViews.focused() ?? (target ? supportingViews.files(active?.id ?? "").find(file => file.root.contains(target)) : undefined);
        if (side) { side.view.focus(); selectAllSupporting(side.view); } else document.execCommand("selectAll");
      }
    }
    else if (id === "edit.toggleComment" && active) { editor.focus(); editor.toggleComment(); }
    else if (id === "joinLines" && active) { editor.focus(); editor.joinLines(); }
    else if (id === "sortLines" && active) { editor.focus(); editor.sortLines(); }
    else if (id === "trimWhitespace" && active) { editor.focus(); editor.trimWhitespace(); }
    else if (id === "foldAll" && active) editor.foldAll();
    else if (id === "unfoldAll" && active) editor.unfoldAll();
    else if (id === "wrapText") setEditorSettings({ wrap: !prefs.editor.wrap });
    else if (id === "files.hidden") setFilesSettings({ showHidden: !prefs.files.showHidden });
    else if (id.startsWith("editor.tabSize.")) setEditorSettings({ tabSize: Number(id.slice(15)) as TabSize });
    else if (id.startsWith("editor.")) { const key = id.slice(7) as EditorToggle; if (editorToggles.some(toggle => toggle.key === key)) setEditorSettings({ [key]: !prefs.editor[key] }); }
    else if (id === "pdf" && active) { active.pdfOpen = true; renderTree(); await loadPdf(); }
    else if (id === "showInPdf" && active && !api.preview) await showInPdf();
    else if (id === "renameLabel" && active) renameLabelAtCursor();
    else if (id === "pdfFollow") { updatePrefs({ pdfFollow: !prefs.pdfFollow }); followed = 0; scheduleFollow(); }
    else if (id === "buildOnSave") updatePrefs({ buildOnSave: !prefs.buildOnSave });
    else if (id === "view.actualSize") setEditorSize(14);
    else if (id === "view.zoomIn") setEditorSize(editorSize + 1);
    else if (id === "view.zoomOut") setEditorSize(editorSize - 1);
    else if (id === "edit.undo" || id === "edit.redo") editAction(id === "edit.undo" ? "undo" : "redo");
    else if (id === "edit.cut" || id === "edit.copy" || id === "edit.paste") editAction(id.slice(5) as "cut" | "copy" | "paste");
    else if (id === "view.inspector") updatePrefs({ showInspector: !prefs.showInspector });
    else if (id === "view.bottomPanel") updatePrefs({ showBottomPanel: !prefs.showBottomPanel });
    else if (id.startsWith("theme")) updatePrefs({ appearance: id.slice(5).toLowerCase() as Preferences["appearance"] });
    else if (id.startsWith("file.recent.")) await openRecent(id.slice("file.recent.".length));
    else if (["about", "about.whatsNew", "writingHelper", "about.shortcuts", "about.licenses"].includes(id)) showInfo(id);
  } catch (error) { report(problemText(error), "error"); }
}
function showInfo(id: string): void {
  const info = infoOptions(__LABFORGE_LOGO__.trimEnd(), __FORGE_VERSION__);
  if (id === "about") showAbout(info);
  else if (id === "about.whatsNew") void showWhatsNew(info);
  else if (id === "writingHelper") showWritingHelper(info);
  else if (id === "about.licenses") void showLicenses(info);
  else if (id === "about.shortcuts") showShortcuts(info, shortcutGroups());
  // The shell's dialogs leave the focus where it was; from the Terminal, Esc would then only leave the prompt.
  requestAnimationFrame(() => document.querySelector<HTMLElement>(".about button.close")?.focus());
}
/** Shortcut rows per top-level menu, read from the same menu definition the menu bar renders, then the editor's own keys. */
function shortcutGroups(): [string, [string, string][]][] {
  const groups = menuShortcutGroups(menuForState({ ...currentMenuState(), hasReport: true }, { desktop: false, mac: isMac }), shortcutText);
  return [...groups, ["Editor", [["Tab", "Insert an indent or accept a completion"], [shortcutText("Enter"), "After \\begin{…}, add the matching \\end{…}"], [shortcutText("Escape"), "Close completions or Find"]]], ["PDF", [[shortcutText("CmdOrCtrl+Click"), "Show the source line of a spot"]]], ["Code", [[shortcutText("CmdOrCtrl+Click"), "Go to a reference's label, a file or a citation"]]]];
}
/** Settings pages supplied by LabForge and the shell. */
function settingsPages(): SettingsPage[] {
  const info = infoOptions(__LABFORGE_LOGO__.trimEnd(), __FORGE_VERSION__);
  const updateOptions = { platform: api.preview ? undefined : api.platform, install: api.installUpdate,
    onProgress: api.onUpdateProgress, storageKey: `${settingsStorageKey(forgeApp)}.updates` };
  const pages: SettingsPage[] = [
    generalPage({ settings: prefs, update: updatePrefs }),
    { id: "editor", title: "Editor", icon: UI_ICONS.code, sections: [{ rows: [
      ...editorToggles.filter(item => item.key !== "summaries").map(item => ({ kind: "check" as const, label: item.label, value: () => prefs.editor[item.key], set: (value: boolean) => setEditorSettings({ [item.key]: value }), command: (value: boolean) => `${item.name} ${value ? "on" : "off"}` })),
      { kind: "select" as const, label: "Tab size", choices: [2, 4, 8].map(size => [String(size), `${size} spaces`] as const), value: () => String(prefs.editor.tabSize), set: (value: string) => setEditorSettings({ tabSize: Number(value) as TabSize }), command: (value: string) => `editor tabsize ${value}` },
    ] }] },
    { id: "files", title: "Files", icon: UI_ICONS.settings, sections: [{ rows: [{ kind: "check", label: "Show hidden files", value: () => prefs.files.showHidden, set: (value: boolean) => setFilesSettings({ showHidden: value }), command: (value: boolean) => `files hidden ${value ? "on" : "off"}` }] }] },
    terminalPage({ fontSize: () => prefs.terminalFontSize, setFontSize: size => updatePrefs({ terminalFontSize: size }) }),
    healthPage(health),
  ];
  if (forgeApp.identity.repository) pages.push(updatesPage({ info, repository: forgeApp.identity.repository, ...updateOptions }));
  return pages;
}
/** File › Open recent: the report at `index`, or Clear menu. A report that is gone leaves the list. */
async function openRecent(index: string): Promise<void> {
  if (index === "clear") { recentReports.clear(); refreshMenu(); return; }
  const file = recentReports.list()[Number(index)];
  if (file) await openReportAt(file, true);
}
/** Open the report at `file`, from File › Open recent or a drop on the window. A recent report that is gone leaves the list. */
async function openReportAt(file: string, recent = false): Promise<boolean> {
  if (!api.openPath) return false;
  try {
    let convertLegacy = false;
    if (await api.isLegacyArchive?.(file)) {
      const choice = await askToChoose({ title: "Convert this older ZIP report?",
        detail: "LabForge will convert it to a package and keep the original ZIP beside it.",
        buttons: [{ id: "convert", label: "Convert", role: "primary" }, { id: "cancel", label: "Cancel", role: "cancel" }] });
      if (choice !== "convert") return false;
      convertLegacy = true;
    }
    const value = await api.openPath(file, convertLegacy);
    if (!value) return false;
    if (projects.length === 1 && !projects[0].archive && !projects[0].dirty && projects[0].id !== value.id) await close(projects[0]);
    await include(value);
    return true;
  } catch (error) {
    if (recent) { recentReports.remove(file); refreshMenu(); }
    report(problemText(error), "error");
    return false;
  }
}
async function consoleCommand(input: string, signal?: AbortSignal): Promise<ConsoleResult> {
  // `<command> -h`, `--help` and `?` mean `help <command>`.
  const line = helpAlias(input) ?? input.trim();
  const [typed, ...args] = line.split(/\s+/); const arg = args.join(" ");
  const verb = typed.toLowerCase();
  const entry = findCommand(verb);
  if (!entry) return { lines: [`Unknown command: ${typed}. Type help to list commands.`] };
  const welcome = !active;
  if (verb === "help") return arg ? commandHelp(arg.toLowerCase(), welcome, helpCatalog) : generalHelp(welcome, helpCatalog);
  const documentOnly = !availableOnWelcome.has(verb) || (verb === "files" && !arg) || (verb === "panel" && ["plots", "tables", "messages"].includes(arg));
  if (welcome && documentOnly) return { lines: [helpCatalog.noDocumentMessage] };
  // A bare `theme` reports the appearance (GUIDELINES section 7), which the shared syntax does not accept yet.
  if (verb === "theme" && !arg) return { lines: [`Appearance is ${prefs.appearance}.`] };
  if (!entry.args.test(arg)) return invalidUsage(entry);
  if (verb === "clear") return { clear: true };
  if (verb === "health") return healthCommand(arg, health);
  // The shared commands run their menu actions; the preferences go to the shell's own verbs.
  const sharedResult = runSharedCommand(verb, arg, {
    run: action => { void runAction(action); }, actions: ACTIONS, hasDocument: !!active, noun: forgeApp.document.noun,
    productName: forgeApp.identity.name, version: __FORGE_VERSION__,
    openSettings: page => showSettings({ pages: settingsPages(), page }), settingsPages: () => settingsPages().map(page => page.id),
    recent: () => api.preview ? [] : recentReports.list(), openPath: path => { void openRecent(String(recentReports.list().indexOf(path))); },
    fontSize: () => prefs.terminalFontSize, setFontSize: size => updatePrefs({ terminalFontSize: size }),
  }) ?? shellPreferenceCommand(verb, arg, { settings: prefs, update: updatePrefs, panes: PANES, selectPane: pane => selectBottom(pane) });
  if (sharedResult) return sharedResult;
  if (shared.some(item => item.spec.name === verb)) return invalidUsage(entry);
  if (verb === "editor" || editorVerbs.includes(verb)) {
    const result = editorCommand(verb === "editor" ? args : [verb, ...args], prefs.editor);
    if (!result) return invalidUsage(entry);
    if (result.patch?.commandLanguage && (api.preview || !["darwin", "win32"].includes(api.platform))) return { lines: ["English input for LaTeX commands needs the LabForge desktop app on macOS or Windows."] };
    if (result.patch) setEditorSettings(result.patch);
    return { lines: result.lines };
  }
  if ((verb === "files" && args[0] === "hidden") || verb === "hidden") {
    if (verb === "files") args.shift();
    if (!args.length) return { lines: [`Hidden files are ${prefs.files.showHidden ? "shown" : "hidden"}.`] };
    const show = args[0] === "on";
    if (prefs.files.showHidden === show) return { lines: [`Hidden files are already ${show ? "shown" : "hidden"}.`] };
    setFilesSettings({ showHidden: show }); return { lines: [show ? "Hidden files shown." : "Hidden files hidden."] };
  }
  if (verb === "latex" && args[0] === "new") {
    const added = await addCustomCommand(args[1], args[2], args.slice(3).join(" "), "");
    return { lines: [added ?? `Added \\${args[1]} to the preamble of main.tex.`] };
  }
  if (verb === "latex") {
    if (arg === "packages") setReportPackageSource(active?.text ?? "\\documentclass{.labforge}");
    const lines = latexHelp(arg);
    return { lines: lines ?? [`Unknown report command: ${arg}. Type latex to list them.`] };
  }
  if (verb === "tabs") {
    return { lines: projects.length ? projects.map((project, index) => ({ marker: `[${index + 1}]`, label: project.name, comment: [project === active ? "active" : "", project.dirty ? "unsaved" : ""].filter(Boolean).join(", ") })) : [`No ${forgeApp.document.tabs.noun} tabs open.`] };
  }
  if (!active) return { lines: [helpCatalog.noDocumentMessage] };
  if (verb === "tab") {
    const target = projects[Number(arg) - 1];
    if (!target) return { lines: [`There is no report ${arg}. Type tabs to list them.`] };
    await activate(target);
    return { lines: [`Switched to ${target.name}.`] };
  }
  if (verb === "pdf" && args[0] === "follow") {
    if (args[1]) { updatePrefs({ pdfFollow: args[1] === "on" }); followed = 0; scheduleFollow(); }
    return { lines: [`PDF follows cursor is ${prefs.pdfFollow ? "on" : "off"}.`] };
  }
  if (verb === "pdf") { await runAction("pdf"); return { lines: ["Showing PDF preview."] }; }
  if (verb === "build" && args[0] === "save") {
    if (args[1]) updatePrefs({ buildOnSave: args[1] === "on" });
    return { lines: [`Build on save is ${prefs.buildOnSave ? "on" : "off"}.`] };
  }
  if (verb === "label") {
    const [, from, to] = args;
    const problem = renameProblem(from, to);
    if (problem) return { lines: [problem] };
    return { lines: [applyRename(from, to)] };
  }
  if (verb === "build") {
    if (api.preview) return { lines: ["Building needs the LabForge desktop app."] };
    return { lines: [await buildPdf(signal)] };
  }
  if (verb === "cancel") {
    if (api.preview) return { lines: ["Building needs the LabForge desktop app."] };
    return { lines: [await cancelBuild()] };
  }
  if (verb === "finder") {
    const manager = api.platform === "win32" ? "File Explorer" : "Finder";
    if (api.preview) return { lines: [`Showing files in ${manager} needs the LabForge desktop app.`] };
    if (!arg) { await api.contents(active.id); return { lines: [`Showing the report in ${manager}.`] }; }
    const open = ["main.tex", ...supportingViews.files(active.id).map(file => file.path)];
    const paths = arg.toLowerCase() === "all" ? open : [arg];
    const missing = paths.find(path => !active!.files.some(file => file.path === path && file.kind !== "folder"));
    if (missing) return { lines: [`There is no file ${missing}. Type files to list them.`] };
    revealFiles(paths);
    return { lines: [`Showing ${paths.length === 1 ? paths[0] : `${paths.length} files`} in ${manager}.`] };
  }
  if (verb === "files") {
    const visible = active.files.filter(file => file.kind !== "folder" && (prefs.files.showHidden || !file.hidden));
    return { lines: visible.length ? visible.map((file, index) => ({ marker: `[${index + 1}]`, label: file.path, comment: file.kind })) : ["No files."] };
  }
  if (verb === "preset" || verb === "language" || verb === "bibliography") return classCommand(verb, arg);
  if (verb === "plots" || verb === "tables" || verb === "plot" || verb === "table") {
    try { return await generatorCommand(verb, args); }
    catch (error) { return { lines: [problemText(error)] }; }
  }
  if (verb === "status") {
    const count = active.files.filter(file => file.kind !== "folder" && !file.hidden).length;
    return { lines: [`${active.name}: ${count} ${count === 1 ? "file" : "files"}${active.dirty ? ", unsaved changes" : ""}.`] };
  }
  return { lines: [`Unknown command: ${typed}. Type help to list commands.`] };
}
/** What the Plots and Tables panes need from the app: the active report's data files, its desktop calls and Messages. */
function generatorHost(): GeneratorHost {
  return {
    desktop: !api.preview,
    // Spreadsheets beside the report file, then those still kept in data/ by older reports.
    dataFiles: () => [...(active?.inputs ?? []), ...(active?.files ?? []).filter(file => file.kind !== "folder" && isDataSpreadsheet(file.path)).map(file => file.path)],
    pickSource: () => active ? api.pickSpreadsheet(active.id) : Promise.resolve(null),
    sheets: source => active ? api.sheets(active.id, source) : Promise.resolve([]),
    code: settings => api.generatedCode(active!.id, settings),
    build: (kind, code, keys) => api.previewGenerated(active!.id, kind, code, keys),
    save: async (kind, code, source, keys) => {
      const project = active!;
      try {
        const file = await api.saveGenerated(project.id, kind, code, source);
        report(`Saved ${file}. Write ${includeLine(kind, file.slice(kind.length + 2), keys)} in main.tex to show it.`, "info", project);
      } catch (error) { report(`Could not save the ${kind}: ${problemText(error)}`, "error", project); }
    },
    optionsShare: () => prefs.generatorOptionsShare,
    saveOptionsShare: share => { settingsStore.updateSettings({ generatorOptionsShare: share }); for (const pane of generatorPanes) pane.applyLayout(); },
    codeShare: () => prefs.generatorCodeShare,
    saveCodeShare: share => { settingsStore.updateSettings({ generatorCodeShare: share }); for (const pane of generatorPanes) pane.applyLayout(); },
    editorSettings: () => prefs.editor,
    editorFontSize: () => editorSize,
    problem: text => report(text, "error"),
  };
}
/** The message of an error, without the prefix Electron adds to errors from the desktop side. */
function problemText(error: unknown): string {
  const text = String(error).replace(/^Error: Error invoking remote method '[^']+': /, "").replace(/^Error: /, "");
  return /[.!?]$/.test(text) ? text : `${text}.`;
}
/** `plots`, `tables`, `plot …` and `table …`: listings, new plots and tables, regenerate, removal, plot defaults and table format. */
async function generatorCommand(verb: "plots" | "tables" | "plot" | "table", args: string[]): Promise<ConsoleResult> {
  const project = active!;
  const kind = verb.startsWith("plot") ? "plot" : "table";
  const folder = `${kind}s`;
  const items = await api.generated(project.id, kind);
  if (verb === "plots" || verb === "tables") {
    if (!items.length) return { lines: [`No ${folder} yet. Add one with ${kind} add.`] };
    return { lines: items.map((item, index) => ({ marker: `[${index + 1}]`, label: item.file, comment: listingComment(item) })) };
  }
  if (api.preview) return { lines: [`${kind === "plot" ? "Plots" : "Tables"} need the LabForge desktop app.`] };
  const [action, target, ...rest] = args;
  if (action === "add") {
    const settings = kind === "plot" ? plotFromArguments(args.slice(1)) : tableFromArguments(args.slice(1));
    if (typeof settings === "string") return { lines: [settings] };
    const file = await api.createGenerated(project.id, settings);
    const name = file.slice(folder.length + 1);
    return { lines: [`Saved ${file}. Write ${includeLine(kind, name, "")} in main.tex to show it.`] };
  }
  if (kind === "plot" && action === "defaults") {
    const values = readPlotDefaults(editor.text, await api.read(project.id, ".settings.tex"));
    return { lines: plotDefaults.map(item => { const value = values.get(item.key)!; return { label: item.key, comment: value.custom ? `${value.value}, report override` : value.value }; }) };
  }
  if (kind === "plot" && action === "default") {
    if (!target) return { lines: [`Plot defaults: ${plotDefaults.map(item => item.key).join(", ")}. Type plot defaults to see their values.`] };
    const spec = plotDefaults.find(item => item.key === target.replace(/^plot-/, ""));
    if (!spec) return { lines: [`Unknown plot default: ${target}. Type plot defaults to list them.`] };
    const current = readPlotDefaults(editor.text, await api.read(project.id, ".settings.tex")).get(spec.key)!;
    if (!rest.length) return { lines: [`plot-${spec.key} is ${current.value}${current.custom ? " (report override)" : " (class default)"}.`] };
    const value = rest.join(" ");
    if (!spec.pattern.test(value)) return { lines: [`plot-${spec.key} takes ${spec.hint}.`] };
    if (current.custom && current.value === value) return { lines: [`plot-${spec.key} is already ${value}.`] };
    const next = setPlotDefault(editor.text, spec.key, value);
    if (next === null) return { lines: ["main.tex has no \\documentclass{.labforge} line. Add one to set plot defaults."] };
    // The default is written into the preamble of main.tex as one undoable edit, and saved so the previews read it.
    editor.applyText(next);
    await saveText(project);
    return { lines: [`plot-${spec.key} set to ${value} in the preamble of main.tex.`] };
  }
  if (action === "regenerate" && target === "all") {
    const files = items.filter(item => item.settings).map(item => item.file);
    if (!files.length) return { lines: [`No ${folder} to regenerate: none has LabForge settings.`] };
    return { lines: regenerateLines(await api.regenerate(project.id, files)) };
  }
  const item = findGenerated(items, target ?? "");
  if (!item) return { lines: [`No ${kind} ${target}. Type ${folder} to list them.`] };
  if (action === "open") { await api.external(project.id, item.file); return { lines: [`Opened ${item.file}.`] }; }
  if (action === "remove") {
    updateSnapshot(await api.trash(project.id, item.file));
    return { lines: [`Moved ${item.file} to the ${api.platform === "win32" ? "Recycle Bin" : "Trash"}.`] };
  }
  if (action === "regenerate") return { lines: regenerateLines(await api.regenerate(project.id, [item.file])) };
  // header, align and smart: tables written by LabForge only.
  const settings = item.settings;
  if (!settings || settings.kind !== "table") return { lines: [`${item.file} has no LabForge settings line, so its format cannot be changed here. Edit the file instead.`] };
  const value = rest[0];
  if (action === "header" || action === "smart") {
    const current = action === "header" ? settings.header : smartOn(settings.smart);
    const name = action === "header" ? "Header row" : "Smart formatting";
    if (!value) return { lines: [`${name} is ${current ? "on" : "off"} for ${item.file}.`] };
    if ((value === "on") === current) return { lines: [`${name} is already ${value} for ${item.file}.`] };
    const next: GeneratorSettings = action === "header" ? { ...settings, header: value === "on" } : { ...settings, smart: value === "on" };
    await api.rewriteGenerated(project.id, item.file, next);
    return { lines: [`${name} turned ${value} for ${item.file}; the table was written again from its settings.`] };
  }
  const text = await api.read(project.id, item.file);
  const written = tableColumns(/\\(?:begin\{labtable\}|tablecolumns)\{([^{}]*)\}/.exec(text)?.[1] ?? "") ?? [];
  const columns = rest.join(" ");
  if (!columns) return { lines: [`Columns of ${item.file} are ${written.join(" ") || "unknown"}${settings.columns ? "" : " (automatic)"}.`] };
  const wanted = columns === "auto" ? [] : tableColumns(columns) ?? [];
  if (columns !== "auto" && wanted.length !== written.length) return { lines: [`${item.file} has ${written.length} columns; give ${written.length} letters, such as ${"lcr".repeat(written.length).slice(0, written.length)}, each with an optional width such as c[2].`] };
  const next: GeneratorSettings = { ...settings };
  if (columns === "auto") delete next.columns; else next.columns = wanted.join(" ");
  await api.rewriteGenerated(project.id, item.file, next);
  return { lines: [columns === "auto" ? `Columns of ${item.file} follow the data file again.` : `Columns of ${item.file} set to ${next.columns}.`] };
}
function regenerateLines(results: { file: string; changed?: boolean; error?: string }[]): string[] {
  return results.map(result => result.error ? `${result.file} was not regenerated: ${problemText(result.error)}` : result.changed ? `${result.file} regenerated.` : `${result.file} is already current.`);
}
/** `preset`, `language` and `bibliography` show or set an option of the class line of main.tex. */
function classCommand(verb: "preset" | "language" | "bibliography", arg: string): ConsoleResult {
  const options = readClassOptions(editor.text);
  if (!options) return { lines: ["main.tex has no \\documentclass{.labforge} line. Add one to use this command."] };
  const name = verb[0].toUpperCase() + verb.slice(1);
  const current = verb === "bibliography" ? (options.bibliography ? "on" : "off") : options[verb];
  if (!arg) return { lines: [`${name} is ${current}.`] };
  if (verb === "preset" && !active?.presets.includes(arg)) return { lines: [`Preset ${arg} is not defined in .settings.tex. Add a \\labforgepreset{${arg}}{...} block there first.`] };
  if (arg === current) return { lines: [`${name} is already ${arg}.`] };
  setClassOptions(verb === "bibliography" ? { bibliography: arg === "on" } : { [verb]: arg });
  return { lines: [`${name} set to ${arg}.`] };
}
/** Tab completion from the command catalogue: verbs available now, then their first and second words. */
function complete(line: string): string[] {
  const welcome = !active;
  if (!line.includes(" ")) return commands.filter(command => !welcome || availableOnWelcome.has(command.name)).map(command => command.name).filter(name => name.startsWith(line));
  const parts = line.split(" ");
  const verb = parts[0];
  if (verb === "editor") return editorCompletions(line);
  if (editorFamilies.some(family => family.name === verb)) return editorCompletions(`editor ${line}`).map(item => item.slice(7));
  if (parts.length === 3 && verb === "files") {
    const choices = parts[1] === "hidden" ? ["on", "off"] : [];
    return choices.map(choice => `files ${parts[1]} ${choice}`).filter(item => item.startsWith(line));
  }
  if (parts.length !== 2) return [];
  return (verb === "preset" ? active?.presets ?? [] : firstArguments(verb, welcome)).map(choice => `${verb} ${choice}`).filter(item => item.startsWith(line));
}

function setupPdfSplitter(): void {
  const split = $("pdf-split");
  split.addEventListener("pointerdown", event => {
    if (!active) return;
    split.setPointerCapture(event.pointerId);
    const start = event.clientX; const width = active.pdfWidth;
    const move = (next: PointerEvent) => { if (!active) return; active.pdfWidth = Math.max(25, Math.min(75, width - (next.clientX - start) / $("writing-workspace").clientWidth * 100)); $("pdf-side").style.width = `${active.pdfWidth}%`; };
    const stop = () => { split.removeEventListener("pointermove", move); split.removeEventListener("pointerup", stop); };
    split.addEventListener("pointermove", move); split.addEventListener("pointerup", stop);
  });
  split.addEventListener("keydown", event => {
    if (!active || !["ArrowLeft", "ArrowRight"].includes(event.key)) return;
    event.preventDefault(); active.pdfWidth = Math.max(25, Math.min(75, active.pdfWidth + (event.key === "ArrowLeft" ? 2 : -2))); $("pdf-side").style.width = `${active.pdfWidth}%`;
  });
}
/**
 * The welcome page's backdrop: the text of `assets/welcome.tex`, laid out and coloured exactly as the editor draws it (same gutter, text size,
 * bracket colours), so opening a report changes nothing but the fade. Faded out behind the actions.
 */
function welcomeSketch(): HTMLElement {
  const lines = __LABFORGE_WELCOME__.replace(/\r\n/g, "\n").trimEnd().split("\n");
  const whole = lines.join("\n");
  const depths = new Map(bracketDepths(whole, 0, whole.length));
  const backdrop = document.createElement("div");
  backdrop.className = "empty-backdrop"; backdrop.setAttribute("aria-hidden", "true");
  const sketch = document.createElement("div");
  sketch.className = "empty-sketch";
  let offset = 0;
  lines.forEach((text, index) => {
    const row = document.createElement("div");
    const number = document.createElement("span"); number.className = "empty-sketch-number"; number.textContent = String(index + 1);
    row.append(number);
    // One class list per character (token colour, bracket colour), joined into runs of equal classes.
    const classes: string[] = [];
    for (const run of latexRuns(text)) for (let i = 0; i < run.text.length; i++) classes.push(run.kind ? `syntax-${run.kind}` : "");
    for (let i = 0; i < text.length; i++) {
      const depth = depths.get(offset + i);
      if (depth === undefined) continue;
      classes[i] = [prefs.editor.bracketColors ? `cm-bracket-${depth % 3 + 1}` : "", prefs.editor.bracketDimmed ? `cm-bracket-dim-${Math.min(depth, 5) + 1}` : "", classes[i]].filter(Boolean).join(" ");
    }
    for (let i = 0; i < text.length;) {
      let j = i; while (j < text.length && classes[j] === classes[i]) j++;
      if (!classes[i]) row.append(text.slice(i, j));
      else { const span = document.createElement("span"); span.className = classes[i]; span.textContent = text.slice(i, j); row.append(span); }
      i = j;
    }
    offset += text.length + 1;
    sketch.append(row);
  });
  backdrop.append(sketch);
  return backdrop;
}
/** Tells the backdrop where the welcome title, buttons and hint are (`--welcome-box-*`, in px from its top left), so its fade is measured from them and not from the page. */
function trackWelcomeBox(welcome: HTMLElement, backdrop: HTMLElement): void {
  const measure = (): void => {
    const area = backdrop.getBoundingClientRect();
    const boxes = [...welcome.children].filter(child => child !== backdrop).map(child => child.getBoundingClientRect()).filter(box => box.width && box.height);
    if (!area.width || !boxes.length) return;
    const left = Math.min(...boxes.map(box => box.left)), right = Math.max(...boxes.map(box => box.right));
    const top = Math.min(...boxes.map(box => box.top)), bottom = Math.max(...boxes.map(box => box.bottom));
    const set = (name: string, value: number) => backdrop.style.setProperty(name, `${Math.round(value)}px`);
    set("--welcome-box-width", right - left); set("--welcome-box-height", bottom - top);
    set("--welcome-box-x", (left + right) / 2 - area.left); set("--welcome-box-y", (top + bottom) / 2 - area.top);
  };
  const observer = new ResizeObserver(measure);
  observer.observe(backdrop);
  for (const child of welcome.children) if (child !== backdrop) observer.observe(child);
  measure();
}
async function boot(): Promise<void> {
  window.addEventListener("blur", () => autosave.blurred(projects));
  window.addEventListener("unload", () => health.dispose(), { once: true });
  const closePdf = $<HTMLButtonElement>("pdf-close");
  closePdf.innerHTML = UI_ICONS.close;
  $("pdf-prev").innerHTML = UI_ICONS.chevronLeft; $("pdf-next").innerHTML = UI_ICONS.chevronRight;
  setTip(closePdf, "Close PDF preview.");
  closePdf.addEventListener("click", () => { if (!active) return; active.pdfOpen = false; renderTree(); void loadPdf(); });
  const welcome = createEmptyState($("canvas-wrap"), { ...forgeApp.document.welcome, newShortcut: shortcutText("CmdOrCtrl+N"),
    openShortcut: shortcutText("CmdOrCtrl+O"), onNew: () => { void create(); }, onOpen: () => { void open(); } });
  if (forgeApp.identity.repository) void showUpdateNotice(welcome, infoOptions(__LABFORGE_LOGO__.trimEnd(), __FORGE_VERSION__), forgeApp.identity.repository,
    { platform: api.preview ? undefined : api.platform, install: api.installUpdate, onProgress: api.onUpdateProgress,
      storageKey: `${settingsStorageKey(forgeApp)}.updates` });
  const backdrop = welcomeSketch();
  welcome.prepend(backdrop);
  trackWelcomeBox(welcome, backdrop);
  // Reports dropped from Finder or File Explorer open, one after another; the file tree takes the drops made on it.
  if (api.pathForFile) attachFileDrop($("canvas-wrap"), { accept: [".lfg"], label: "Drop a report to open it.", pathFor: file => api.pathForFile!(file),
    onRefused: text => report(text, "error"),
    onFiles: async dropped => { for (const item of dropped) if (item.path) await openReportAt(item.path); } });
  document.body.dataset.theme = prefs.appearance;
  document.body.dataset.inspectorSide = prefs.inspectorSide;
  // macOS desktop: room for the window buttons, except in full screen.
  applyDesktopClasses(window.labforge);
  setupToolbar();
  tabs = new DocumentTabs<ProjectView>($("doc-tabs"), { newTitle: forgeApp.document.tabs.newTitle, closeTitle: forgeApp.document.tabs.closeTitle, onNew: () => { void create(); }, onActivate: project => { void activate(project); }, onClose: project => { void close(project); },
    // Dragging a tab rearranges the open reports; the order is kept for this window only.
    onReorder: (from, to) => { projects.splice(0, projects.length, ...moveItem(projects, from, to)); renderTabs(); } });
  status = new StatusBar($("statusbar"), () => { if (!prefs.showBottomPanel) updatePrefs({ showBottomPanel: true }); selectBottom("messages"); });
  selectBottom = createBottomTabs($("bottom-tabs"), [
    { name: "terminal", element: $("terminal-pane"), onSelect: () => terminal?.show() },
    { name: "plots", element: $("plots-pane") }, { name: "tables", element: $("tables-pane") },
    { name: "messages", element: $("messages-pane"), onSelect: () => { if (prefs.showBottomPanel) active?.logs.markSeen(); messages.refresh(true); updateStatus(); } },
  ]);
  $("bottom-tabs").append(clearMessages);
  terminal = new TerminalPanel($("terminal-pane"), __LABFORGE_LOGO__, __FORGE_VERSION__, { execute: consoleCommand, complete },
    { appName: forgeApp.identity.name, tagline: forgeApp.identity.purpose, historyStorageKey: terminalHistoryStorageKey(forgeApp), fontSize: () => prefs.terminalFontSize,
      setFontSize: size => updatePrefs({ terminalFontSize: size }), onFontSizeChange: listener => settingsStore.onSettingsChange(listener) });
  generatorPanes = [new GeneratorPane($("plots-pane"), "plot", generatorHost()), new GeneratorPane($("tables-pane"), "table", generatorHost())];
  applyLayout = createPanelLayout({ center: $("center"), inspector: $("inspector"), inspectorSplit: $("inspector-split"), bottom: $("bottom"), bottomSplit: $("bottom-split"),
    settings: prefs, defaults: { inspectorWidth: 246, bottomPanelHeight: 246 }, save: updatePrefs });
  selectBottom("terminal");
  setEditorSize(prefs.editorFontSize);
  setupPdfSplitter();
  refreshMenu();
  document.addEventListener("keydown", event => {
    if (event.defaultPrevented) return;
    if ((event.metaKey || event.ctrlKey) && !event.altKey) {
      const zoom = event.code === "Equal" || event.code === "NumpadAdd" ? "view.zoomIn"
        : event.code === "Minus" || event.code === "NumpadSubtract" ? "view.zoomOut"
        : event.code === "Digit1" || event.code === "Numpad1" ? "view.actualSize" : null;
      if (zoom && active) { event.preventDefault(); void runAction(zoom); return; }
    }
    const menu = menuForState(currentMenuState(), { desktop: !api.preview, mac: isMac });
    // Role items (Cut, Copy, Paste) are not collected; Select all stays native too, so text fields, the editor and the Terminal handle them themselves.
    for (const shortcut of collectShortcuts(menu)) if (shortcut.id !== "edit.selectAll" && matchesKey(event, shortcut.key)) { event.preventDefault(); void runAction(shortcut.id); return; }
  });
  api.onOpened(value => { void include(value); });
  api.onOpenRequest?.(file => { void openReportAt(file); });
  api.onChanged(value => { const hadPdf = projects.find(item => item.id === value.id)?.hasPdf ?? false; const project = updateSnapshot(value); if (project === active && !hadPdf && value.hasPdf && !value.building) void loadPdf(); void checkExternal(project); void checkSupportingExternal(project); });
  api.onError((id, error) => report(problemText(error), "error", projects.find(item => item.id === id) ?? null));
  api.onCommand(id => { void runAction(id); });
  api.onCloseRequest(() => { void (async () => { for (const project of [...projects]) if (!(await close(project))) { api.closeCancel(); return; } api.closeReady(); })(); });
  for (const value of await api.listOpen()) updateSnapshot(value);
  // Checked before the first report opens, so its Messages show the warning at once.
  try { const tex = await api.checkTex("xelatex"); texWarning = tex.ok ? "" : tex.message; texLink = tex.ok ? null : { url: tex.url }; } catch { texWarning = ""; }
  for (const project of projects) warnTex(project);
  if (projects.length) await activate(projects[0]); else setWorkspace();
  await restoreDrafts();
}
void boot().catch(error => { const empty = document.getElementById("empty-state"); if (empty) empty.textContent = `LabForge could not start: ${String(error)}`; });
