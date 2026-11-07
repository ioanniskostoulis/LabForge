// Licensed under the GNU General Public License v2 or later. See LICENSE.
import test from "node:test";
import assert from "node:assert/strict";
import { customPoints, formSettings, includeLine, labelText, needsData, partsFor, plotFormDefaults, sizeKeys, tableFormDefaults } from "../../source/app/generator-form";
import { isDataSpreadsheet } from "../../source/engine/project-paths";
import { tableColumns, writePlot, type PlotSettings } from "../../source/engine/generators";

test("the default plot form writes code without a data file", () => {
  const settings = formSettings("plot", plotFormDefaults);
  assert.ok(typeof settings !== "string");
  assert.equal(needsData(settings), false);
  assert.match(writePlot(settings as PlotSettings), /\\begin\{axis\}\n {8}\\addplot\[domain=0:10, samples=100\] \{x\^2\};/);
});

test("a plot reads a spreadsheet range, a custom function or custom points", () => {
  assert.deepEqual(formSettings("plot", { ...plotFormDefaults, source: "data/runs.csv", range: "a1:c20" }), { kind: "plot", series: [{ type: "range", source: "data/runs.csv", range: "A1:C20" }] });
  assert.deepEqual(formSettings("plot", { ...plotFormDefaults, source: "data/runs.csv", sheet: "Run 2", range: "A1:AA9", legend: "Fast, Slow" }),
    { kind: "plot", series: [{ type: "range", source: "data/runs.csv", sheet: "Run 2", range: "A1:AA9", legends: ["Fast", "Slow"] }] });
  assert.deepEqual(formSettings("plot", { ...plotFormDefaults, source: customPoints, points: " 0,0  1,2.5 ", xlabel: "Time (s)", legend: "Run 1", grid: true }),
    { kind: "plot", xlabel: "Time (s)", grid: true, series: [{ type: "points", points: [[0, 0], [1, 2.5]], legend: "Run 1" }] });
});

test("both forms use the same wording for the same problems", () => {
  for (const [kind, form, problem] of [
    ["plot", { ...plotFormDefaults, domain: "0-10" }, /from:to/],
    ["plot", { ...plotFormDefaults, expression: " " }, /function of x/],
    ["plot", { ...plotFormDefaults, source: customPoints, points: "1,2" }, /two or more points/],
    ["plot", { ...plotFormDefaults, source: "data/a.csv", range: "A1" }, /two cells/],
    ["plot", { ...plotFormDefaults, source: "data/a.csv", range: "B1:B9" }, /two or more columns/],
    ["plot", { ...plotFormDefaults, source: "data/a.csv", range: "Z1:Y9" }, /two or more columns/],
    ["table", tableFormDefaults, /^Choose a data file in Source\.$/],
    ["table", { ...tableFormDefaults, source: "data/a.xlsx", range: "A1" }, /two cells/],
    ["table", { ...tableFormDefaults, source: "data/a.xlsx", align: "lxr" }, /l, c and r/],
    ["plot", { ...plotFormDefaults, width: "wide" }, /^Write the width as a fraction of the column/],
    ["table", { ...tableFormDefaults, source: "data/a.xlsx", width: "wide" }, /^Write the width as a fraction of the column/],
    ["plot", { ...plotFormDefaults, height: "0.5" }, /height as a length/],
  ] as const) assert.match(formSettings(kind, form) as string, problem);
});

test("Width and Height go to the main.tex line, not into the code", () => {
  assert.equal(sizeKeys("plot", { ...plotFormDefaults, width: "0.8", height: "6 cm" }), "width=0.8, height=6cm");
  assert.equal(sizeKeys("table", { ...tableFormDefaults, width: "8cm" }), "width=8cm");
  assert.equal(sizeKeys("table", { ...tableFormDefaults, width: "1" }), "width=1");
  assert.equal(includeLine("plot", "plot_1.tex", "width=0.8"), "\\myplot[width=0.8]{plot_1.tex}");
  assert.equal(includeLine("table", "runs_table_1.tex", ""), "\\mytable{runs_table_1.tex}");
  assert.deepEqual(partsFor("plot", "width"), []);
  assert.deepEqual(partsFor("table", "source"), ["columns", "head", "data"]);
  assert.deepEqual(partsFor("plot", "range"), ["series"]);
  assert.deepEqual(partsFor("plot", "legend"), ["series"]);
});

