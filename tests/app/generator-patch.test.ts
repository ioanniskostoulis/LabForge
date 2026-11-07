// Licensed under the GNU General Public License v2 or later. See LICENSE.
import test from "node:test";
import assert from "node:assert/strict";
import { patchCode, setAxisOption } from "../../source/app/generator-patch";
import { writePlot, writeTable, type PlotSettings } from "../../source/engine/generators";

const plot = (patch: Partial<PlotSettings> = {}, legend?: string) => writePlot({ kind: "plot", xlabel: "Time (s)", series: [{ type: "function", expression: "x^2", domain: "0:10", ...(legend ? { legend } : {}) }], ...patch });

test("a field patches only its own line and keeps hand edits elsewhere", () => {
  const edited = plot().replace("\\end{axis}", "  \\addplot {x};  % mine\n  \\end{axis}");
  const fresh = plot({ xlabel: "Time (min)" });
  const patched = patchCode(edited, fresh, ["settings", "axis:xlabel"]);
  assert.match(patched, /xlabel=\{Time \(min\)\},/);
  assert.match(patched, /\\addplot \{x\};  % mine/);
  assert.equal(patched.split("\n")[0], fresh.split("\n")[0]);
});

test("axis options are added in order, replaced and removed", () => {
  let code = plot({ xlabel: undefined });
  assert.match(code, /^ {4}\\begin\{axis\}$/m);
  code = setAxisOption(code, "grid", "grid=major")!;
  code = setAxisOption(code, "xlabel", "xlabel={x}")!;
  assert.match(code, / {4}\\begin\{axis\}\[\n {8}xlabel=\{x\},\n {8}grid=major,\n {4}\]/);
  code = setAxisOption(code, "grid", null)!;
  code = setAxisOption(code, "xlabel", null)!;
  assert.match(code, /^ {4}\\begin\{axis\}$/m);
  const oneLine = "\\begin{tikzpicture}\n\\begin{axis}[xlabel={a, b}, width=8cm]\n\\addplot {x};\n\\end{axis}\n\\end{tikzpicture}\n";
  assert.match(setAxisOption(oneLine, "ylabel", "ylabel={c}")!, /\\begin\{axis\}\[\n {2}xlabel=\{a, b\},\n {2}ylabel=\{c\},\n {2}width=8cm,\n\]/);
});

test("the series written from the options are replaced as a whole, legends included", () => {
  const withLegend = plot({}, "Fit");
  const points = writePlot({ kind: "plot", xlabel: "Time (s)", series: [{ type: "points", points: [[0, 1], [2, 3]] }] });
  const patched = patchCode(withLegend, points, ["series"]);
  assert.match(patched, /coordinates \{\n {12}\(0,1\)\n {12}\(2,3\)\n {8}\};\n {4}\\end\{axis\}/);
  assert.doesNotMatch(patched, /addlegendentry/, "the legend belongs to the series it came with");
  // A range writes one series per column; patching to it replaces the single function.
  const range = writePlot({ kind: "plot", xlabel: "Time (s)", series: [{ type: "range", source: "data/a.csv", range: "A1:C3" }] }, [[[0, 1]], [[0, 2]]], ["first", "second"]);
  const two = patchCode(plot(), range, ["series"]);
  assert.equal(two.match(/\\addplot/g)?.length, 2);
  assert.match(two, /\\addlegendentry\{first\}[\s\S]*\\addlegendentry\{second\}\n {4}\\end\{axis\}/);
  // The series was deleted by hand: it comes back before \end{axis}.
  const removed = plot().replace(/ {8}\\addplot.*\n/, "");
  assert.match(patchCode(removed, plot(), ["series"]), /\\addplot\[domain=0:10, samples=100\] \{x\^2\};\n {4}\\end\{axis\}/);
});

test("code without the structure a part needs is replaced by the form's code", () => {
  assert.equal(patchCode("my own picture", plot(), ["axis:xlabel"]), plot());
  assert.equal(patchCode("", plot(), ["series"]), plot());
});

test("table parts: columns, header and data", () => {
  const settings = { kind: "table" as const, source: "data/a.csv", range: "A1:B3", header: true };
  const current = writeTable(settings, [["Name", "Value"], ["a", "1"], ["b", "2"]], ["l", "r"]).replace("\\begin{labtable}{l r}", "\\begin{labtable}{c c}");
  const fresh = writeTable({ ...settings, header: false, range: "A2:B3" }, [["a", "1"], ["b", "2"]], ["l", "r"]);
  const noHead = patchCode(current, fresh, ["head", "data"]);
  assert.doesNotMatch(noHead, /tablehead/);
  assert.match(noHead, /\\begin\{labtable\}\{c c\}/, "alignment edits stay when the header changes");
  assert.match(noHead, /% data: data\/a\.csv, A2:B3\n {4}a & 1 \\\\\n {4}b & 2 \\\\\n {4}% end of data\n\\end\{labtable\}/);
  assert.match(patchCode(noHead, current, ["head"]), /\\begin\{labtable\}\{c c\}\n {4}\\tablehead\{Name & Value\}/);
  assert.match(patchCode(current, fresh, ["columns"]), /\\begin\{labtable\}\{l r\}/);
  // An older file with \tablecolumns still takes the columns.
  const older = "% labforge table {}\n\\tablecolumns{c c}\n\\tablehead{A & B}\n% data: data/a.csv, A1:B2\na & 1 \\\\\n% end of data\n";
  assert.match(patchCode(older, fresh, ["columns"]), /^\\tablecolumns\{l r\}$/m);
});

test("columns with widths replace the columns line whole", () => {
  const settings = { kind: "table" as const, source: "data/a.xlsx", range: "A1:B2", header: false };
  const code = writeTable(settings, [["1", "2"]], ["l", "r"]);
  const fresh = writeTable({ ...settings, columns: "l[0.6] r[2]" }, [["1", "2"]], ["l", "r"]);
  assert.match(patchCode(code, fresh, ["columns"])!, /^\\begin\{labtable\}\{l\[0\.6\] r\[2\]\}$/m);
  assert.match(patchCode(fresh, code, ["columns"])!, /^\\begin\{labtable\}\{l r\}$/m);
});
