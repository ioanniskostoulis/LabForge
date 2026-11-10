// Licensed under the GNU General Public License v2 or later. See LICENSE.
import { app, BrowserWindow, clipboard, dialog, ipcMain, Menu, shell, utilityProcess, type UtilityProcess } from "electron";
import * as fs from "node:fs";
import { readdir, writeFile } from "node:fs/promises";
import * as path from "node:path";
import { randomUUID } from "node:crypto";
import { createNativeMenuTemplate } from "forge-shell/desktop/native-menu";
import { forwardFullScreen } from "forge-shell/desktop/full-screen";
import { DARK_WINDOW_BACKGROUND, registerTitleBarIpc, usesNativeMenu, windowChrome } from "forge-shell/desktop/title-bar";
import { registerUpdater } from "forge-shell/desktop/updater";
import { registerExportIpc } from "forge-shell/desktop/export-main";
import type { ExportFormat } from "forge-shell/app/export-plan";
import { forgeApp } from "../app/profile";
import { menuForState, type MenuState } from "../app/menu-definition";
import { editorDefaults, restoreEditorSettings } from "../app/editor-settings";
import { filesDefaults, restoreFilesSettings } from "../app/file-settings";
import { addProjectFile, closeProjectArchive, copyProjectFile, createProjectFolder, createUntitledProject, migrateProjectDotFiles, migrateProjectStyles, refreshProjectClass, listProjectFiles, openProjectArchive, isLegacyArchive, convertLegacyArchive, exportProjectZipBytes, readProjectSettings, readProjectText, removableProjectPath, renameProjectFile, resolveProjectFile, saveProjectArchiveAs, updateProjectSettings, writeProjectText, type ProjectArchive, type ProjectBuilder } from "../engine/project-archive";
import { buildProjectPdf } from "../engine/tex-build";
import { pdfAt, sourceAt } from "../engine/synctex";
import { checkTex, isTexDownload } from "../engine/tex-check";
import { dataFile, generatedCode, listBeside, listGenerated, regenerate, saveGenerated, type GeneratedKind } from "../engine/generated-files";
import { spreadsheetExtensions } from "../engine/project-paths";
import type { GeneratorSettings } from "../engine/generators";
import { previewGenerated } from "../engine/generated-preview";
import { sheetNames } from "../engine/spreadsheets";
import { presetNames } from "../app/document-class";

type Session = { id: string; project: ProjectArchive; watcher: fs.FSWatcher | null; watchTimer: NodeJS.Timeout | null; building: boolean; pdfStale: boolean; abort?: AbortController };
const sessions = new Map<string, Session>();
const exportFormats: ExportFormat[] = [{ id: "zip", name: "ZIP archive", extensions: ["zip"], mime: "application/zip" }];
function projectSourceFiles(): string[] {
  const files: string[] = [];
  const visit = (folder: string) => {
    for (const item of fs.readdirSync(folder, { withFileTypes: true })) {
      const full = path.join(folder, item.name);
      if (item.isSymbolicLink()) continue;
      if (item.isDirectory()) visit(full); else if (item.isFile()) files.push(full);
    }
  };
  for (const session of sessions.values()) visit(session.project.root);
  return files;
}
const exportIpc = registerExportIpc(ipcMain, {
  formats: exportFormats,
  ignoreCase: process.platform !== "linux",
  protectedPaths: () => projectSourceFiles(),
  saveDialog: async (event, options) => {
    const owner = BrowserWindow.fromWebContents(event.sender as Electron.WebContents);
    const result = owner ? await dialog.showSaveDialog(owner, options) : await dialog.showSaveDialog(options);
    return result.canceled || !result.filePath ? null : result.filePath;
  },
  folderDialog: async (event, options) => {
    const owner = BrowserWindow.fromWebContents(event.sender as Electron.WebContents);
    const settings = { ...options, properties: ["openDirectory", "createDirectory"] as ("openDirectory" | "createDirectory")[] };
    const result = owner ? await dialog.showOpenDialog(owner, settings) : await dialog.showOpenDialog(settings);
    return result.canceled ? null : result.filePaths[0] ?? null;
  },
  readdir: folder => readdir(folder),
  writeFile: (file, bytes, flag) => writeFile(file, bytes, { flag }),
  resolve: file => path.resolve(file),
  dirname: file => path.dirname(file),
});
let window: BrowserWindow | null = null;
let activeId: string | null = null;
let pendingFile: string | null = null;
let closeAllowed = false;
let closeRequested = false;
/** An update is waiting for the app to quit: the window closes through the usual unsaved-work check, then the app quits. */
let quitAfterClose = false;
let menuState: MenuState = { hasReport: false, showInspector: true, showBottomPanel: true, editor: editorDefaults, files: filesDefaults, appearance: "dark" };
type InputSourceBridge = { begin(handle?: Buffer): boolean; restore(): boolean };
let inputSourceBridge: InputSourceBridge | null | undefined;
let commandEditorActive = false;

