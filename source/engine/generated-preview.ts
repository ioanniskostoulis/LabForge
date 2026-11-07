// Licensed under the GNU General Public License v2 or later. See LICENSE.
// Previews a table or plot with the real report class: a small document with the report's class
// options and the preamble of main.tex, built by latexmk and cropped to the block with the preview package.
// Results are cached by a hash of everything that goes into the build.
import * as fs from "node:fs";
import * as path from "node:path";
import { createHash } from "node:crypto";
import { diagnosticsFrom, runLatexmk } from "./tex-build";
import type { ProjectBuilder } from "./project-archive";
import { preambleText } from "./preamble";

export type PreviewRequest = {
  kind: "plot" | "table"; code: string;
  /** The report's class file and `main.tex`, for its class options and its preamble (settings and commands of its own). */
  classFile: string; mainTex: string;
  /** The report's `.settings.tex`, which the report class reads from the project folder; empty when the report has none. */
  settings?: string;
  builder: ProjectBuilder; cacheDir: string; timeout?: number;
  /** Keys for `\myplot` or `\mytable`, such as `width=0.8, height=6cm`; anything else is ignored. */
  keys?: string;
};
export type PreviewResult = { pdf: Uint8Array | null; cached: boolean; error: string | null; diagnostics: string[] };

/** The report's class options without `bibliography`, which would need the project's references. */
export function previewClassOptions(mainTex: string): string {
  const line = /\\documentclass\s*\[([^\]]*)\]\s*\{\.?labforge\}/.exec(mainTex.replace(/(^|[^\\])%.*$/gm, "$1"));
  return (line?.[1] ?? "").split(",").map(option => option.trim()).filter(option => option && option !== "bibliography").join(", ");
}

const sizeKeys = /^(?:width|height)=(?:\d+\.?\d*|\.\d+)(?:cm|mm|in|pt|em)?(?:, ?(?:width|height)=(?:\d+\.?\d*|\.\d+)(?:cm|mm|in|pt|em)?)?$/;
/** Width and height keys as given, or nothing when they are anything else. */
export function previewKeys(keys = ""): string { return sizeKeys.test(keys.trim()) ? keys.trim() : ""; }

/** The document that holds one generated block, set to the column width and cropped to it. */
export function previewDocument(kind: "plot" | "table", options: string, keys = "", preamble = ""): string {
  return [`\\documentclass[${options}]{.labforge}`, ...(preamble.trim() ? [preamble.trim()] : []), "\\usepackage[active,tightpage]{preview}", "\\setlength\\PreviewBorder{6pt}", "% The space a block keeps from the text around it is left out: the preview shows the block alone.", "\\labforgesetup{block-space=0, block-gap=0}", "\\begin{document}",
    "\\begin{preview}\\begin{minipage}{\\linewidth}", `\\my${kind}${previewKeys(keys) ? `[${previewKeys(keys)}]` : ""}{preview.tex}`, "\\end{minipage}\\end{preview}", "\\end{document}", ""].join("\n");
}

const keep = 24;

export async function previewGenerated(request: PreviewRequest): Promise<PreviewResult> {
  const options = previewClassOptions(request.mainTex);
  const cls = fs.readFileSync(request.classFile);
  const key = createHash("sha256").update(JSON.stringify([request.code, request.builder, previewDocument(request.kind, options, request.keys, preambleText(request.mainTex))])).update(cls).update(request.settings ?? "").digest("hex").slice(0, 20);
  fs.mkdirSync(request.cacheDir, { recursive: true });
  const cached = path.join(request.cacheDir, `${key}.pdf`);
  if (fs.existsSync(cached)) {
    const now = new Date();
    fs.utimesSync(cached, now, now);
    return { pdf: new Uint8Array(fs.readFileSync(cached)), cached: true, error: null, diagnostics: [] };
  }
  const work = fs.mkdtempSync(path.join(request.cacheDir, "build-"));
  try {
    const folder = request.kind === "plot" ? "plots" : "tables";
    fs.mkdirSync(path.join(work, folder));
    fs.writeFileSync(path.join(work, ".labforge.cls"), cls);
    fs.writeFileSync(path.join(work, ".settings.tex"), request.settings ?? "", "utf8");
    fs.writeFileSync(path.join(work, folder, "preview.tex"), request.code, "utf8");
    fs.writeFileSync(path.join(work, "preview.tex"), previewDocument(request.kind, options, request.keys, preambleText(request.mainTex)), "utf8");
    const run = await runLatexmk(work, request.builder, "preview.tex", undefined, request.timeout ?? 60_000);
    const pdf = path.join(work, "preview.pdf");
    const diagnostics = diagnosticsFrom(run.output);
    if (run.error || run.code !== 0 || !fs.existsSync(pdf)) {
      const problem = run.error ?? diagnostics.find(line => /^!\s|\.tex:\d+:/.test(line))?.replace(/^\.\/(?:plots|tables)\/preview\.tex:/, "line ") ?? `The preview build failed (${run.code ?? "unknown"}).`;
      return { pdf: null, cached: false, error: problem, diagnostics };
    }
    fs.copyFileSync(pdf, cached);
    prune(request.cacheDir);
    return { pdf: new Uint8Array(fs.readFileSync(cached)), cached: false, error: null, diagnostics };
  } finally { fs.rmSync(work, { recursive: true, force: true }); }
}

/** Keeps the most recently used previews. */
function prune(folder: string): void {
  const files = fs.readdirSync(folder).filter(name => name.endsWith(".pdf")).map(name => ({ name, time: fs.statSync(path.join(folder, name)).mtimeMs }));
  files.sort((a, b) => b.time - a.time).slice(keep).forEach(file => fs.rmSync(path.join(folder, file.name), { force: true }));
}
