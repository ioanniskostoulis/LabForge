// Licensed under the GNU General Public License v2 or later. See LICENSE.
import test from "node:test";
import assert from "node:assert/strict";
import { changedOptions, readCode } from "../../source/app/generator-read";
import { customFunction, customPoints } from "../../source/app/generator-form";
import { writePlot } from "../../source/engine/generators";

test("a plot's options are read back from the code the writer makes", () => {
  const code = writePlot({ kind: "plot", xlabel: "Time (s)", ylabel: "Yield (\\%)", grid: true, ylog: true, series: [{ type: "function", expression: "0.2*x^2", domain: "0:5", legend: "fit" }] });
  assert.deepEqual(readCode("plot", code), { xlabel: "Time (s)", ylabel: "Yield (%)", grid: true, xlog: false, ylog: true, source: customFunction, expression: "0.2*x^2", domain: "0:5", legend: "fit" });
});

test("typed points and a spreadsheet range are read", () => {
  const points = readCode("plot", writePlot({ kind: "plot", series: [{ type: "points", points: [[0, 0], [1, 2.5]] }] }));
  assert.equal(points.source, customPoints);
  assert.equal(points.points, "0,0 1,2.5");
  const range = readCode("plot", writePlot({ kind: "plot", series: [{ type: "range", source: "data/runs.csv", sheet: "Run 2", range: "A1:C9" }] }, [[[0, 1]], [[0, 2]]]));
  assert.deepEqual([range.source, range.sheet, range.range, range.legend], ["data/runs.csv", "Run 2", "A1:C9", undefined]);
});

test("a hand edit shows as the changed options only", () => {
  const code = writePlot({ kind: "plot", series: [{ type: "function", expression: "x^2", domain: "0:10" }] });
  const before = readCode("plot", code);
  const edited = code.replace("\\begin{axis}", "\\begin{axis}[\n        xlabel={Time},\n        xmode=log,\n    ]").replace("{x^2}", "{x^3}");
  assert.deepEqual(changedOptions(readCode("plot", edited), before), { xlabel: "Time", xlog: true, expression: "x^3" });
  assert.deepEqual(changedOptions(before, before), {});
});

test("a table's header, columns and data marker are read", () => {
  const code = ["% labforge table {}", "\\begin{labtable}{lcr}", "    \\tablehead{A & B & C}", "    % data: data/a.xlsx, Results, A1:C4", "    1 & 2 & 3 \\\\", "    % end of data", "\\end{labtable}"].join("\n");
  assert.deepEqual(readCode("table", code), { align: "lcr", header: true, source: "data/a.xlsx", sheet: "Results", range: "A1:C4" });
  assert.equal(readCode("table", code.replace("    \\tablehead{A & B & C}\n", "")).header, false);
  assert.equal(readCode("table", code.replace("{lcr}", "{l[0.6] c c[2]}")).align, "l[0.6] c c[2]");
});