/* Spelling runs in a utility process with the dictionaries in the app's resources; added words are kept for every report. */
let speller: UtilityProcess | null = null;
let spellRequest = 0;
const spellPending = new Map<number, { resolve: (words: string[]) => void; reject: (error: Error) => void }>();
const addedWordsFile = () => path.join(app.getPath("userData"), "spelling-words.txt");
function addedWords(): string[] {
  try { return fs.readFileSync(addedWordsFile(), "utf8").split(/\r?\n/).filter(Boolean); } catch { return []; }
}
function spelling(request: { kind: "check"; words: string[] } | { kind: "suggest"; word: string } | { kind: "accept"; words: string[] }): Promise<string[]> {
  if (!speller) {
    const child = utilityProcess.fork(path.join(__dirname, "spell-worker.cjs"), [resourceFolder("spelling")], { serviceName: "LabForge spelling" });
    speller = child;
    child.on("message", (message: { id: number; result?: string[]; error?: string }) => {
      const pending = spellPending.get(message.id);
      if (!pending) return;
      spellPending.delete(message.id);
      if (message.error) pending.reject(new Error(message.error)); else pending.resolve(message.result ?? []);
    });
    child.on("exit", () => {
      if (speller === child) speller = null;
      for (const pending of spellPending.values()) pending.reject(new Error("The spelling process stopped. Edit the text to check it again."));
      spellPending.clear();
    });
    const words = addedWords();
    if (words.length) child.postMessage({ id: ++spellRequest, kind: "accept", words });
  }
  const id = ++spellRequest;
  return new Promise((resolve, reject) => { spellPending.set(id, { resolve, reject }); speller!.postMessage({ id, ...request }); });
}

/** Complete the switch in Electron's process before the next key can arrive. */
function commandInputSource(action: "begin" | "restore"): boolean {
  if (process.platform !== "darwin" && process.platform !== "win32") return false;
  if (inputSourceBridge === undefined) {
    const name = process.platform === "win32" ? "win-input-source.node" : "mac-input-source.node";
    const addon = app.isPackaged ? path.join(process.resourcesPath, "native", name) : path.resolve(__dirname, "../native", name);
    try { inputSourceBridge = require(addon) as InputSourceBridge; }
    catch { inputSourceBridge = null; }
  }
  if (!inputSourceBridge) return false;
  if (action === "restore") return inputSourceBridge.restore();
  return inputSourceBridge.begin(process.platform === "win32" ? window?.getNativeWindowHandle() : undefined);
}

