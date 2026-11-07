// Licensed under the GNU General Public License v2 or later. See LICENSE.
import test from "node:test";
import assert from "node:assert/strict";
import { findGenerated, listingComment, plotDefaults, plotFromArguments, readPlotDefaults, setPlotDefault, tableFromArguments, type GeneratedListing } from "../../source/app/generator-commands";
import { commands, findCommand } from "../../source/app/commands";

const rule = "% ============================================================";
/** A main.tex whose preamble holds `preamble`, then the main writing section. */
const main = (preamble = "") => `\\documentclass[preset=default, language=greek]{labforge}\n${preamble}\n${rule}\n% Main writing section\n${rule}\n\n\\begin{document}\n\n\\end{document}\n`;

test("plot defaults are read from the preamble of main.tex, ignoring comments and the text, and fall back to the class", () => {
  const values = readPlotDefaults(main("\n% \\labforgesetup{plot-colors = color}\n\\labforgesetup{margin = 2cm, plot-grid = major}\n").replace("\\end{document}", "\\labforgesetup{plot-legend = south east}\n\\end{document}"));
  assert.deepEqual(values.get("grid"), { value: "major", custom: true });
  assert.deepEqual(values.get("colors"), { value: "black", custom: false });
  assert.deepEqual(values.get("legend"), { value: "north west", custom: false });
  assert.equal(values.size, plotDefaults.length);
});

test("plot defaults reflect the selected style and later project overrides", () => {
  const settings = "\\labforgepreset{default}{}\n\\labforgepreset{poster}{plot-grid=major, plot-colors=color}\n\\labforgesetup{plot-grid=both}\n";
  const values = readPlotDefaults(main().replace("preset=default", "preset=poster"), settings);
  assert.deepEqual(values.get("grid"), { value: "both", custom: true });
  assert.deepEqual(values.get("colors"), { value: "color", custom: true });
});

test("setting a plot default replaces the key where written, or adds one line to the preamble", () => {
  const added = setPlotDefault(main(), "grid", "both")!;
  assert.equal(added, main("\n\\labforgesetup{plot-grid = both}\n"));
  assert.equal(setPlotDefault(added, "grid", "major"), main("\n\\labforgesetup{plot-grid = major}\n"));
  const shared = main("\n\\labforgesetup{margin = 2cm, plot-legend = north west, plot-grid=none}\n");
  assert.equal(setPlotDefault(shared, "legend", "south east"), main("\n\\labforgesetup{margin = 2cm, plot-legend = south east, plot-grid=none}\n"));
  assert.equal(setPlotDefault(shared, "grid", "major"), main("\n\\labforgesetup{margin = 2cm, plot-legend = north west, plot-grid=major}\n"));
  assert.equal(setPlotDefault("no class line here\n", "colors", "color"), null);
  assert.ok(plotDefaults.every(item => item.pattern.test(item.initial)), "each class default passes its own check");
});

test("plot add reads functions, typed points and a data range", () => {
  assert.deepEqual(plotFromArguments(["function", "0.2*x^2", "0:5"]), { kind: "plot", series: [{ type: "function", expression: "0.2*x^2", domain: "0:5" }] });
  assert.deepEqual(plotFromArguments(["function", "sin(deg(x))"]), { kind: "plot", series: [{ type: "function", expression: "sin(deg(x))", domain: "0:10" }] });
  assert.deepEqual(plotFromArguments(["points", "0,0", "1,2.5", "-2,1e3"]), { kind: "plot", series: [{ type: "points", points: [[0, 0], [1, 2.5], [-2, 1000]] }] });
  assert.match(plotFromArguments(["points", "0,0"]) as string, /two or more points/);
  assert.deepEqual(plotFromArguments(["data", "runs.xlsx", "a1:c20", "Run", "2"]), { kind: "plot", series: [{ type: "range", source: "runs.xlsx", range: "A1:C20", sheet: "Run 2" }] });
  assert.match(plotFromArguments(["data", "runs.xlsx", "A"]) as string, /a range/);
  assert.deepEqual(tableFromArguments(["results.csv", "a1:c9"]), { kind: "table", source: "results.csv", range: "A1:C9", header: true, smart: true });
});

test("generated files are found by number or name, and listed with their state", () => {
  const items: GeneratedListing[] = [
    { name: "plot_1.tex", file: "plots/plot_1.tex", settings: { kind: "plot", series: [{ type: "function", expression: "x", domain: "0:1" }] }, stale: false, missing: [] },
    { name: "runs_plot_1.tex", file: "plots/runs_plot_1.tex", settings: { kind: "plot", series: [{ type: "data", source: "data/runs.csv", x: "A", y: "B" }] }, stale: true, missing: [] },
    { name: "hand.tex", file: "plots/hand.tex", settings: null, stale: false, missing: [] },
  ];
  assert.equal(findGenerated(items, "2")?.name, "runs_plot_1.tex");
  assert.equal(findGenerated(items, "Hand")?.name, "hand.tex");
  assert.equal(findGenerated(items, "plots/plot_1.tex")?.name, "plot_1.tex");
  assert.equal(findGenerated(items, "4"), undefined);
  assert.deepEqual(items.map(listingComment), ["no data file", "out of date, data/runs.csv", "written by hand"]);
  assert.equal(listingComment({ ...items[1], missing: ["data/runs.csv"] }), "missing data/runs.csv");
});

test("plot and table forms are accepted by their argument patterns", () => {
  const plot = findCommand("plot")!.args, table = findCommand("table")!.args;
  for (const form of ["add function 0.2*x^2 0:5", "add points 0,0 1,2", "add data runs.xlsx A1:C20 Run 2", "open 1", "regenerate all", "remove plot_1", "default grid major", "default legend north east", "default", "defaults"]) assert.ok(plot.test(form), form);
  for (const form of ["add", "add data runs.xlsx A B", "open", "frobnicate 1"]) assert.ok(!plot.test(form), form);
  for (const form of ["add results.xlsx A1:D12", "add results.xlsx a1:d12 Sheet 1", "header 1 off", "align 2 lcr", "align 2 auto", "align 2", "align 2 l c[2] r[0.5]", "align 2 l[0.6]cr", "smart yields on", "smart 2", "regenerate all"]) assert.ok(table.test(form), form);
  for (const form of ["add results.xlsx A1", "align 2 lxr", "align 2 c[x]", "header 1 maybe"]) assert.ok(!table.test(form), form);
  assert.ok(commands.some(command => command.name === "plots") && commands.some(command => command.name === "tables"));
});
