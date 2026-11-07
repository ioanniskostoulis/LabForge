import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const require = createRequire(import.meta.url);
const app = require("../../build/engine/index.cjs");

test("a new Untitled report carries the report class, its build settings and folders", t => {
  const temporary = mkdtempSync(join(tmpdir(), "labforge-untitled-test-"));
  t.after(() => rmSync(temporary, { recursive: true, force: true }));
  const project = app.createUntitledProject("Untitled 1", "assets/templates/report", "assets/framework");
  t.after(() => app.closeProjectArchive(project));
  assert.equal(project.archive, null);
  assert.equal(app.readProjectText(project, "main.tex"), readFileSync("assets/templates/report/main.tex", "utf8"));
  assert.match(app.readProjectText(project, "main.tex"), /\\documentclass\[[^\]]*\]\{\.labforge\}/);
  assert.deepEqual(readFileSync(app.resolveProjectFile(project, ".labforge.cls")), readFileSync("assets/framework/labforge.cls"));
  assert.ok(existsSync(app.resolveProjectFile(project, ".settings.tex")));
  assert.match(app.readProjectText(project, ".labforge.cls"), /ProvidesClass|ProvidesExplClass/);
  assert.match(app.readProjectText(project, ".latexmkrc"), /aux_dir/);
  assert.equal(app.readProjectText(project, "references.bib"), readFileSync("assets/templates/report/references.bib", "utf8"));
  app.writeProjectText(project, "custom.sty", "% Custom style\n");
  assert.equal(app.readProjectText(project, "custom.sty"), "% Custom style\n");
  assert.match(readFileSync(app.resolveProjectFile(project, ".latexmkrc"), "utf8"), /\$aux_dir = '\.build'/);
  // Commands live in the preamble; named styles live in .settings.tex.
  assert.equal(existsSync(app.resolveProjectFile(project, "custom.tex")), false);
  assert.equal(existsSync(app.resolveProjectFile(project, "custom-commands.tex")), false);
  assert.ok(existsSync(app.resolveProjectFile(project, "references.bib")));
  const files = app.listProjectFiles(project);
  assert.deepEqual(files.filter(item => item.kind === "folder" && !item.path.includes("/")).map(item => item.path), ["graphics", "plots", "tables"]);
  assert.deepEqual(files.filter(item => item.hidden).map(item => item.path).sort(), [".labforge.cls", ".labforge.json", ".latexmkrc", ".settings.tex"]);
  app.writeProjectText(project, "main.tex", app.readProjectText(project, "main.tex") + "% draft\n");
  const archive = join(temporary, "Report.lfg");
  app.saveProjectArchiveAs(project, archive);
  assert.equal(statSync(archive).isDirectory(), true);
  assert.equal(project.root, archive);
  assert.equal(app.readProjectSettings(project).name, "Report");
  const reopened = app.openProjectArchive(archive);
  t.after(() => app.closeProjectArchive(reopened));
  assert.match(app.readProjectText(reopened, "main.tex"), /% draft/);
  assert.ok(existsSync(app.resolveProjectFile(reopened, ".labforge.cls")));
});

test("the report class is replaced when the app's differs, and older projects are left alone", t => {
  const framework = mkdtempSync(join(tmpdir(), "labforge-framework-"));
  t.after(() => rmSync(framework, { recursive: true, force: true }));
  writeFileSync(join(framework, "labforge.cls"), readFileSync("assets/framework/labforge.cls"));
  const project = app.createUntitledProject("Untitled 1", "assets/templates/report", framework);
  t.after(() => app.closeProjectArchive(project));
  assert.equal(app.refreshProjectClass(project, framework), false);
  writeFileSync(join(framework, "labforge.cls"), "% newer class\n");
  assert.equal(app.refreshProjectClass(project, framework), true);
  assert.equal(readFileSync(app.resolveProjectFile(project, ".labforge.cls"), "utf8"), "% newer class\n");
  rmSync(app.resolveProjectFile(project, ".labforge.cls"));
  assert.equal(app.refreshProjectClass(project, framework), false);
  assert.equal(existsSync(app.resolveProjectFile(project, ".labforge.cls")), false);
});

test("older settings gain style declarations without losing project overrides", t => {
  const project = app.createUntitledProject("Untitled 1", "assets/templates/report", "assets/framework");
  t.after(() => app.closeProjectArchive(project));
  app.writeProjectText(project, ".settings.tex", "\\labforgesetup{section-center=true}\n");
  assert.equal(app.migrateProjectStyles(project, "assets/templates/report/settings.tex"), true);
  const settings = app.readProjectText(project, ".settings.tex");
  assert.match(settings, /\\labforgepreset\{report\}/);
  assert.ok(settings.endsWith("\\labforgesetup{section-center=true}\n"));
  assert.equal(app.migrateProjectStyles(project, "assets/templates/report/settings.tex"), false);
});

