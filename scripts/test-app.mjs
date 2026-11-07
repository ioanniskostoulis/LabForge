// Licensed under the GNU General Public License v2 or later. See LICENSE.
// Runs every interface test: LabForge's own project tests, then the conformance tests shipped with the pinned forge-shell.
import { build } from "esbuild";
import { spawnSync } from "node:child_process";
import { cpSync, readdirSync } from "node:fs";

const ownTs = readdirSync("tests/app").filter((file) => file.endsWith(".test.ts"));
await build({ entryPoints: ownTs.map((file) => `tests/app/${file}`), bundle: true, platform: "node", format: "esm", outdir: "build/tests/app", logLevel: "error" });
const own = [
  ...readdirSync("tests/app").filter((file) => file.endsWith(".test.mjs")).map((file) => `tests/app/${file}`),
  ...ownTs.map((file) => `build/tests/app/${file.replace(/\.ts$/, ".js")}`),
];
const conformance = "node_modules/forge-shell/tests/conformance";
const shellTs = readdirSync(conformance).filter((file) => file.endsWith(".ts"));
const shellMjs = readdirSync(conformance).filter((file) => file.endsWith(".mjs"));

await build({ entryPoints: shellTs.map((file) => `${conformance}/${file}`), bundle: true, platform: "node", format: "esm",
  outdir: "build/tests/forge-shell", logLevel: "error" });
// Some conformance tests read the shell's stylesheet beside them (../../source/styles from build/tests/forge-shell).
cpSync("node_modules/forge-shell/source/styles", "build/source/styles", { recursive: true });

const runs = [
  ...own,
  ...shellTs.map((file) => `build/tests/forge-shell/${file.replace(/\.ts$/, ".js")}`),
  ...shellMjs.map((file) => `${conformance}/${file}`),
];
let failed = 0;
for (const file of runs) {
  // Node's --test skips paths inside node_modules, so each node:test file runs as a plain script.
  const result = spawnSync(process.execPath, file.startsWith("node_modules/") ? [file] : ["--test", file], { stdio: "inherit" });
  if (result.status !== 0) { failed++; console.error(`FAILED: ${file}`); }
}
if (failed) process.exit(1);
console.log(`${runs.length} interface test files passed: ${own.length} LabForge, ${runs.length - own.length} forge-shell conformance.`);
