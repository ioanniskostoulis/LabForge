// Licensed under the GNU General Public License v2 or later. See LICENSE.
// Table and plot writers, the settings line, automatic names, the stale flag and regenerate.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, cpSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join, resolve } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const XLSX = require("xlsx");
const engine = require("../../build/engine/index.cjs");
const fixtures = resolve("tests/fixtures");

function project() {
  const root = mkdtempSync(join(tmpdir(), "labforge-generated-"));
  cpSync(fixtures, join(root, "data"), { recursive: true });
  return root;
}
const table = { kind: "table", source: "data/sample.xlsx", sheet: "Results", range: "A1:C4", header: true };
const plot = { kind: "plot", xlabel: "Time (s)", ylabel: "Voltage (V)", series: [
  { type: "data", source: "data/graph.csv", x: "A", y: "B", legend: "Measured" },
  { type: "function", expression: "x", domain: "0:4", legend: "Fit" },
  { type: "points", points: [[0, 1], [2, 2]], legend: "Typed" },
] };

test("tables are written in the class format from formatted and merged Excel cells", () => {
  const book = XLSX.readFile(join(fixtures, "sample.xlsx"), { cellNF: true, cellStyles: true, cellDates: true, raw: false });
  for (const [smart, expected] of [[{}, "expected-basic.tex"], [true, "expected-smart.tex"]]) {
    const { cells, aligns } = engine.tableCells(book, "Results", "A1:C4", smart, true);
    assert.equal(engine.writeTable({ ...table, smart }, cells, aligns), readFileSync(join(fixtures, expected), "utf8"));
  }
  // Older tables keep their per-kind flags; any of them turns smart formatting on.
  assert.deepEqual(engine.tableCells(book, "Results", "A1:C4", { chemistry: true }, true), engine.tableCells(book, "Results", "A1:C4", true, true));
});

test("all six supported spreadsheet types can be read into a table", () => {
  const files = engine.listInputs(fixtures);
  assert.deepEqual(files.map(file => file.name).sort(), ["graph.csv", "sample.csv", "sample.ods", "sample.xls", "sample.xlsb", "sample.xlsm", "sample.xlsx"].sort());
  const root = project();
  for (const file of files) {
    const sheet = engine.sheetNames(file.path)[0];
    const code = engine.tableCode(root, { kind: "table", source: `data/${file.name}`, sheet, range: "A1:B3", header: false });
    assert.match(code, /^% labforge table \{/);
    assert.match(code, /\\begin\{labtable\}\{[lcr] [lcr]\}[\s\S]*\\end\{labtable\}/);
  }
});

test("the settings line reads back, and code without one has none", () => {
  const code = engine.writePlot(plot, [[[0, 0], [1, 2]]]);
  assert.deepEqual(engine.readSettings(code), plot);
  assert.equal(engine.readSettings("\\begin{tikzpicture}\n"), null);
  assert.equal(engine.readSettings("% labforge plot {broken\n"), null);
});

test("plots hold spreadsheet series, functions, typed points and legend entries", () => {
  const root = project();
  const code = engine.plotCode(root, plot);
  assert.deepEqual(engine.readDataBlock(code, 1).map(line => line.trim()), ["(0,0)", "(1,2)", "(2,3)", "(3,2)", "(4,5)"]);
  assert.match(code, /\\addplot\[domain=0:4, samples=100\] \{x\};\n {8}\\addlegendentry\{Fit\}/);
  assert.match(code, /\(0,1\)\n {12}\(2,2\)\n {8}\};\n {8}\\addlegendentry\{Typed\}/);
  assert.match(code, /\\begin\{axis\}\[\n {8}xlabel=\{Time \(s\)\},\n {8}ylabel=\{Voltage \(V\)\},\n {4}\]/);
});