function selected(id: string): Session {
  const session = sessions.get(id);
  if (!session) throw new Error("That report is not open.");
  return session;
}
/** The folder that holds the report file, where spreadsheets are read from; none until the report is saved. */
function beside(session: Session): string | undefined { return session.project.archive ? path.dirname(session.project.archive) : undefined; }
function snapshot(session: Session) {
  const { project } = session; const settings = readProjectSettings(project);
  const styleFile = path.join(project.root, ".settings.tex");
  return { id: session.id, name: project.archive ? path.basename(project.archive) : settings.name, projectName: settings.name, builder: settings.builder, archive: project.archive,
    files: listProjectFiles(project), inputs: listBeside(beside(session)), presets: fs.existsSync(styleFile) ? presetNames(fs.readFileSync(styleFile, "utf8")) : ["default"],
    hasPdf: fs.existsSync(path.join(project.root, "main.pdf")), building: session.building, pdfStale: session.pdfStale };
}
function notify(session: Session): void { window?.webContents.send("project:changed", snapshot(session)); }
/** Reports the project's files again after a change made outside LabForge, such as in Finder or another editor. */
function watch(session: Session): void {
  session.watcher?.close();
  try {
    session.watcher = fs.watch(session.project.root, { recursive: true }, (_event, name) => {
      if (session.building || (name && name.split(/[\\/]/)[0] === ".build")) return;
      if (name === ".settings.tex" || name === "settings.tex") session.pdfStale ||= fs.existsSync(path.join(session.project.root, "main.pdf"));
      if (session.watchTimer) clearTimeout(session.watchTimer);
      session.watchTimer = setTimeout(() => notify(session), 450);
    });
  } catch { session.watcher = null; }
}
function include(project: ProjectArchive): ReturnType<typeof snapshot> {
  const already = project.archive ? [...sessions.values()].find(item => item.project.archive === project.archive) : undefined;
  if (already) { closeProjectArchive(project); activeId = already.id; return snapshot(already); }
  const session: Session = { id: randomUUID(), project, watcher: null, watchTimer: null, building: false, pdfStale: false };
  sessions.set(session.id, session);
  activeId = session.id;
  watch(session);
  return snapshot(session);
}
/** Where the report template and class are: the app's resources when packaged (`framework`, `templates`), the repository's `assets` folder otherwise. */
function resourceFolder(...parts: string[]): string {
  return path.join(app.isPackaged ? process.resourcesPath : path.resolve(__dirname, "../../assets"), ...parts);
}
function open(file: string, convertLegacy = false): ReturnType<typeof snapshot> & { staleGenerated?: string[] } {
  const absolute = path.resolve(file);
  const already = [...sessions.values()].find(item => item.project.archive === absolute);
  if (already) { activeId = already.id; return snapshot(already); }
  if (fs.existsSync(absolute) && isLegacyArchive(absolute)) {
    if (!convertLegacy) throw new Error("This report is an older ZIP archive and needs confirmation before conversion.");
    convertLegacyArchive(absolute);
  }
  const project = openProjectArchive(absolute);
  migrateProjectDotFiles(project);
  migrateProjectStyles(project, resourceFolder("templates", "report", "settings.tex"));
  refreshProjectClass(project, resourceFolder("framework"));
  app.addRecentDocument(absolute);
  return { ...include(project), staleGenerated: staleGenerated(project.root, project.archive ? path.dirname(project.archive) : undefined) };
}
/** Generated plots and tables whose data file changed or is missing, for the note shown when a report opens. */
function staleGenerated(root: string, base?: string): string[] {
  try { return [...listGenerated(root, "plot", base), ...listGenerated(root, "table", base)].filter(item => item.stale || item.missing.length).map(item => item.file); }
  catch { return []; }
}
function dispose(session: Session): void {
  if (session.watchTimer) clearTimeout(session.watchTimer);
  session.watcher?.close();
  closeProjectArchive(session.project);
  sessions.delete(session.id);
  if (activeId === session.id) activeId = sessions.keys().next().value ?? null;
}
function command(id: string): void { window?.webContents.send("app:command", id); }
function installMenu(): void {
  // Windows draws the menus in the page, beside the native window controls; no native menu bar is installed.
  if (!usesNativeMenu(process.platform)) { Menu.setApplicationMenu(null); return; }
  const template = createNativeMenuTemplate(menuForState(menuState, { desktop: true, mac: process.platform === "darwin" }), { productName: "LabForge", isMac: process.platform === "darwin", isPackaged: app.isPackaged,
    onCommand: (id) => command(id) });
  Menu.setApplicationMenu(Menu.buildFromTemplate(template as Electron.MenuItemConstructorOptions[]));
}
function createWindow(): void {
  window = new BrowserWindow({ width: 1480, height: 920, minWidth: 860, minHeight: 560, title: "LabForge", show: false, backgroundColor: DARK_WINDOW_BACKGROUND,
    ...windowChrome(process.platform),
    webPreferences: { preload: path.join(__dirname, "preload.cjs"), contextIsolation: true, nodeIntegration: false, spellcheck: false } });
  // This runs before the backslash reaches CodeMirror. The renderer must not
  // synchronously wait for a system source change triggered from its key event.
  window.webContents.on("before-input-event", (_event, input) => {
    if (commandEditorActive && input.type === "keyDown" && input.key === "\\" && !input.meta && !input.control) commandInputSource("begin");
  });
  installMenu();
  const url = !app.isPackaged ? process.env.FORGE_DEV_URL : undefined;
  if (url) void window.loadURL(new URL("/index.html", url).href);
  else void window.loadFile(path.join(__dirname, "../app/index.html"));
  window.on("close", event => {
    if (closeAllowed) return;
    event.preventDefault();
    if (!closeRequested) { closeRequested = true; window?.webContents.send("app:close-request"); }
  });
  window.on("closed", () => { if (window) exportIpc.forget(window.webContents.id); window = null; if (quitAfterClose) app.quit(); });
  window.on("blur", () => { commandEditorActive = false; commandInputSource("restore"); });
  // Shown once the page has painted in its saved appearance, so no window colour flashes first.
  window.once("ready-to-show", () => window?.show());
  // macOS full screen has no window buttons: the shell then moves the tools to the left edge.
  forwardFullScreen(window);
  window.webContents.on("did-finish-load", () => {
    if (pendingFile) {
      window?.webContents.send("project:open-request", pendingFile);
      pendingFile = null;
    }
  });
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  // CI launch check: FORGE_CAPTURE names a PNG to write once the page has loaded and settled.
  const capture = process.env.FORGE_CAPTURE;
  if (capture) {
    const target = window;
    target.webContents.once("did-finish-load", () => setTimeout(async () => {
      try {
        const image = await target.webContents.capturePage();
        // Publish only the complete PNG: CI polls for its existence before opening it.
        fs.writeFileSync(`${capture}.tmp`, image.toPNG());
        fs.renameSync(`${capture}.tmp`, capture);
        console.log(`capture: wrote ${capture}`);
      } catch (error) {
        console.error(`capture: ${String(error)}`);
      }
    }, Number(process.env.FORGE_CAPTURE_DELAY ?? 5000)));
  }
}

