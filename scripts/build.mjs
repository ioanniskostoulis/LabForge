// Licensed under the GNU General Public License v2 or later. See LICENSE.
import { readFileSync, mkdirSync, realpathSync, copyFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { buildForgeApp } from "forge-shell/scripts/build";

const logo = readFileSync("assets/logo.txt", "utf8");
const welcome = readFileSync("assets/welcome.tex", "utf8");
await buildForgeApp({
  targets: [
    { entryPoints: ["source/app/main.ts"], outfile: "build/app/app.js", platform: "browser", format: "esm", define: { __LABFORGE_LOGO__: JSON.stringify(logo), __LABFORGE_WELCOME__: JSON.stringify(welcome) } },
    { entryPoints: ["source/desktop/main.ts"], outfile: "build/desktop/main.cjs", platform: "node", format: "cjs", external: ["electron"] },
    { entryPoints: ["source/desktop/preload.ts"], outfile: "build/desktop/preload.cjs", platform: "node", format: "cjs", external: ["electron"] },
    { entryPoints: ["source/desktop/spell-worker.ts"], outfile: "build/desktop/spell-worker.cjs", platform: "node", format: "cjs" },
    { entryPoints: ["source/engine/index.ts"], outfile: "build/engine/index.cjs", platform: "node", format: "cjs" },
  ],
  staticFiles: [["assets/logo.txt", "logo.txt"], ["assets/templates/report/main.tex", "report-main.tex"], ["assets/templates/report/settings.tex", "report-settings.tex"], ["assets/templates/report/references.bib", "report-references.bib"], ["assets/framework/labforge.cls", "report-class.cls"], ["node_modules/pdfjs-dist/build/pdf.worker.min.mjs", "pdf.worker.min.mjs"], ["LICENSE", "LICENSE"], ["NOTICE.md", "NOTICE.md"], ["CHANGELOG.md", "CHANGELOG.md"]],
  releaseDirs: ["source", "public", "assets", "scripts", "documentation"],
  releaseCopies: [{ from: "node_modules/forge-shell", to: "vendor/forge-shell" }],
  releaseFiles: ["VERSION", "README.md", "LICENSE", "NOTICE.md", "CHANGELOG.md", "package.json", "package-lock.json", "tsconfig.json", "forge.config.json"],
});
if (process.platform === "darwin") {
  mkdirSync("build/native", { recursive: true });
  const headers = join(dirname(dirname(realpathSync(process.execPath))), "include/node");
  execFileSync("clang", ["-bundle", "-undefined", "dynamic_lookup", `-I${headers}`, "scripts/mac-input-source.c", "-framework", "Carbon", "-o", "build/native/mac-input-source.node"], { stdio: "inherit" });
}
if (process.platform === "win32") {
  mkdirSync("build/native", { recursive: true });
  const electronVersion = JSON.parse(readFileSync("node_modules/electron/package.json", "utf8")).version;
  execFileSync(process.execPath, [resolve("node_modules/node-gyp/bin/node-gyp.js"), "rebuild", `--target=${electronVersion}`, `--arch=${process.arch}`, "--dist-url=https://electronjs.org/headers"],
    { cwd: "scripts/win-input-source", stdio: "inherit" });
  copyFileSync("scripts/win-input-source/build/Release/win-input-source.node", "build/native/win-input-source.node");
}
