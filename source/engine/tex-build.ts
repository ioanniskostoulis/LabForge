// Licensed under the GNU General Public License v2 or later. See LICENSE.
import * as fs from "node:fs";
import * as path from "node:path";
import { spawn } from "node:child_process";
import type { ProjectArchive, ProjectBuilder } from "./project-archive";
import { buildFailureSummary, locateWarnings, parseBuildDiagnostics, type BuildDiagnostic } from "./tex-diagnostics";

export type TexBuildResult = { success: boolean; hasPdf: boolean; stale: boolean; summary: string; diagnostics: string[]; issues: BuildDiagnostic[]; cancelled?: boolean };

function diagnosticsFrom(output: string): string[] {
  const found: string[] = [];
  for (const raw of output.split(/\r?\n/)) {
    const line = raw.trim();
    if (/^!\s|^\.\/?[^:]+\.tex:\d+:|^(?:LaTeX|Package .+|Overfull|Underfull).*Warning:|^Latexmk:.*(?:error|failure)/i.test(line)) {
      if (line && !found.includes(line)) found.push(line);
    }
  }
  return found.slice(0, 20);
}

export { diagnosticsFrom };

/** Runs latexmk on one file in a folder; `error` is set when latexmk could not run or timed out. */
/** Stops latexmk and the TeX run it started, which is a child of its own. */
function stopTree(child: ReturnType<typeof spawn>): void {
  if (child.pid === undefined) return;
  if (process.platform === "win32") { spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], { windowsHide: true }); return; }
  try { process.kill(-child.pid, "SIGTERM"); } catch { child.kill(); }
}

/** Folders searched for TeX tools besides PATH: a GUI app on macOS does not inherit the shell's PATH. */
export function texSearchDirs(platform: string = process.platform): string[] {
  return platform === "darwin" ? ["/Library/TeX/texbin", "/opt/homebrew/bin", "/usr/local/bin"] : [];
}

/** The folder holding `tool` among the search folders, or null when only PATH (or nothing) can provide it. */
export function findTexDir(tool: string, exists: (file: string) => boolean = fs.existsSync, dirs: string[] = texSearchDirs()): string | null {
  return dirs.find(dir => exists(path.join(dir, tool))) ?? null;
}

/** With `synctex`, TeX also writes the links between PDF and source that the PDF tile uses to jump to a line. */
export async function runLatexmk(cwd: string, builder: ProjectBuilder, file: string, onOutput: (output: string) => void = () => {}, timeout = 120_000, signal?: AbortSignal, synctex = false): Promise<{ code: number | null; error: string | null; output: string; cancelled: boolean }> {
  const texDir = findTexDir("latexmk");
  const command = texDir ? path.join(texDir, "latexmk") : process.platform === "win32" ? "latexmk.exe" : "latexmk";
  const env = { ...process.env, ...(texDir ? { PATH: `${texDir}${path.delimiter}${process.env.PATH || ""}` } : {}) };
  return new Promise(resolve => {
    const child = spawn(command, [builder === "pdflatex" ? "-pdf" : `-${builder}`, ...(synctex ? ["-synctex=1"] : []), "-interaction=nonstopmode", "-file-line-error", "-halt-on-error", file],
      { cwd, windowsHide: true, shell: false, env, detached: process.platform !== "win32" });
    let output = "";
    let error: string | null = null;
    let cancelled = false;
    const cancel = () => { cancelled = true; stopTree(child); };
    if (signal?.aborted) cancel(); else signal?.addEventListener("abort", cancel, { once: true });
    const receive = (chunk: Buffer) => { const text = chunk.toString("utf8"); output += text; onOutput(text); };
    child.stdout.on("data", receive);
    child.stderr.on("data", receive);
    child.on("error", cause => { error = cause.message.includes("ENOENT") ? `latexmk was not found. Install a TeX distribution with ${builder} and latexmk.` : cause.message; });
    const timer = setTimeout(() => { error = `The build timed out after ${Math.round(timeout / 1000)} s.`; stopTree(child); }, timeout);
    child.on("close", code => { clearTimeout(timer); signal?.removeEventListener("abort", cancel); resolve({ code, error, output, cancelled }); });
  });
}

export async function buildProjectPdf(project: ProjectArchive, builder: ProjectBuilder, onOutput: (output: string) => void = () => {}, signal?: AbortSignal): Promise<TexBuildResult> {
  const pdf = path.join(project.root, "main.pdf");
  const previous = path.join(project.temporary, "last-good.pdf");
  const hadPdf = fs.existsSync(pdf);
  if (hadPdf) fs.copyFileSync(pdf, previous);
  else fs.rmSync(previous, { force: true });

  const { code, error, output, cancelled } = await runLatexmk(project.root, builder, "main.tex", onOutput, 120_000, signal, true);
  const success = !cancelled && !error && code === 0 && fs.existsSync(pdf);
  // A run stopped half way leaves truncated intermediates that make the next build fail, so the next one starts clean.
  if (cancelled) fs.rmSync(path.join(project.root, ".build"), { recursive: true, force: true });
  if (!success) {
    if (hadPdf && fs.existsSync(previous)) fs.copyFileSync(previous, pdf);
    else fs.rmSync(pdf, { force: true });
  }
  let log = "";
  try { log = fs.readFileSync(path.join(project.root, ".build", "main.log"), "utf8"); } catch { /* No log when TeX did not start. */ }
  const issues = cancelled ? [] : locateWarnings(parseBuildDiagnostics(output), log, output);
  const diagnostics = issues.map(issue => `${issue.file && issue.line ? `${issue.file}:${issue.line}: ` : ""}${issue.message}`);
  const summary = success ? "PDF built." : cancelled ? "Build cancelled." : error ?? buildFailureSummary(issues, code);
  return { success, hasPdf: fs.existsSync(pdf), stale: !success && hadPdf, summary, diagnostics, issues, ...(cancelled ? { cancelled: true } : {}) };
}