ipcMain.handle("project:list-open", () => [...sessions.values()].map(snapshot));
ipcMain.handle("project:new", () => {
  let number = 1;
  while ([...sessions.values()].some(session => snapshot(session).name === `Untitled ${number}`)) number++;
  return include(createUntitledProject(`Untitled ${number}`, resourceFolder("templates", "report"), resourceFolder("framework")));
});
ipcMain.handle("project:open", async () => {
  // Windows cannot choose files and folders in one dialog; a .lfg there is a folder.
  const choice = await dialog.showOpenDialog(window!, { title: "Open LabForge report", properties: [...(process.platform === "win32" ? [] : ["openFile" as const]), "openDirectory", "multiSelections"], filters: process.platform === "win32" ? [] : [{ name: "LabForge report", extensions: ["lfg"] }] });
  return choice.canceled ? [] : choice.filePaths;
});
ipcMain.handle("project:is-legacy", (_event, file: string) => typeof file === "string" && fs.existsSync(file) && isLegacyArchive(file));
/** Opens a report by its path after any legacy conversion choice was made in the page. */
ipcMain.handle("project:open-path", (_event, file: string, convertLegacy = false) => {
  if (typeof file !== "string" || !file.toLowerCase().replace(/[\\/]+$/, "").endsWith(".lfg")) throw new Error("Only LabForge reports (.lfg) open from Open recent.");
  if (!fs.existsSync(file)) throw new Error(`${path.basename(file)} is no longer there. It was removed from Open recent.`);
  return open(file, convertLegacy === true);
});
ipcMain.handle("project:export-bytes", (_event, id: string) => exportProjectZipBytes(selected(id).project));
ipcMain.handle("project:activate", (_event, id: string) => { activeId = selected(id).id; return snapshot(selected(id)); });
ipcMain.handle("project:save", async (_event, id: string) => {
  const session = selected(id);
  if (!session.project.archive) {
    const choice = await dialog.showSaveDialog(window!, { title: "Save LabForge report", defaultPath: `${readProjectSettings(session.project).name}.lfg`, filters: [{ name: "LabForge report", extensions: ["lfg"] }] });
    if (choice.canceled || !choice.filePath) return null;
    saveProjectArchiveAs(session.project, choice.filePath.toLowerCase().endsWith(".lfg") ? choice.filePath : `${choice.filePath}.lfg`);
    if (session.project.archive) app.addRecentDocument(session.project.archive);
    watch(session);
  }
  notify(session);
  return snapshot(session);
});
ipcMain.handle("project:configure", (_event, id: string, patch: { name?: string; builder?: ProjectBuilder }) => {
  const session = selected(id); updateProjectSettings(session.project, patch); notify(session); return snapshot(session);
});
ipcMain.handle("project:close", (_event, id: string) => { dispose(selected(id)); return true; });
ipcMain.handle("project:files", (_event, id: string) => listProjectFiles(selected(id).project));
ipcMain.handle("project:read", (_event, id: string, file: string) => readProjectText(selected(id).project, file));
ipcMain.handle("app:copy-text", (_event, text: string) => { clipboard.writeText(text); });
ipcMain.handle("spell:check", (_event, words: string[]) => spelling({ kind: "check", words }));
ipcMain.handle("spell:suggest", (_event, word: string) => spelling({ kind: "suggest", word }));
ipcMain.handle("spell:ignore", (_event, word: string) => spelling({ kind: "accept", words: [word] }));
ipcMain.handle("spell:add", async (_event, word: string) => {
  if (!addedWords().includes(word)) fs.appendFileSync(addedWordsFile(), `${word}\n`);
  await spelling({ kind: "accept", words: [word] });
});
ipcMain.on("app:command-input-source", (event, action: "begin" | "restore") => {
  if (window && event.sender === window.webContents && (action === "begin" || action === "restore")) commandInputSource(action);
});
ipcMain.on("app:command-input-context", (event, active: boolean) => {
  if (!window || event.sender !== window.webContents || typeof active !== "boolean") return;
  commandEditorActive = active;
  if (!active) commandInputSource("restore");
});
ipcMain.handle("project:write", (_event, id: string, file: string, content: string) => { const session = selected(id); writeProjectText(session.project, file, content); session.pdfStale ||= fs.existsSync(path.join(session.project.root, "main.pdf")); notify(session); return snapshot(session); });
ipcMain.handle("project:rename", (_event, id: string, from: string, to: string) => { const session = selected(id); renameProjectFile(session.project, from, to); session.pdfStale ||= fs.existsSync(path.join(session.project.root, "main.pdf")); notify(session); return snapshot(session); });
ipcMain.handle("project:mkdir", (_event, id: string, folder: string) => { const session = selected(id); createProjectFolder(session.project, folder); notify(session); return snapshot(session); });
ipcMain.handle("project:copy", (_event, id: string, from: string, to: string) => { const session = selected(id); copyProjectFile(session.project, from, to); session.pdfStale ||= fs.existsSync(path.join(session.project.root, "main.pdf")); notify(session); return snapshot(session); });
// The colours of the Windows window controls follow the page's appearance.
// Help › Check for updates… installs a release of the public repository named in forge.config.json.
if (forgeApp.identity.repository && app.isPackaged) registerUpdater(ipcMain, { repository: forgeApp.identity.repository, executable: process.execPath, platform: process.platform,
  quit: () => { quitAfterClose = true; if (window) window.close(); else app.quit(); }, openPath: file => shell.openPath(file) });