test("automatic names count up per kind and data file", () => {
  assert.equal(engine.nextGeneratedName([], "plot"), "plot_1.tex");
  assert.equal(engine.nextGeneratedName(["table_1.tex", "Table_2.tex"], "table"), "table_3.tex");
  assert.equal(engine.nextGeneratedName([], "plot", "data/run 2/Graph Data.csv"), "graph_data_plot_1.tex");
  assert.equal(engine.nextGeneratedName(["graph_plot_1.tex"], "plot", "data/Graph.csv"), "graph_plot_2.tex");
  const root = project();
  assert.equal(engine.saveGenerated(root, "plot", "x"), "plot_1.tex");
  assert.equal(engine.saveGenerated(root, "plot", "x"), "plot_2.tex");
  assert.equal(engine.saveGenerated(root, "table", "x", "data/sample.xlsx"), "sample_table_1.tex");
});

test("a changed data file marks its output stale, and regenerate replaces only the data block", () => {
  const root = project();
  const name = engine.saveGenerated(root, "plot", engine.plotCode(root, plot), "data/graph.csv");
  const file = join(root, "plots", name);
  // The user's own edits outside the data block survive regenerate.
  writeFileSync(file, readFileSync(file, "utf8").replace("\\addlegendentry{Measured}", "\\addlegendentry{Measured voltage}"));
  assert.deepEqual(engine.listGenerated(root, "plot").map(item => [item.name, item.stale]), [[name, false]]);
  assert.equal(engine.regenerate(root, `plots/${name}`), false, "nothing to do while the data is unchanged");

  writeFileSync(join(root, "data", "graph.csv"), "Time,Voltage\n0,1\n1,4\n");
  assert.equal(engine.listGenerated(root, "plot")[0].stale, true);
  assert.equal(engine.regenerate(root, `plots/${name}`), true);
  const text = readFileSync(file, "utf8");
  assert.deepEqual(engine.readDataBlock(text, 1).map(line => line.trim()), ["(0,1)", "(1,4)"]);
  assert.match(text, /\\addlegendentry\{Measured voltage\}/);
  assert.equal(engine.listGenerated(root, "plot")[0].stale, false);
});

test("table regenerate keeps the header and columns the user edited", () => {
  const root = project();
  const name = engine.saveGenerated(root, "table", engine.tableCode(root, table), "data/sample.xlsx");
  const file = join(root, "tables", name);
  writeFileSync(file, readFileSync(file, "utf8").replace("\\begin{labtable}{l r l}", "\\begin{labtable}{l c c}"));
  writeFileSync(join(root, "data", "sample.xlsx"), readFileSync(join(fixtures, "sample.xlsm")));
  assert.equal(engine.listGenerated(root, "table")[0].stale, true);
  engine.regenerate(root, `tables/${name}`);
  assert.match(readFileSync(file, "utf8"), /\\begin\{labtable\}\{l c c\}/);
  assert.equal(engine.listGenerated(root, "table")[0].stale, false);
});

test("a missing data file is reported, and removed markers stop regenerate", () => {
  const root = project();
  const name = engine.saveGenerated(root, "plot", engine.plotCode(root, plot));
  const file = join(root, "plots", name);
  writeFileSync(file, readFileSync(file, "utf8").replace(/ *% end of data 1\n/, ""));
  assert.throws(() => engine.regenerate(root, `plots/${name}`), /markers were removed/);
  writeFileSync(join(root, "plots", "hand.tex"), "\\begin{tikzpicture}\\end{tikzpicture}\n");
  assert.throws(() => engine.regenerate(root, "plots/hand.tex"), /no LabForge settings line/);
  rmSync(join(root, "data", "graph.csv"));
  const items = engine.listGenerated(root, "plot");
  assert.deepEqual(items.find(item => item.name === name).missing, ["data/graph.csv"]);
  assert.equal(items.find(item => item.name === "hand.tex").settings, null);
  assert.throws(() => engine.tableCode(root, { ...table, source: "../outside.xlsx" }), /save the report first/);
});

test("a spreadsheet beside the report file is read from that folder and found by content", () => {
  const root = project(), beside = mkdtempSync(join(tmpdir(), "labforge-beside-"));
  cpSync(join(fixtures, "graph.csv"), join(beside, "measured.csv"));
  assert.deepEqual(engine.listBeside(beside), ["measured.csv"]);
  assert.deepEqual(engine.listBeside(undefined), []);
  const settings = { kind: "plot", series: [{ type: "data", source: "measured.csv", x: "A", y: "B" }] };
  assert.throws(() => engine.plotCode(root, settings), /save the report first/);
  const name = engine.saveGenerated(root, "plot", engine.plotCode(root, settings, beside), "measured.csv");
  assert.equal(engine.listGenerated(root, "plot", beside)[0].stale, false);
  writeFileSync(join(beside, "measured.csv"), "0,9\n1,8\n");
  assert.equal(engine.listGenerated(root, "plot", beside)[0].stale, true);
  assert.equal(engine.regenerate(root, `plots/${name}`, beside), true);
  rmSync(join(beside, "measured.csv"));
  assert.deepEqual(engine.listGenerated(root, "plot", beside)[0].missing, ["measured.csv"]);
});

