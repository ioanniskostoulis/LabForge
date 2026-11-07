// Licensed under the GNU General Public License v2 or later. See LICENSE.
import test from "node:test";
import assert from "node:assert/strict";
import { moveSupportingView } from "../../source/app/supporting-view-order";

test("a side-view drop places the source at the indicated edge", () => {
  const order = ["pdf", "references.bib", ".settings.tex"];
  assert.deepEqual(moveSupportingView(order, ".settings.tex", "pdf", "above"), [".settings.tex", "pdf", "references.bib"]);
  assert.deepEqual(moveSupportingView(order, "pdf", "references.bib", "below"), ["references.bib", "pdf", ".settings.tex"]);
  assert.deepEqual(order, ["pdf", "references.bib", ".settings.tex"]);
});

test("a side-view drop gives no placement for a position that cannot change", () => {
  const order = ["pdf", "references.bib", ".settings.tex"];
  assert.equal(moveSupportingView(order, "pdf", "references.bib", "above"), null);
  assert.equal(moveSupportingView(order, ".settings.tex", "references.bib", "below"), null);
  assert.equal(moveSupportingView(order, "pdf", "pdf", "below"), null);
  assert.equal(moveSupportingView(order, "missing", "pdf", "above"), null);
});
