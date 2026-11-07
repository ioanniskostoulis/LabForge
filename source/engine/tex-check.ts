// Licensed under the GNU General Public License v2 or later. See LICENSE.
import { spawn } from "node:child_process";
import * as path from "node:path";
import { findTexDir } from "./tex-build";
import type { ProjectBuilder } from "./project-archive";

export type TexCheck = { ok: boolean; missing: string[]; message: string; url: string };

/** Where to get a TeX distribution. Only these addresses may be opened from the interface. */
export const TEX_DOWNLOADS: Record<string, string> = {
  darwin: "https://tug.org/mactex/",
  win32: "https://miktex.org/download",
  other: "https://tug.org/texlive/",
};

export const isTexDownload = (url: string): boolean => Object.values(TEX_DOWNLOADS).includes(url);

/** True when `tool` starts, whatever its exit code says about the flags. */
function runs(tool: string, texDir: string | null, platform: NodeJS.Platform): Promise<boolean> {
  const command = texDir ? path.join(texDir, tool) : platform === "win32" ? `${tool}.exe` : tool;
  const env = { ...process.env, ...(texDir ? { PATH: `${texDir}${path.delimiter}${process.env.PATH || ""}` } : {}) };
  return new Promise(resolve => {
    try {
      const child = spawn(command, ["--version"], { env, windowsHide: true, shell: false, stdio: "ignore" });
      const timer = setTimeout(() => { child.kill(); resolve(true); }, 10_000);
      child.on("error", () => { clearTimeout(timer); resolve(false); });
      child.on("close", () => { clearTimeout(timer); resolve(true); });
    } catch { resolve(false); }
  });
}

/** The tools a build needs, by name, for the report's builder. biber is needed by the references. */
export function requiredTools(builder: ProjectBuilder): string[] {
  return ["latexmk", builder, "biber"];
}

/** Checks that the TeX tools exist; `probe` is replaceable for tests. */
export async function checkTex(builder: ProjectBuilder = "xelatex", platform: NodeJS.Platform = process.platform, probe: (tool: string, texDir: string | null, platform: NodeJS.Platform) => Promise<boolean> = runs): Promise<TexCheck> {
  const missing: string[] = [];
  for (const tool of requiredTools(builder)) {
    if (!(await probe(tool, findTexDir(tool), platform))) missing.push(tool);
  }
  if (!missing.length) return { ok: true, missing, message: "", url: "" };
  const url = TEX_DOWNLOADS[platform] ?? TEX_DOWNLOADS.other;
  const names = missing.join(", ");
  const hint = platform === "darwin" ? " The smaller BasicTeX also works, with latexmk and biber added through tlmgr." : "";
  const message = `TeX is not fully installed (missing: ${names}), so PDFs cannot be built. Editing and saving still work. Install a TeX distribution from ${url}, restart LabForge, then build again.${hint}`;
  return { ok: false, missing, message, url };
}