test("plot code is indented in steps of four spaces, and regenerate keeps a file's own indent", () => {
  const root = project();
  const code = engine.plotCode(root, plot);
  assert.match(code, /^ {4}\\begin\{axis\}\[\n {8}xlabel/m);
  const twoSpaces = engine.reindent(code, "  ");
  assert.match(twoSpaces, /^ {2}\\begin\{axis\}\[\n {4}xlabel/m);
  assert.equal(engine.indentUnitOf(twoSpaces), "  ");
  const name = engine.saveGenerated(root, "plot", twoSpaces, "data/graph.csv");
  writeFileSync(join(root, "data", "graph.csv"), "Time,Voltage\n0,1\n1,4\n");
  engine.regenerate(root, `plots/${name}`);
  assert.match(readFileSync(join(root, "plots", name), "utf8"), /\n {6}% data 1: [^\n]*\n {6}\(0,1\)\n {6}\(1,4\)\n {6}% end of data 1/);
});

test("a CSV file is read as UTF-8 with or without a byte order mark, and other bytes as before", () => {
  const root = project();
  const greek = "Δείγμα,m(Sn) (g)\nK1,10.814\n";
  writeFileSync(join(root, "data", "plain.csv"), greek);
  writeFileSync(join(root, "data", "marked.csv"), `\ufeff${greek}`);
  writeFileSync(join(root, "data", "latin.csv"), Buffer.from([0x63, 0x61, 0x66, 0xe9, 0x2c, 0x31, 0x0a]));
  for (const name of ["plain.csv", "marked.csv"]) assert.deepEqual(engine.tableCells(engine.loadSpreadsheet(join(root, "data", name)), undefined, "A1:B2").cells, [["Δείγμα", "m(Sn) (g)"], ["K1", "10.814"]], name);
  assert.deepEqual(engine.tableCells(engine.loadSpreadsheet(join(root, "data", "latin.csv")), undefined, "A1:B1").cells, [["café", "1"]]);
});

test("a range drawn past the data leaves out its trailing empty rows and columns", () => {
  const root = project();
  writeFileSync(join(root, "data", "short.csv"), "Time,Voltage\n0,1\n,\n2,2\n");
  const code = engine.tableCode(root, { kind: "table", source: "data/short.csv", range: "A1:D10", header: true });
  assert.match(code, /\\begin\{labtable\}\{[lcr] [lcr]\}/, "two columns, not four");
  assert.equal(engine.readDataBlock(code).length, 3, "the empty row inside the data stays; the six after it are left out");
});

test("header names are escaped like table cells, so they build", () => {
  const root = project();
  writeFileSync(join(root, "data", "runs.csv"), "t,rate_1 (%),speed#2\n0,1,2\n1,2,4\n");
  const code = engine.plotCode(root, { kind: "plot", series: [{ type: "range", source: "data/runs.csv", range: "A1:C3" }] });
  assert.match(code, /\\addlegendentry\{rate\\_1 \(\\%\)\}/);
  assert.match(code, /\\addlegendentry\{speed\\#2\}/);
});

test("a range plot draws one series per column after x, named by the header row", () => {
  const root = project();
  writeFileSync(join(root, "data", "runs.csv"), "t,first,second\n0,1,2\n1,2,4\n2,3,\n");
  const settings = { kind: "plot", series: [{ type: "range", source: "data/runs.csv", range: "A1:C4" }] };
  const code = engine.plotCode(root, settings);
  assert.deepEqual(engine.readDataBlock(code, 1).map(line => line.trim()), ["(0,1)", "(1,2)", "(2,3)"]);
  assert.deepEqual(engine.readDataBlock(code, 2).map(line => line.trim()), ["(0,2)", "(1,4)"], "an empty cell leaves that point out");
  assert.match(code, /% data 2: data\/runs\.csv, A1:C4, column C/);
  assert.match(code, /\\addlegendentry\{first\}[\s\S]*\\addlegendentry\{second\}/);
  assert.match(engine.plotCode(root, { ...settings, series: [{ ...settings.series[0], legends: ["Fast"] }] }), /\\addlegendentry\{Fast\}[\s\S]*\\addlegendentry\{second\}/);
  assert.throws(() => engine.plotCode(root, { kind: "plot", series: [{ type: "range", source: "data/runs.csv", range: "A1:A4" }] }), /two or more columns/);
  const name = engine.saveGenerated(root, "plot", code, "data/runs.csv");
  writeFileSync(join(root, "data", "runs.csv"), "t,first,second\n0,5,6\n1,7,8\n");
  assert.equal(engine.listGenerated(root, "plot")[0].stale, true);
  assert.equal(engine.regenerate(root, `plots/${name}`), true);
  const text = readFileSync(join(root, "plots", name), "utf8");
  assert.deepEqual(engine.readDataBlock(text, 2).map(line => line.trim()), ["(0,6)", "(1,8)"]);
});

// Generated code must build with the class; skipped without latexmk and XeLaTeX.
const texbin = ["/Library/TeX/texbin", "/opt/homebrew/bin", "/usr/local/bin"].find(dir => existsSync(join(dir, "latexmk")));
const env = { ...process.env, ...(texbin ? { PATH: `${texbin}${delimiter}${process.env.PATH ?? ""}` } : {}) };
const installed = !spawnSync("latexmk", ["-v"], { env }).error && !spawnSync("xelatex", ["--version"], { env }).error;

test("generated tables and plots build with the report class", { skip: !installed && "latexmk and XeLaTeX are not installed" }, () => {
  const root = project();
  const plotName = engine.saveGenerated(root, "plot", engine.plotCode(root, plot), "data/graph.csv");
  const tableName = engine.saveGenerated(root, "table", engine.tableCode(root, { ...table, smart: true }), "data/sample.xlsx");
  // Every kind smart formatting writes, in a header and a body, must build: formulas, units with \per, numbers and symbols.
  writeFileSync(join(root, "data", "smart.csv"), ["Δείγμα,m(Sn) (g),T_(liquidus)_exp,Ar (g/mol),c / mol L-1,Note",
    "Sn,—,212.6,118.71,1.2e-3,CuSO4·5H2O",
    "K1,10.814,219.3,,6.02×10^23,[Cu(NH3)4]2+",
    "K2,8.972,185.1,,(12.5 ± 0.3),2 H2 + O2 -> 2 H2O",
    "Bi,0.000,254.7,208.98,3.2 mL,\"Dissolve 12.5 g NaCl in 250 mL H2O at 80 °C, then add SO4^2- and Fe3+.\""].join("\n"));
  const smartName = engine.saveGenerated(root, "table", engine.tableCode(root, { kind: "table", source: "data/smart.csv", range: "A1:F5", header: true, smart: true }), "data/smart.csv");
  cpSync("assets/framework/labforge.cls", join(root, ".labforge.cls"));
  mkdirSync(join(root, "graphics"), { recursive: true });
  writeFileSync(join(root, "main.tex"), `\\documentclass[language=english]{.labforge}\n\\begin{document}\n\\myplot[caption=Voltage.]{${plotName}}\n\\mytable[caption=Results.]{${tableName}}\n\\mytable[caption=Smart.]{${smartName}}\n\\end{document}\n`);
  const run = spawnSync("latexmk", ["-xelatex", "-interaction=nonstopmode", "-halt-on-error", "main.tex"], { cwd: root, env, encoding: "utf8", timeout: 240_000 });
  const log = readFileSync(join(root, "main.log"), "utf8");
  assert.equal(run.status, 0, log.split("\n").filter(line => line.startsWith("!")).join("\n"));
  assert.deepEqual(log.split(/\r?\n/).filter(line => /^!|LaTeX Warning|Package pgfplots Warning|undefined|Missing character/.test(line)), []);
});
