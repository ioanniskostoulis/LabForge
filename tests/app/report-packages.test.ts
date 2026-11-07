// Licensed under the GNU General Public License v2 or later. See LICENSE.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { declaredPackages, reportPackages } from "../../source/app/report-packages";
import { preloadedPackages } from "../../source/app/tex-commands";
import { availableCommands, latexHelp, setReportPackageSource } from "../../source/app/framework-commands";

test("the package manifest covers every direct package of labforge.cls", () => {
  const source = readFileSync("assets/framework/labforge.cls", "utf8");
  const actual = [...source.matchAll(/\\RequirePackage\s*(?:\[[^\]]*\]\s*)?\{\s*([a-zA-Z0-9-]+)\s*\}/g)].map(match => match[1]).sort();
  assert.deepEqual(preloadedPackages.map(item => item.name).sort(), actual);
});

test("literal report additions and conditional bibliography are listed accurately", () => {
  const source = "% \\usepackage{ignored}\n\\documentclass[bibliography]{labforge}\n\\usepackage[mode=math]{siunitx,booktabs}\n\\usepackage{cleveref}\n\\begin{document}\n\\usepackage{late}";
  assert.deepEqual(declaredPackages(source), ["siunitx", "booktabs", "cleveref"]);
  const packages = reportPackages(source);
  assert.ok(packages.included.some(item => item.name === "biblatex"));
  assert.deepEqual(packages.added, ["booktabs", "cleveref"]);
  assert.ok(!reportPackages("\\documentclass{labforge}").included.some(item => item.name === "biblatex"));
});

test("the catalogue and Terminal use the active report packages", () => {
  setReportPackageSource("\\documentclass{labforge}");
  assert.ok(!availableCommands().some(command => command.name === "toprule"));
  setReportPackageSource("\\documentclass{labforge}\n\\usepackage{booktabs}");
  assert.ok(availableCommands().some(command => command.name === "qty"));
  assert.ok(availableCommands().some(command => command.name === "joule"));
  assert.ok(availableCommands().some(command => command.name === "toprule"));
  const lines = latexHelp("packages")!.map(item => typeof item === "string" ? item : `${item.label} ${item.comment}`).join("\n");
  assert.match(lines, /Included by LabForge:[\s\S]*siunitx/);
  assert.match(lines, /Added in this report:[\s\S]*booktabs/);
  assert.doesNotMatch(lines, /biblatex/);
  setReportPackageSource("\\documentclass{labforge}");
});