test("table forms keep header, alignment, sheet and smart formatting", () => {
  assert.deepEqual(formSettings("table", { source: "data/a.xlsx", sheet: "Run 2", range: "b2:d9", width: "", header: false, align: "l c r", smart: true, spread: "" }),
    { kind: "table", source: "data/a.xlsx", sheet: "Run 2", range: "B2:D9", header: false, columns: "l c r", smart: true });
  assert.equal("smart" in (formSettings("table", { ...tableFormDefaults, source: "data/a.xlsx", smart: false }) as object), false);
});

test("a %, & or # typed in a label or legend is the character; TeX in it is kept", () => {
  assert.equal(labelText(" Yield (%) "), "Yield (\\%)");
  assert.equal(labelText("A & B #1"), "A \\& B \\#1");
  assert.equal(labelText("Rate (\\%) $\\mu$"), "Rate (\\%) $\\mu$", "an escaped one and math stay");
  assert.deepEqual(formSettings("plot", { ...plotFormDefaults, ylabel: "Yield (%)", legend: "Fit #1" }),
    { kind: "plot", ylabel: "Yield (\\%)", series: [{ type: "function", expression: "x^2", domain: "0:10", legend: "Fit \\#1" }] });
  assert.deepEqual((formSettings("plot", { ...plotFormDefaults, source: "data/a.csv", range: "A1:C9", legend: "50%, 75%" }) as { series: { legends?: string[] }[] }).series[0].legends, ["50\\%", "75\\%"]);
});

test("a table's columns take a relative width in brackets", () => {
  assert.deepEqual(tableColumns("l[0.6] c c[2]"), ["l[0.6]", "c", "c[2]"]);
  assert.deepEqual(tableColumns("lc[.5]r[01.5]"), ["l", "c[0.5]", "r[1.5]"]);
  assert.equal(tableColumns("l[x] c"), null);
  assert.equal(tableColumns("10.6"), null);
  assert.equal((formSettings("table", { ...tableFormDefaults, source: "data/a.xlsx", range: "A1:C9", align: "l[0.6] c c[2]" }) as { columns?: string }).columns, "l[0.6] c c[2]");
  assert.match(formSettings("table", { ...tableFormDefaults, source: "data/a.xlsx", range: "A1:C9", align: "l[0.6] c" }) as string, /has 3 columns/);
  assert.match(formSettings("table", { ...tableFormDefaults, source: "data/a.xlsx", range: "A1:B9", align: "l c[two]" }) as string, /optional width such as c\[2\]/);
});

test("a table's alignment letters must match its range's columns", () => {
  assert.match(formSettings("table", { ...tableFormDefaults, source: "data/a.xlsx", range: "A1:C9", align: "lc" }) as string, /^The range has 3 columns; give 3 alignment letters, or leave it empty\.$/);
  assert.match(formSettings("table", { ...tableFormDefaults, source: "data/a.xlsx", range: "B1:B9", align: "lr" }) as string, /has 1 column; give 1 alignment letter/);
  assert.equal(typeof formSettings("table", { ...tableFormDefaults, source: "data/a.xlsx", range: "Z1:AB9", align: "lcr" }), "object");
});

test("only spreadsheets inside data/ are offered as sources", () => {
  assert.deepEqual(["data/a.xlsx", "data/run/b.CSV", "references.bib", "graphics/c.csv", "data/~$a.xlsx", "data/.hidden.csv"].filter(isDataSpreadsheet), ["data/a.xlsx", "data/run/b.CSV"]);
});

test("a table's row height goes into the include line as spread, and must be a sensible line spread", () => {
  assert.equal(sizeKeys("table", { ...tableFormDefaults, spread: "1.2" }), "spread=1.2");
  assert.equal(sizeKeys("table", { ...tableFormDefaults, width: "0.8", spread: " 1.50 " }), "width=0.8, spread=1.5");
  assert.equal(sizeKeys("table", tableFormDefaults), "");
  for (const bad of ["tall", "0.2", "9", "1,2"]) assert.match((sizeKeys("table", { ...tableFormDefaults, spread: bad }) as { problem: string }).problem, /row height/);
  // A plot has no row height.
  assert.equal(sizeKeys("plot", { ...plotFormDefaults }), "");
});