test("an older report migrates its class line and support files to dotted names", t => {
  const project = app.createUntitledProject("Untitled 1", "assets/templates/report", "assets/framework");
  t.after(() => app.closeProjectArchive(project));
  app.writeProjectText(project, "main.tex", "% \\documentclass{labforge}\n\\documentclass[preset=report]{labforge}\n\\begin{document}Hello.\\end{document}\n");
  renameSync(app.resolveProjectFile(project, ".labforge.cls"), app.resolveProjectFile(project, "labforge.cls"));
  renameSync(app.resolveProjectFile(project, ".settings.tex"), app.resolveProjectFile(project, "settings.tex"));
  assert.equal(app.migrateProjectDotFiles(project), true);
  assert.equal(app.readProjectText(project, "main.tex"), "% \\documentclass{labforge}\n\\documentclass[preset=report]{.labforge}\n\\begin{document}Hello.\\end{document}\n");
  assert.ok(existsSync(app.resolveProjectFile(project, ".labforge.cls")));
  assert.ok(existsSync(app.resolveProjectFile(project, ".settings.tex")));
  assert.equal(existsSync(app.resolveProjectFile(project, "labforge.cls")), false);
  assert.equal(existsSync(app.resolveProjectFile(project, "settings.tex")), false);
  assert.equal(app.migrateProjectDotFiles(project), false);
});

test("a report is a folder that keeps its files where they are written", t => {
  const temporary = mkdtempSync(join(tmpdir(), "labforge-report-test-"));
  t.after(() => rmSync(temporary, { recursive: true, force: true }));
  const archive = join(temporary, "Report.lfg");
  let project = app.createProjectArchive(archive);
  assert.equal(statSync(archive).isDirectory(), true);
  assert.deepEqual(app.readProjectSettings(project), { name: "Report", builder: "xelatex" });
  app.updateProjectSettings(project, { name: "Experiment", builder: "lualatex" });
  app.writeProjectText(project, "main.tex", "\\documentclass{article}\n% saved\n");
  const image = join(temporary, "chart.png"); writeFileSync(image, Buffer.from([137, 80, 78, 71]));
  app.addProjectFile(project, image, "graphics");
  app.renameProjectFile(project, "graphics/chart.png", "plots/chart.png");
  mkdirSync(app.resolveProjectFile(project, ".build"));
  writeFileSync(app.resolveProjectFile(project, ".build/main.aux"), "\\relax\n");
  // Nothing is archived: the files are already in the package.
  assert.equal(readFileSync(join(archive, "main.tex"), "utf8"), "\\documentclass{article}\n% saved\n");
  app.closeProjectArchive(project);
  assert.ok(existsSync(archive), "closing a report leaves its package alone");
  project = app.openProjectArchive(archive);
  assert.deepEqual(app.readProjectSettings(project), { name: "Experiment", builder: "lualatex" });
  assert.match(app.readProjectText(project, "main.tex"), /saved/);
  assert.deepEqual(app.listProjectFiles(project).filter(item => item.kind === "folder" && !item.path.includes("/")).map(item => item.path), [".build", "graphics", "plots", "tables"]);
  assert.deepEqual(readFileSync(app.resolveProjectFile(project, "plots/chart.png")), readFileSync(image));
  assert.equal(readFileSync(app.resolveProjectFile(project, ".build/main.aux"), "utf8"), "\\relax\n");
  assert.equal(app.isHiddenProjectPath(".build/main.aux"), true);
  assert.throws(() => app.resolveProjectFile(project, "../other.txt"), /inside the project/);
  assert.throws(() => app.renameProjectFile(project, "main.tex", "other.tex"), /main.tex/);
  app.closeProjectArchive(project);
});

test("the files a report needs cannot be removed, and others resolve to a path inside the project", t => {
  const project = app.createUntitledProject("Untitled 1", "assets/templates/report", "assets/framework");
  t.after(() => app.closeProjectArchive(project));
  for (const path of ["main.tex", ".settings.tex", ".labforge.cls", ".labforge.json", ".latexmkrc", "data", "graphics", "plots", "tables"]) {
    assert.equal(app.isProtectedProjectPath(path), true, path);
    assert.throws(() => app.removableProjectPath(project, path), /cannot be removed/, path);
  }
  assert.equal(app.removableProjectPath(project, "references.bib"), app.resolveProjectFile(project, "references.bib"));
  assert.throws(() => app.removableProjectPath(project, "graphics/missing.png"), /unavailable/);
  assert.throws(() => app.renameProjectFile(project, "references.bib", "data/refs.bib"), /cannot be renamed/);
  assert.throws(() => app.removableProjectPath(project, "../outside.txt"), /inside the project/);
});

