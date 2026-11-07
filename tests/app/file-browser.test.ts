// Licensed under the GNU General Public License v2 or later. See LICENSE.
import test from "node:test";
import assert from "node:assert/strict";
import { buildTree, copyableSource, dropFolder, moveTarget, topLevel, insertText, referenceText, sideBySideText, renameProblem, renameTarget, restoreFilesSettings, filesDefaults, type ProjectFile, type TreeNode } from "../../source/app/file-browser";
import { isHiddenProjectPath, renameBlockReason } from "../../source/engine/project-archive";
import { supportingFileEditable, supportingTextFile } from "../../source/app/supporting-file-rules";

const files: ProjectFile[] = [
  { path: ".labforge.json", kind: "other", size: 2, hidden: true },
  { path: "graphics", kind: "folder", size: 0 },
  { path: "graphics/b.png", kind: "image", size: 1 },
  { path: "graphics/sub", kind: "folder", size: 0 },
  { path: "graphics/sub/a.png", kind: "image", size: 1 },
  { path: "main.aux", kind: "other", size: 1, hidden: true },
  { path: "main.tex", kind: "tex", size: 1 },
  { path: "tables", kind: "folder", size: 0 },
];

const outline = (nodes: TreeNode[], depth = 0): string[] => nodes.flatMap(node => [`${"  ".repeat(depth)}${node.name}${node.hidden ? " (hidden)" : ""}`, ...outline(node.children, depth + 1)]);

test("Tree lists folders before files, by name, and drops hidden entries unless asked", () => {
  assert.deepEqual(outline(buildTree(files, false)), ["graphics", "  sub", "    a.png", "  b.png", "tables", "main.tex"]);
  // Hidden entries follow the visible ones.
  assert.deepEqual(outline(buildTree(files, true)), ["graphics", "  sub", "    a.png", "  b.png", "tables", "main.tex", ".labforge.json (hidden)", "main.aux (hidden)"]);
});

test("file view settings restore valid values only", () => {
  assert.deepEqual(restoreFilesSettings(undefined), filesDefaults);
  assert.deepEqual(restoreFilesSettings({ view: "tree", showHidden: true }), { showHidden: true });
  assert.deepEqual(restoreFilesSettings({ view: "groups", showHidden: "yes" }), filesDefaults);
});

test("dot-files, dot-folders, LaTeX intermediates and the report class are hidden", () => {
  for (const path of [".labforge.json", ".latexmkrc", ".labforge.cls", ".settings.tex", "labforge.cls", "settings.tex", ".build/main.aux", "main.bbl", "main.synctex.gz", "main.toc"]) assert.equal(isHiddenProjectPath(path), true, path);
  for (const path of ["main.tex", "main.pdf", "custom.tex", "graphics/plot.png", "tables/t.tex", "references.bib"]) assert.equal(isHiddenProjectPath(path), false, path);
});

test("a required path and editable contents are independent properties", () => {
  assert.ok(renameBlockReason("main.tex"));
  assert.equal(supportingFileEditable("main.tex"), true);
  assert.ok(renameBlockReason("references.bib"));
  assert.equal(supportingFileEditable("references.bib"), true);
  assert.equal(supportingFileEditable(".settings.tex"), false);
  assert.equal(supportingFileEditable(".labforge.cls"), false);
  assert.equal(supportingTextFile("tables/results.tex"), true);
  assert.equal(supportingTextFile("graphics/image.png"), false);
});

test("a bare name renames inside the folder, a path moves, and no change gives null", () => {
  assert.equal(renameTarget("graphics/a.png", "b.png"), "graphics/b.png");
  assert.equal(renameTarget("custom.tex", " styles.tex "), "styles.tex");
  assert.equal(renameTarget("graphics/a.png", "plots/a.png"), "plots/a.png");
  assert.equal(renameTarget("graphics/a.png", "a.png"), null);
  assert.equal(renameTarget("graphics/a.png", "  "), null);
});

test("images, plots and tables insert as their framework command, other files do not", () => {
  const file = (path: string, kind: ProjectFile["kind"]): ProjectFile => ({ path, kind, size: 1 });
  assert.equal(insertText(file("graphics/setup/photo.png", "image")), "\\myfigure{setup/photo.png}");
  assert.equal(insertText(file("plots/absorbance.tex", "tex")), "\\myplot{absorbance.tex}");
  assert.equal(insertText(file("tables/yields.tex", "tex")), "\\mytable{yields.tex}");
  assert.equal(insertText(file("tables/notes.txt", "text")), null);
  assert.equal(insertText(file("references.bib", "text")), null);
  assert.equal(insertText(file("graphics", "folder")), null);
  assert.equal(insertText(file("main.tex", "tex")), null);
});