registerTitleBarIpc(ipcMain, event => (event.sender === window?.webContents ? window : null));
ipcMain.handle("project:add", async (_event, id: string, folder: string) => {
  const choice = await dialog.showOpenDialog(window!, { title: "Add files to report", properties: ["openFile", "multiSelections"] });
  if (choice.canceled) return snapshot(selected(id));
  const session = selected(id);
  for (const file of choice.filePaths) addProjectFile(session.project, file, folder);
  session.pdfStale ||= fs.existsSync(path.join(session.project.root, "main.pdf"));
  notify(session);
  return snapshot(session);
});
ipcMain.handle("project:add-paths", (_event, id: string, folder: string, paths: string[]) => {
  const session = selected(id);
  for (const file of paths) addProjectFile(session.project, file, folder);
  session.pdfStale ||= fs.existsSync(path.join(session.project.root, "main.pdf"));
  notify(session);
  return snapshot(session);
});
ipcMain.handle("generated:sheets", (_event, id: string, source: string) => { const session = selected(id); return sheetNames(dataFile(session.project.root, source, beside(session))); });
ipcMain.handle("generated:code", (_event, id: string, settings: GeneratorSettings) => { const session = selected(id); return generatedCode(session.project.root, settings, beside(session)); });
/** Saves code as shown in a pane under plots/ or tables/ with the next automatic name, and returns its project path. */
ipcMain.handle("generated:save", (_event, id: string, kind: GeneratedKind, code: string, source?: string) => {
  const session = selected(id);
  const name = saveGenerated(session.project.root, kind, code, source);
  notify(session);
  return `${kind === "plot" ? "plots" : "tables"}/${name}`;
});
/** Choose any spreadsheet; it is named relative to the folder of the report file, or by its full path in an unsaved report. */
ipcMain.handle("generated:pick", async (_event, id: string) => {
  const session = selected(id);
  const base = beside(session);
  const choice = await dialog.showOpenDialog(window!, { title: "Choose a spreadsheet", ...(base ? { defaultPath: base } : {}), properties: ["openFile"],
    filters: [{ name: "Spreadsheets", extensions: spreadsheetExtensions.map(extension => extension.slice(1)) }] });
  if (choice.canceled || !choice.filePaths[0]) return null;
  return base ? path.relative(base, choice.filePaths[0]).split(path.sep).join("/") : choice.filePaths[0];
});
ipcMain.handle("generated:list", (_event, id: string, kind: GeneratedKind) => { const session = selected(id); return listGenerated(session.project.root, kind, beside(session)); });
/** Regenerates the data blocks of each file; a failure is returned with its file so the others still run. */
ipcMain.handle("generated:regenerate", (_event, id: string, files: string[]) => {
  const session = selected(id);
  const results = files.map(file => {
    try { return { file, changed: regenerate(session.project.root, resolveProjectFile(session.project, file), beside(session)) }; }
    catch (error) { return { file, error: error instanceof Error ? error.message : String(error) }; }
  });
  if (results.some(result => result.changed)) { session.pdfStale ||= fs.existsSync(path.join(session.project.root, "main.pdf")); notify(session); }
  return results;
});
/** Writes new code from settings under plots/ or tables/ and returns its project path. */
ipcMain.handle("generated:create", (_event, id: string, settings: GeneratorSettings) => {
  const session = selected(id);
  const source = settings.kind === "table" ? settings.source : settings.series.find(series => series.type === "data" || series.type === "range")?.source;
  const name = saveGenerated(session.project.root, settings.kind, generatedCode(session.project.root, settings, beside(session)), source);
  notify(session);
  return `${settings.kind === "plot" ? "plots" : "tables"}/${name}`;
});
/** Writes a generated file again from changed settings. */
ipcMain.handle("generated:rewrite", (_event, id: string, file: string, settings: GeneratorSettings) => {
  const session = selected(id);
  fs.writeFileSync(resolveProjectFile(session.project, file), generatedCode(session.project.root, settings, beside(session)), "utf8");
  session.pdfStale ||= fs.existsSync(path.join(session.project.root, "main.pdf"));
  notify(session);
});
/** Builds a table or plot preview with the report's class, options and preamble; cached in the report's working folder. */
ipcMain.handle("generated:preview", (_event, id: string, kind: "plot" | "table", code: string, keys?: string) => {
  const { project } = selected(id);
  const text = (file: string) => { const full = path.join(project.root, file); return fs.existsSync(full) ? fs.readFileSync(full, "utf8") : ""; };
  return previewGenerated({ kind, code, keys, classFile: resourceFolder("framework", "labforge.cls"), mainTex: text("main.tex"), settings: text(".settings.tex"),
    builder: readProjectSettings(project).builder, cacheDir: path.join(project.temporary, "previews") });
});
ipcMain.handle("project:external", async (_event, id: string, file: string) => {
  const target = resolveProjectFile(selected(id).project, file);
  if (!fs.statSync(target).isFile()) throw new Error("This project file is unavailable.");
  const result = await shell.openPath(target);
  if (result) throw new Error(result);
});
ipcMain.handle("project:reveal", (_event, id: string, file: string) => {
  const target = resolveProjectFile(selected(id).project, file);
  if (!fs.existsSync(target)) throw new Error("This project file is unavailable.");
  shell.showItemInFolder(target);
});
/** Moves a file or folder of the report to the system Trash, so it stays recoverable. */
ipcMain.handle("project:trash", async (_event, id: string, file: string) => {
  const session = selected(id);
  await shell.trashItem(removableProjectPath(session.project, file));
  session.pdfStale ||= fs.existsSync(path.join(session.project.root, "main.pdf"));
  notify(session);
  return snapshot(session);
});
/** Shows the report in the file manager: a package is revealed (opening it would start LabForge), any other folder is opened. */
ipcMain.handle("project:contents", async (_event, id: string) => {
  const { root } = selected(id).project;
  if (path.extname(root).toLowerCase() === ".lfg") { shell.showItemInFolder(root); return; }
  const result = await shell.openPath(root);
  if (result) throw new Error(result);
});
ipcMain.handle("project:pdf", (_event, id: string) => {
  const file = resolveProjectFile(selected(id).project, "main.pdf");
  return fs.existsSync(file) ? fs.readFileSync(file).toString("base64") : null;
});
// SyncTeX lookups between main.pdf and the report's files; both answer empty until a build has written the links.
ipcMain.handle("project:source-at", (_event, id: string, page: number, x: number, y: number) => sourceAt(selected(id).project.root, page, x, y));
ipcMain.handle("project:pdf-at", (_event, id: string, file: string, line: number) => pdfAt(selected(id).project.root, file, line));
ipcMain.handle("project:build", async (_event, id: string) => {
  const session = selected(id);
  if (session.building) throw new Error("This report is already building.");
  session.building = true; session.abort = new AbortController(); notify(session);
  try {
    refreshProjectClass(session.project, resourceFolder("framework"));
    const result = await buildProjectPdf(session.project, readProjectSettings(session.project).builder, undefined, session.abort.signal);
    session.pdfStale = result.stale;
    notify(session);
    return result;
  } finally { session.building = false; session.abort = undefined; notify(session); }
});
/** Stops the running build of a report; the build then answers as cancelled. */
ipcMain.handle("app:check-tex", (_event, builder: ProjectBuilder) => checkTex(builder));
ipcMain.handle("app:open-link", async (_event, url: string) => { if (isTexDownload(url)) await shell.openExternal(url); });
ipcMain.handle("project:cancel-build", (_event, id: string) => { const session = selected(id); const running = !!session.abort; session.abort?.abort(); return running; });
ipcMain.on("app:close-ready", () => { closeAllowed = true; window?.close(); });
ipcMain.on("app:close-cancel", () => { closeRequested = false; quitAfterClose = false; });
ipcMain.on("app:menu-state", (event, state: MenuState) => {
  if (event.sender !== window?.webContents || !state || typeof state.hasReport !== "boolean" ||
      typeof state.showInspector !== "boolean" || typeof state.showBottomPanel !== "boolean" ||
      !["dark", "light", "pride"].includes(state.appearance)) return;
  // The renderer's editor options are re-validated, so an invalid value falls back to its default.
  const next: MenuState = { hasReport: state.hasReport, showInspector: state.showInspector,
    showBottomPanel: state.showBottomPanel, editor: restoreEditorSettings(state.editor), files: restoreFilesSettings(state.files), appearance: state.appearance,
    building: state.building === true, pdfFollow: state.pdfFollow === true, buildOnSave: state.buildOnSave === true,
    recent: Array.isArray(state.recent) ? state.recent.filter((item): item is string => typeof item === "string").slice(0, 10) : [] };
  if (JSON.stringify(next) === JSON.stringify(menuState)) return;
  menuState = next;
  installMenu();
});

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on("second-instance", (_event, argv) => {
    const file = argv.find(arg => arg.toLowerCase().replace(/[\\/]+$/, "").endsWith(".lfg"));
    if (file) window?.webContents.send("project:open-request", file);
    window?.show(); window?.focus();
  });
  app.on("open-file", (event, file) => { event.preventDefault(); if (!window || window.webContents.isLoading()) pendingFile = file; else {
    window.webContents.send("project:open-request", file);
  } });
  app.whenReady().then(() => { pendingFile ||= process.argv.find(arg => arg.toLowerCase().endsWith(".lfg")) ?? null; createWindow(); });
  app.on("will-quit", () => { commandInputSource("restore"); for (const session of sessions.values()) dispose(session); });
  app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
  app.on("activate", () => { if (!BrowserWindow.getAllWindows().length) createWindow(); });
}
