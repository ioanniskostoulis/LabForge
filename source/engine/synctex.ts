// Licensed under the GNU General Public License v2 or later. See LICENSE.
// Links the built PDF and the source through SyncTeX: a point on a page gives a file and line, and a line gives
// the boxes it was set in. The build writes main.synctex.gz beside main.pdf; the `synctex` tool reads it.
import * as fs from "node:fs";
import * as path from "node:path";
import { execFile } from "node:child_process";
import { findTexDir } from "./tex-build";

/** A source position: a project-relative file and a 1-based line. */
export interface SyncSource { file: string; line: number }
/** A box on a page, in PDF points from the page's top-left corner. */
export interface SyncBox { page: number; left: number; top: number; width: number; height: number }

const realPath = (file: string): string => { try { return fs.realpathSync.native(file); } catch { return path.resolve(file); } };

/** The file and line from `synctex edit` output, relative to the project root; null when it names none. */
export function parseEdit(output: string, root: string): SyncSource | null {
  const input = /^Input:(.+)$/m.exec(output)?.[1]?.trim();
  const line = Number(/^Line:(-?\d+)$/m.exec(output)?.[1]);
  if (!input || !Number.isFinite(line) || line < 1) return null;
  // SyncTeX names files by their real path; the report folder may be reached through a link (/var is /private/var on macOS).
  const file = path.relative(realPath(root), realPath(path.resolve(root, input)));
  if (!file || file.startsWith("..") || path.isAbsolute(file)) return null;
  return { file: file.split(path.sep).join("/"), line };
}

/** The boxes from `synctex view` output. `v` is a box's baseline and `H` its height, so its top is `v - H`. */
export function parseView(output: string): SyncBox[] {
  const boxes: SyncBox[] = [];
  for (const record of output.split(/^Page:/m).slice(1)) {
    const value = (key: string) => Number(new RegExp(`^${key}:(-?[\\d.]+)$`, "m").exec(record)?.[1]);
    const page = Number.parseInt(record, 10), h = value("h"), v = value("v"), width = value("W"), height = value("H");
    if ([page, h, v, width, height].every(Number.isFinite) && width > 0) boxes.push({ page, left: h, top: v - height, width, height });
  }
  return boxes;
}

function synctex(root: string, args: string[]): Promise<string | null> {
  const dir = findTexDir("synctex");
  const command = dir ? path.join(dir, "synctex") : process.platform === "win32" ? "synctex.exe" : "synctex";
  return new Promise(resolve => {
    execFile(command, args, { cwd: root, timeout: 10_000, windowsHide: true, encoding: "utf8" }, (error, stdout) => resolve(error ? null : stdout));
  });
}

/** Whether the last build left a SyncTeX file to read. */
export function hasSyncData(root: string): boolean {
  return fs.existsSync(path.join(root, "main.synctex.gz")) || fs.existsSync(path.join(root, "main.synctex"));
}

/** The source line set at (x, y) points on `page` of main.pdf. */
export async function sourceAt(root: string, page: number, x: number, y: number): Promise<SyncSource | null> {
  if (!hasSyncData(root)) return null;
  const output = await synctex(root, ["edit", "-o", `${page}:${x.toFixed(2)}:${y.toFixed(2)}:main.pdf`, "-d", "."]);
  return output ? parseEdit(output, root) : null;
}

/** Where `line` of `file` was set in main.pdf: its boxes, first page first. */
export async function pdfAt(root: string, file: string, line: number): Promise<SyncBox[]> {
  if (!hasSyncData(root)) return [];
  const output = await synctex(root, ["view", "-i", `${line}:0:${file}`, "-o", "main.pdf", "-d", "."]);
  return output ? parseView(output) : [];
}
