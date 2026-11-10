// Licensed under the GNU General Public License v2 or later. See LICENSE.
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { archiveBytes, extractArchive, isZip, saveArchive } from "./archive";
import { isProtectedProjectPath, projectClassFile, projectSettingsFile, renameBlockReason } from "./project-paths";
export { isProtectedProjectPath, projectClassFile, projectSettingsFile, renameBlockReason };

export type ProjectFile = { path: string; kind: "folder" | "tex" | "pdf" | "image" | "spreadsheet" | "text" | "other"; size: number; hidden?: true };

/** LaTeX intermediates; they stay out of the archive and are hidden in the inspector. */
const buildFilePattern = /\.(aux|log|bcf|blg|bbl|fls|fdb_latexmk|synctex\.gz|run\.xml|xdv|out|toc|lof|lot)$/;
/** latexmk settings for new projects: XeLaTeX, intermediates in the hidden `.build/` folder, `main.pdf` at the root. */
export const latexmkSettings = "# LabForge build settings, read by latexmk.\n$pdf_mode = 5;\n$aux_dir = '.build';\n$out_dir = '.';\n";
/** Report styles, the class, dot-files and build intermediates are hidden in the inspector by default. */
export function isHiddenProjectPath(relative: string): boolean {
  return relative === "settings.tex" || relative === "labforge.cls" || relative.split("/").some(part => part.startsWith(".")) || buildFilePattern.test(relative);
}
/** `root` is the project folder itself: the `.lfg` package (or any folder with a main.tex) once saved, a temporary folder for an unsaved report. `temporary` is scratch space only; it never holds a saved project. */
export type ProjectArchive = { archive: string | null; root: string; temporary: string };
export type ProjectBuilder = "xelatex" | "pdflatex" | "lualatex";
export type ProjectSettings = { name: string; builder: ProjectBuilder };

const textTypes = new Set([".tex", ".bib", ".sty", ".cls", ".txt", ".md", ".csv"]);
const imageTypes = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"]);
const spreadsheetTypes = new Set([".xlsx", ".xls", ".ods", ".tsv"]);