test("plot and table references use the class's default labels", () => {
  const file = (path: string, kind: ProjectFile["kind"] = "tex"): ProjectFile => ({ path, kind, size: 1 });
  assert.equal(referenceText(file("plots/absorbance.tex")), "\\myref{plot:absorbance}");
  assert.equal(referenceText(file("tables/runs/yields.tex")), "\\myref{tab:yields}");
  assert.equal(referenceText(file("graphics/plot.png", "image")), null);
  assert.equal(referenceText(file("plots/notes.txt", "text")), null);
});

test("copying plot and table source omits only the generator settings line", () => {
  const source = "% labforge plot {\"kind\":\"plot\"}\n\\begin{tikzpicture}\n  % data 1: data/runs.csv\n\\end{tikzpicture}\n";
  assert.equal(copyableSource(source), "\\begin{tikzpicture}\n  % data 1: data/runs.csv\n\\end{tikzpicture}\n");
});

test("files found by name give a reason instead of renaming", () => {
  for (const path of ["main.tex", "references.bib", "graphics", ".labforge.cls", ".settings.tex"]) assert.match(renameBlockReason(path) ?? "", /cannot be renamed/, path);
  for (const path of ["graphics/a.png", "tables/yields.tex", "data/other.bib", "custom.tex"]) assert.equal(renameBlockReason(path), null, path);
});

test("a rename is refused for a used name, without regard to case, and for . .. or a backslash", () => {
  assert.equal(renameProblem("graphics/b.png", "graphics/c.png", files), null);
  assert.equal(renameProblem("graphics/b.png", "graphics/B.png", files), null);
  assert.equal(renameProblem("graphics/b.png", "graphics/SUB", files), "The name graphics/SUB is already used.");
  assert.equal(renameProblem("graphics/b.png", "tables", files), "The name tables is already used.");
  assert.equal(renameProblem("graphics/b.png", "graphics/../b.png", files), "A name cannot be . or .., or contain \\.");
  assert.equal(renameProblem("graphics/b.png", "graphics/a\\b.png", files), "A name cannot be . or .., or contain \\.");
  assert.equal(renameProblem("graphics/b.png", "main.tex", files), "main.tex must stay at the project root.");
  assert.equal(renameProblem("graphics/b.png", null, files), null);
});

test("files dropped on the root go to the folder of their type", () => {
  assert.equal(dropFolder("photo.PNG"), "graphics");
  assert.equal(dropFolder("results.xlsx"), "");
  assert.equal(dropFolder("notes.txt"), "");
});

test("moving by drag follows the rename rules", () => {
  const list: ProjectFile[] = [...files, { path: "data", kind: "folder", size: 0 }, { path: "plots/p.tex", kind: "tex", size: 1 }];
  assert.deepEqual(moveTarget("graphics/b.png", "data", list), { target: "data/b.png" });
  assert.equal(moveTarget("graphics/b.png", "graphics", list), null);
  assert.ok("problem" in moveTarget("graphics", "graphics/sub", list)!);
  assert.ok("problem" in moveTarget("plots/p.tex", "data", list)!);
  assert.ok("problem" in moveTarget("main.tex", "data", list)!);
});

test("a selection counts a folder and its contents once", () => {
  assert.deepEqual(topLevel(["graphics", "graphics/b.png", "data/x.csv", "graphics2/a.png"]), ["graphics", "data/x.csv", "graphics2/a.png"]);
});

test("several images or several plots insert side by side in one command, other selections do not", () => {
  const file = (path: string, kind: ProjectFile["kind"]): ProjectFile => ({ path, kind, size: 1 });
  assert.equal(sideBySideText([file("graphics/setup/before.png", "image"), file("graphics/after.png", "image")]), "\\myfigure{setup/before.png, after.png}");
  assert.equal(sideBySideText([file("plots/raw.tex", "tex"), file("plots/fit.tex", "tex")]), "\\myplot{raw.tex, fit.tex}");
  assert.equal(sideBySideText([file("graphics/a.png", "image")]), null);
  assert.equal(sideBySideText([file("graphics/a.png", "image"), file("plots/fit.tex", "tex")]), null);
  assert.equal(sideBySideText([file("tables/a.tex", "tex"), file("tables/b.tex", "tex")]), null);
  assert.equal(sideBySideText([file("graphics/a.png", "image"), file("main.tex", "tex")]), null);
});
