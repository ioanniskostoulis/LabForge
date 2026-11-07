// Licensed under the GNU General Public License v2 or later. See LICENSE.
// Verify the source and notices copied into the browser output and staged desktop apps.
// Run after npm run build; add --mac or --win after electron-builder has packaged the app.
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { createRequire } from "node:module";
import { checkReleaseSource } from "forge-shell/scripts/check-release";

const require = createRequire(import.meta.url);
const product = "LabForge";
const shellSpec = JSON.parse(readFileSync("package.json", "utf8")).dependencies?.["forge-shell"];
const archive = /^file:(source\/forge-shell-(\d+\.\d+\.\d+)\.tgz)$/.exec(shellSpec ?? "");
assert.ok(archive, "forge-shell must be pinned to a versioned package archive");
const shellLock = JSON.parse(readFileSync("package-lock.json", "utf8")).packages?.["node_modules/forge-shell"];
assert.equal(shellLock?.resolved, shellSpec, "forge-shell lockfile does not match the package archive");
assert.equal(shellLock?.version, archive[2], "forge-shell lockfile version differs from its pinned archive");
const integrity = `sha512-${createHash("sha512").update(readFileSync(archive[1])).digest("base64")}`;
assert.equal(shellLock?.integrity, integrity, "forge-shell package archive differs from the lockfile integrity");
assert.equal(readFileSync("node_modules/forge-shell/VERSION", "utf8").trim(), archive[2], "installed shell version differs from its pinned archive");
const version = readFileSync("VERSION", "utf8").trim();
assert.equal(JSON.parse(readFileSync("package.json", "utf8")).version, version, "package.json version differs from VERSION");
assert.equal(JSON.parse(readFileSync("package-lock.json", "utf8")).version, version, "package-lock.json version differs from VERSION");

const { paths, copies, web, same } = checkReleaseSource({
  roots: ["source", "public", "assets", "scripts", "documentation"],
  files: ["VERSION", "README.md", "LICENSE", "NOTICE.md", "CHANGELOG.md", "package.json", "package-lock.json", "tsconfig.json", "forge.config.json"],
  releaseCopies: [{ from: "node_modules/forge-shell", to: "vendor/forge-shell" }],
  // Every production dependency, reviewed against NOTICE.md and the packaged licenses; a change here needs a notice review.
  expectedDependencies: {
    "@codemirror/autocomplete": "6.20.3",
    "@codemirror/commands": "6.11.1",
    "@codemirror/language": "6.13.1",
    "@codemirror/lint": "6.9.7",
    "@codemirror/search": "6.7.2",
    "@codemirror/state": "6.7.6",
    "@codemirror/view": "6.43.14",
    "@lezer/highlight": "1.2.5",
    "@replit/codemirror-minimap": "0.5.2",
    "forge-shell": shellSpec,
    "katex": "^0.18.7",
    "nspell": "2.1.5",
    "pdfjs-dist": "6.4.299",
    "xlsx": "https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz",
  },
});

/** Check one packaged app's Resources folder: source copy, runtime TeX files and license notices. */
function checkResources(resources) {
  assert.ok(existsSync(resources), `missing ${resources}`);
  // electron-builder leaves dotfiles (here only .gitkeep placeholders) out of extra resources.
  const packaged = (path) => !path.split(/[\\/]/).some((part) => part.startsWith("."));
  for (const path of paths.filter(packaged)) same(path, join(resources, "source", path));
  for (const [path, target] of copies.filter(([path]) => packaged(path))) same(path, join(resources, "source", target));
  same("assets/templates/report/main.tex", join(resources, "templates/report/main.tex"));
  same("assets/framework/labforge.cls", join(resources, "framework/labforge.cls"));
  for (const language of ["en", "el"]) for (const file of ["index.aff", "index.dic", "LICENSE"]) same(`assets/spelling/${language}/${file}`, join(resources, "spelling", language, file));
  same("node_modules/electron/dist/LICENSE", join(resources, "licenses/ELECTRON_LICENSE"));
  // The Chromium notices ship once: in Resources on macOS, beside the executable on Windows.
  same("node_modules/electron/dist/LICENSES.chromium.html", resources.endsWith("win-unpacked/resources") ? join(resources, "..", "LICENSES.chromium.html") : join(resources, "licenses/ELECTRON_CHROMIUM_LICENSES.html"));
  for (const [from, to] of [["node_modules/xlsx/LICENSE", "SHEETJS_LICENSE"], ["node_modules/pdfjs-dist/LICENSE", "PDFJS_LICENSE"], ["node_modules/katex/LICENSE", "KATEX_LICENSE"], ["node_modules/@codemirror/view/LICENSE", "CODEMIRROR_LICENSE"]]) {
    same(from, join(resources, "licenses", to));
  }
  const asar = join(resources, "app.asar");
  const packed = require("@electron/asar");
  for (const path of ["LICENSE", "NOTICE.md", "CHANGELOG.md", "THIRD-PARTY-LICENSES.md"]) assert.deepEqual(packed.extractFile(asar, join(web, path)), readFileSync(join(web, path)));
  assert.throws(() => packed.extractFile(asar, join(web, "release-source", "README.md")), "source must be outside app.asar, in Resources/source");
}

if (process.argv.includes("--mac")) {
  const arch = process.arch === "arm64" ? "mac-arm64" : "mac";
  checkResources(`build/release/${arch}/${product}.app/Contents/Resources`);
  console.log("Mac app: source, TeX framework and template, GPL, notice, Electron, Chromium and library notices match.");
}

if (process.argv.includes("--win")) {
  const setup = join("build", "release", `${product}-v${version}.exe`);
  assert.ok(existsSync(setup), `missing Forge setup: ${setup}`);
  const setupConfig = JSON.parse(readFileSync("build/desktop/setup/setup.json", "utf8"));
  assert.equal(setupConfig.product, product);
  assert.equal(setupConfig.version, version);
  assert.equal(setupConfig.extension, "lfg");
  assert.equal(setupConfig.documentIcon, "labforge-document.ico");
  checkResources("build/release/win-unpacked/resources");
  console.log("Windows app: source, TeX framework and template, GPL, notice, Electron, Chromium and library notices match.");
}
if (!process.argv.includes("--mac") && !process.argv.includes("--win")) console.log("Release source matches the repository and the pinned forge-shell archive.");