function workingDirectory(): string { return fs.mkdtempSync(path.join(os.tmpdir(), "labforge-project-")); }
function safeRelative(relative: string): string {
  const parts = relative.split("/");
  if (!relative || path.isAbsolute(relative) || relative.includes("\\") || parts.some(part => !part || part === "." || part === ".." || part.includes(":"))) {
    throw new Error("Choose a path inside the project.");
  }
  return parts.join("/");
}
export function resolveProjectFile(project: ProjectArchive, relative: string): string {
  const full = path.join(project.root, ...safeRelative(relative).split("/"));
  const root = fs.realpathSync(project.root);
  let current = path.dirname(full);
  while (current !== root && current.startsWith(root + path.sep)) {
    if (fs.existsSync(current) && !fs.realpathSync(current).startsWith(root + path.sep)) throw new Error("The project path points outside the project.");
    current = path.dirname(current);
  }
  if (fs.existsSync(full) && !fs.realpathSync(full).startsWith(root + path.sep)) throw new Error("The project path points outside the project.");
  return full;
}
export function createUntitledProject(name: string, template: string, framework: string): ProjectArchive {
  if (!/^Untitled [1-9]\d*$/.test(name)) throw new Error("Choose an Untitled project name.");
  if (!fs.existsSync(path.join(template, "main.tex")) || !fs.existsSync(path.join(framework, "labforge.cls"))) {
    throw new Error("The LabForge TeX template or report class is missing.");
  }
  const temporary = workingDirectory();
  const root = path.join(temporary, "contents");
  try {
    fs.cpSync(template, root, { recursive: true });
    fs.renameSync(path.join(root, "settings.tex"), path.join(root, projectSettingsFile));
    fs.copyFileSync(path.join(framework, "labforge.cls"), path.join(root, projectClassFile));
    // Created here rather than kept in the template: packaging leaves out dot-files and empty folders.
    fs.writeFileSync(path.join(root, ".latexmkrc"), latexmkSettings, "utf8");
    for (const folder of ["graphics", "plots", "tables"]) fs.mkdirSync(path.join(root, folder), { recursive: true });
    fs.writeFileSync(path.join(root, ".labforge.json"), JSON.stringify({ name, builder: "xelatex" }, null, 2) + "\n", "utf8");
    return { archive: null, root, temporary };
  }
  catch (error) { fs.rmSync(temporary, { recursive: true, force: true }); throw error; }
}
/** Gives an unsaved report its place on disk: its folder is copied to `archive`, a `.lfg` package, and the report continues there. */
export function saveProjectArchiveAs(project: ProjectArchive, archive: string): void {
  if (project.archive) throw new Error("This report already has a file.");
  if (path.extname(archive).toLowerCase() !== ".lfg") throw new Error("Choose a .lfg file.");
  if (fs.existsSync(archive)) throw new Error("A file already exists at that location.");
  const destination = path.resolve(archive);
  const settings = readProjectSettings(project);
  if (/^Untitled [1-9]\d*$/.test(settings.name)) updateProjectSettings(project, { name: path.basename(destination, ".lfg") });
  fs.cpSync(project.root, destination, { recursive: true });
  fs.rmSync(project.root, { recursive: true, force: true });
  project.root = destination;
  project.archive = destination;
}
export function createProjectArchive(archive: string, template = path.resolve("assets/templates/report"), framework = path.resolve("assets/framework")): ProjectArchive {
  if (path.extname(archive).toLowerCase() !== ".lfg") throw new Error("Choose a .lfg file.");
  if (fs.existsSync(archive)) throw new Error("A file already exists at that location.");
  const project = createUntitledProject("Untitled 1", template, framework);
  try {
    fs.writeFileSync(path.join(project.root, ".labforge.json"), JSON.stringify({ name: path.basename(archive, ".lfg"), builder: "xelatex" }, null, 2) + "\n", "utf8");
    saveProjectArchiveAs(project, archive);
    return project;
  } catch (error) { closeProjectArchive(project); throw error; }
}
/** Whether `file` is a report from before packages: a ZIP file named .lfg. */
export function isLegacyArchive(file: string): boolean {
  return path.extname(file).toLowerCase() === ".lfg" && fs.statSync(file).isFile() && isZip(file);
}
/** Opens a folder with a main.tex, such as a .lfg package, where it is: nothing is extracted and nothing needs saving. */
export function openProjectArchive(folder: string): ProjectArchive {
  const root = path.resolve(folder);
  if (isLegacyArchive(root)) throw new Error("This .lfg is an older ZIP file. Convert it to a package first.");
  if (!fs.statSync(root).isDirectory()) throw new Error("Open a .lfg package or a folder with a main.tex.");
  if (!fs.existsSync(path.join(root, "main.tex")) || !fs.statSync(path.join(root, "main.tex")).isFile()) throw new Error("The project has no main.tex at its root.");
  return { archive: root, root, temporary: workingDirectory() };
}
/** Turns an older ZIP .lfg into a package at the same path. The ZIP is kept beside it, renamed `<name>.lfg.zip`. Returns the backup's path. */
export function convertLegacyArchive(file: string): string {
  const original = path.resolve(file);
  if (!isLegacyArchive(original)) throw new Error("This is not an older ZIP .lfg.");
  const backup = `${original}.zip`;
  if (fs.existsSync(backup)) throw new Error(`${path.basename(backup)} already exists. Move it away and try again.`);
  const staging = `${original}.converting`;
  fs.rmSync(staging, { recursive: true, force: true });
  fs.mkdirSync(staging);
  try {
    extractArchive(original, staging);
    if (!fs.existsSync(path.join(staging, "main.tex"))) throw new Error("The project has no main.tex at its root.");
    fs.renameSync(original, backup);
    fs.renameSync(staging, original);
  } catch (error) { fs.rmSync(staging, { recursive: true, force: true }); throw error; }
  return backup;
}
/** Writes the report as a single ZIP file, for sending it or opening it on a system without packages. */
export function exportProjectZip(project: ProjectArchive, destination: string): void {
  if (fs.existsSync(destination) && !fs.statSync(destination).isFile()) throw new Error("Choose a file to export to.");
  if (path.resolve(destination).startsWith(project.root + path.sep)) throw new Error("Choose a location outside the report.");
  saveArchive(project.root, destination);
}
/** The ZIP bytes exported through the shell's guarded export flow. */
export function exportProjectZipBytes(project: ProjectArchive): Uint8Array { return archiveBytes(project.root); }
/** Replace a project's report class with the app's when they differ. Projects without the class (older layouts) are left alone. Returns whether it changed. */
export function refreshProjectClass(project: ProjectArchive, framework: string): boolean {
  const current = path.join(project.root, projectClassFile), latest = path.join(framework, "labforge.cls");
  if (!fs.existsSync(current) || !fs.existsSync(latest)) return false;
  const bytes = fs.readFileSync(latest);
  if (bytes.equals(fs.readFileSync(current))) return false;
  fs.writeFileSync(current, bytes);
  return true;
}
/** Move an older report's two support files to dotted names and update its ordinary class line. */
export function migrateProjectDotFiles(project: ProjectArchive): boolean {
  const main = path.join(project.root, "main.tex");
  const lines = fs.readFileSync(main, "utf8").split("\n");
  const classLine = /\\documentclass\s*(?:\[[^\]]*\]\s*)?\{(?:\.)?labforge\}/;
  const index = lines.findIndex(line => classLine.test(line.replace(/(^|[^\\])%.*$/, "$1")));
  if (index < 0) return false;
  const oldClass = path.join(project.root, "labforge.cls"), newClass = path.join(project.root, projectClassFile);
  if (!fs.existsSync(newClass) && !fs.existsSync(oldClass)) return false;
  let changed = false;
  if (!fs.existsSync(newClass)) { fs.renameSync(oldClass, newClass); changed = true; }
  if (classLine.test(lines[index]) && /\{labforge\}/.test(lines[index])) {
    lines[index] = lines[index].replace(classLine, match => match.replace("{labforge}", "{.labforge}"));
    fs.writeFileSync(main, lines.join("\n"), "utf8");
    changed = true;
  }
  const oldSettings = path.join(project.root, "settings.tex"), newSettings = path.join(project.root, projectSettingsFile);
  if (!fs.existsSync(newSettings) && fs.existsSync(oldSettings)) { fs.renameSync(oldSettings, newSettings); changed = true; }
  return changed;
}
/** Add the named style definitions to an older report without changing its existing overrides. */
export function migrateProjectStyles(project: ProjectArchive, template: string): boolean {
  const target = path.join(project.root, projectSettingsFile);
  if (!fs.existsSync(template)) return false;
  if (!fs.existsSync(target)) { fs.copyFileSync(template, target); return true; }
  const current = fs.readFileSync(target, "utf8");
  const code = current.split("\n").map(line => line.replace(/(^|[^\\])%.*$/, "$1")).join("\n");
  if (/\\labforgepreset\s*\{/.test(code)) return false;
  // The existing \labforgesetup block stays after the style declarations, so its overrides still win.
  fs.writeFileSync(target, `${fs.readFileSync(template, "utf8").trimEnd()}\n\n${current}`, "utf8");
  return true;
}
/** Releases the scratch folder. A saved report's own folder is never removed. */
export function closeProjectArchive(project: ProjectArchive): void { fs.rmSync(project.temporary, { recursive: true, force: true }); }

export function readProjectSettings(project: ProjectArchive): ProjectSettings {
  const fallback: ProjectSettings = { name: project.archive ? path.basename(project.archive, ".lfg") : "Untitled 1", builder: "xelatex" };
  const file = path.join(project.root, ".labforge.json");
  if (!fs.existsSync(file)) return fallback;
  const value = JSON.parse(fs.readFileSync(file, "utf8")) as Partial<ProjectSettings>;
  return { name: typeof value.name === "string" && value.name.trim() ? value.name.trim() : fallback.name,
    builder: value.builder === "pdflatex" || value.builder === "lualatex" ? value.builder : "xelatex" };
}
export function updateProjectSettings(project: ProjectArchive, patch: Partial<ProjectSettings>): ProjectSettings {
  const settings = { ...readProjectSettings(project), ...patch };
  settings.name = settings.name.trim();
  if (!settings.name || settings.name.length > 100 || /[\x00-\x1f]/.test(settings.name)) throw new Error("Choose a project name of 1–100 characters.");
  if (!["xelatex", "pdflatex", "lualatex"].includes(settings.builder)) throw new Error("Choose a supported PDF builder.");
  fs.writeFileSync(path.join(project.root, ".labforge.json"), JSON.stringify(settings, null, 2) + "\n", "utf8");
  return settings;
}

export function listProjectFiles(project: ProjectArchive): ProjectFile[] {
  const result: ProjectFile[] = [];
  const visit = (directory: string) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      // Every file is listed, hidden ones flagged; the inspector decides whether to show them.
      if (entry.name === ".DS_Store" || entry.isSymbolicLink()) continue;
      const full = path.join(directory, entry.name);
      const relative = path.relative(project.root, full).split(path.sep).join("/");
      const hidden = isHiddenProjectPath(relative) ? { hidden: true as const } : {};
      if (entry.isDirectory()) {
        result.push({ path: relative, kind: "folder", size: 0, ...hidden });
        visit(full);
      }
      else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        const kind = ext === ".tex" ? "tex" : ext === ".pdf" ? "pdf" : imageTypes.has(ext) ? "image" : spreadsheetTypes.has(ext) ? "spreadsheet" : textTypes.has(ext) ? "text" : "other";
        result.push({ path: relative, kind, size: fs.statSync(full).size, ...hidden });
      }
    }
  };
  visit(project.root);
  return result.sort((a, b) => a.path.localeCompare(b.path));
}
export function readProjectText(project: ProjectArchive, relative: string): string {
  const file = resolveProjectFile(project, relative);
  if (!textTypes.has(path.extname(file).toLowerCase()) && ![".cls", ".sty", ".json"].includes(path.extname(file).toLowerCase()) && path.basename(file) !== ".latexmkrc") throw new Error("This file cannot be shown as text.");
  if (fs.statSync(file).size > 5_000_000) throw new Error("This text file is too large for the editor.");
  return fs.readFileSync(file, "utf8");
}
export function writeProjectText(project: ProjectArchive, relative: string, content: string): void {
  const file = resolveProjectFile(project, relative);
  if (!textTypes.has(path.extname(file).toLowerCase()) || content.length > 5_000_000) throw new Error("This file cannot be saved as text.");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, "utf8");
}
export function addProjectFile(project: ProjectArchive, source: string, folder = ""): void {
  if (!fs.statSync(source).isFile()) throw new Error("Choose a file to add.");
  const relative = folder ? `${safeRelative(folder)}/${path.basename(source)}` : path.basename(source);
  const target = resolveProjectFile(project, relative);
  if (fs.existsSync(target)) throw new Error(`The project already contains ${relative}.`);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
}
/** The absolute path of a file or folder that may be moved to the Trash. */
export function removableProjectPath(project: ProjectArchive, relative: string): string {
  if (isProtectedProjectPath(safeRelative(relative))) throw new Error(`${relative} is part of the report and cannot be removed.`);
  const target = resolveProjectFile(project, relative);
  if (!fs.existsSync(target)) throw new Error("This project file is unavailable.");
  return target;
}
/** Create an empty folder in the project (New folder in the file tree). */
export function createProjectFolder(project: ProjectArchive, relative: string): void {
  const target = resolveProjectFile(project, relative);
  if (fs.existsSync(target)) throw new Error(`The project already contains ${relative}.`);
  fs.mkdirSync(target, { recursive: true });
}
/** Copy a file or folder of the project to a free path (Copy and Paste, Duplicate). */
export function copyProjectFile(project: ProjectArchive, before: string, after: string): void {
  if (after === "main.tex") throw new Error("main.tex must stay at the project root.");
  const from = resolveProjectFile(project, before);
  const to = resolveProjectFile(project, after);
  if (!fs.existsSync(from) || fs.existsSync(to)) throw new Error("The source is missing or the destination already exists.");
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.cpSync(from, to, { recursive: true, errorOnExist: true, force: false });
}
export function renameProjectFile(project: ProjectArchive, before: string, after: string): void {
  if (before === "main.tex" || after === "main.tex") throw new Error("main.tex must stay at the project root.");
  const blocked = renameBlockReason(before);
  if (blocked) throw new Error(blocked);
  const from = resolveProjectFile(project, before);
  const to = resolveProjectFile(project, after);
  // A change of case only names the same file on a case-insensitive disk, so the destination already "exists".
  if (!fs.existsSync(from) || (fs.existsSync(to) && from.toLowerCase() !== to.toLowerCase())) throw new Error("The source is missing or the destination already exists.");
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.renameSync(from, to);
}