test("an older ZIP report converts to a package, and a report exports as a ZIP", t => {
  const temporary = mkdtempSync(join(tmpdir(), "labforge-report-legacy-"));
  t.after(() => rmSync(temporary, { recursive: true, force: true }));
  const source = app.createUntitledProject("Untitled 1", "assets/templates/report", "assets/framework");
  t.after(() => app.closeProjectArchive(source));
  app.writeProjectText(source, "main.tex", "\\documentclass{article}\n% legacy\n");
  const archive = join(temporary, "Old.lfg");
  app.saveArchive(source.root, archive);
  assert.equal(app.isLegacyArchive(archive), true);
  assert.throws(() => app.openProjectArchive(archive), /Convert/);
  const backup = app.convertLegacyArchive(archive);
  assert.equal(backup, `${archive}.zip`);
  assert.equal(app.isZip(backup), true);
  assert.equal(statSync(archive).isDirectory(), true);
  const project = app.openProjectArchive(archive);
  t.after(() => app.closeProjectArchive(project));
  assert.match(app.readProjectText(project, "main.tex"), /% legacy/);
  const zip = join(temporary, "Old export.zip");
  app.exportProjectZip(project, zip);
  assert.equal(app.isZip(zip), true);
  assert.throws(() => app.exportProjectZip(project, join(archive, "inside.zip")), /outside the report/);
  const plain = join(temporary, "plain folder");
  mkdirSync(plain);
  assert.throws(() => app.openProjectArchive(plain), /no main.tex/);
  writeFileSync(join(plain, "main.tex"), "\\documentclass{article}\n");
  const folder = app.openProjectArchive(plain);
  assert.equal(folder.root, plain);
  app.closeProjectArchive(folder);
  assert.ok(existsSync(join(plain, "main.tex")));
});

test("a new report builds with intermediates in .build/ and a failed build preserves the last PDF", async t => {
  if (spawnSync("latexmk", ["-v"], { encoding: "utf8" }).error || spawnSync("xelatex", ["--version"], { encoding: "utf8" }).error) return t.skip("XeLaTeX is not installed");
  const project = app.createUntitledProject("Untitled 1", "assets/templates/report", "assets/framework");
  t.after(() => app.closeProjectArchive(project));
  writeFileSync(app.resolveProjectFile(project, "tables/results.tex"), readFileSync("tests/tex/tables/constants.tex"));
  copyFileSync("assets/icon.png", app.resolveProjectFile(project, "graphics/figure.png"));
  const main = app.readProjectText(project, "main.tex").replace("\\begin{document}\n", "\\begin{document}\n\\mytable[caption=Results.]{results.tex}\n\\myfigure[caption=Icon., width=0.3]{figure.png}\nSee \\myref{tab:results} and \\myref{fig:figure}. The concentration is \\qty{2.5}{\\milli\\mole\\per\\litre}.\n");
  app.writeProjectText(project, "main.tex", main);
  const first = await app.buildProjectPdf(project, "xelatex");
  assert.equal(first.success, true, first.summary + "\n" + first.diagnostics.join("\n"));
  assert.equal(first.stale, false);
  assert.ok(existsSync(app.resolveProjectFile(project, ".build/main.aux")));
  assert.equal(existsSync(app.resolveProjectFile(project, "main.aux")), false);
  const good = readFileSync(app.resolveProjectFile(project, "main.pdf"));
  assert.ok(good.length > 1000);
  app.writeProjectText(project, "main.tex", main.replace("\\myfigure", "\\missinglabforgecommand\n\\myfigure"));
  const failed = await app.buildProjectPdf(project, "xelatex");
  assert.equal(failed.success, false);
  assert.equal(failed.hasPdf, true);
  assert.equal(failed.stale, true);
  assert.ok(failed.diagnostics.some(line => /missinglabforgecommand|Undefined control sequence/.test(line)));
  assert.ok(failed.issues.some(issue => issue.file === "main.tex" && issue.message.includes("Undefined control sequence") && issue.token === "\\missinglabforgecommand"));
  assert.deepEqual(readFileSync(app.resolveProjectFile(project, "main.pdf")), good);
  app.writeProjectText(project, "main.tex", main.replace("{figure.png}", "{missing.png}"));
  const missingFigure = await app.buildProjectPdf(project, "xelatex");
  assert.equal(missingFigure.success, false);
  assert.match(missingFigure.summary, /missing\.png|not found/i);
  assert.ok(missingFigure.issues.some(issue => /missing\.png|not found/i.test(issue.message)));
  assert.deepEqual(readFileSync(app.resolveProjectFile(project, "main.pdf")), good);
});
