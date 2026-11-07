// Licensed under the GNU General Public License v2 or later. See LICENSE.
import test from "node:test";
import assert from "node:assert/strict";
import { figureTools, insertFamilies, searchCommands } from "../../source/app/insert-tools";
import { findFrameworkCommand, setReportPackageSource } from "../../source/app/framework-commands";
import type { ProjectFile } from "../../source/app/file-browser";

const files: ProjectFile[] = [
  { path: "graphics", kind: "folder", size: 0 }, { path: "graphics/setup.png", kind: "image", size: 1 },
  { path: "plots/decay.tex", kind: "tex", size: 1 }, { path: "tables/results.tex", kind: "tex", size: 1 }, { path: "data/a.csv", kind: "text", size: 1 },
  { path: "graphics/.hidden.png", kind: "image", size: 1, hidden: true },
];

test("every insert tool is a framework command with a cursor stop where it needs one", () => {
  for (const family of insertFamilies) for (const item of family.tools) {
    assert.ok(findFrameworkCommand(item.snippet.replace(/[{[].*$/s, "")), item.id);
    assert.ok(item.icon.includes("<svg"), item.id);
  }
  assert.equal(insertFamilies.flatMap(family => family.tools).find(item => item.id === "mysection")!.snippet, "mysection{}");
  assert.equal(insertFamilies.flatMap(family => family.tools).find(item => item.id === "mylineskip")!.snippet, "mylineskip");
});

test("the figures family lists the report's graphics, plots and tables by their commands", () => {
  const tools = figureTools(files);
  assert.deepEqual(tools.slice(3).map(item => [item.label, item.snippet]), [["graphics/setup.png", "myfigure{setup.png}"], ["plots/decay.tex", "myplot{decay.tex}"], ["tables/results.tex", "mytable{results.tex}"]]);
});

test("search finds commands by name first, then by description, and files by name", () => {
  assert.equal(searchCommands("form")[0].label, "\\myformula");
  assert.equal(searchCommands("\\mysec")[0].label, "\\mysection");
  assert.ok(searchCommands("bibliography").some(hit => hit.label === "\\mybibliography"));
  assert.ok(searchCommands("image").some(hit => hit.label === "\\myfigure"));
  assert.ok(searchCommands("decay", files).some(hit => hit.label === "\\myplot{decay.tex}"));
  assert.deepEqual(searchCommands("  "), []);
  assert.deepEqual(searchCommands("zzzz"), []);
});

test("search includes every matching command and indexes examples and active packages", () => {
  setReportPackageSource("\\documentclass{labforge}");
  assert.ok(searchCommands("s").length > 12);
  assert.ok(searchCommands("scientific notation").some(hit => hit.label === "\\num"));
  assert.ok(searchCommands("2.5 mole").some(hit => hit.label === "\\qty"));
  assert.ok(!searchCommands("booktabs").some(hit => hit.label === "\\toprule"));
  setReportPackageSource("\\documentclass{labforge}\n\\usepackage{booktabs}");
  assert.ok(searchCommands("booktabs").some(hit => hit.label === "\\toprule"));
  assert.equal(searchCommands("scientific notation").find(hit => hit.label === "\\num")?.detail, "Format a number or scientific notation");
  setReportPackageSource("\\documentclass{labforge}");
});
