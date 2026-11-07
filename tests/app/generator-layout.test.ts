// Licensed under the GNU General Public License v2 or later. See LICENSE.
import test from "node:test";
import assert from "node:assert/strict";
import { codeShare, fitCode, fitOptions, optionsShare, optionsShareOf, restoreShare, tileMinimum } from "../../source/app/generator-layout";

test("the options take a third to a half of the pane, never under 280 px", () => {
  assert.equal(fitOptions(1500, optionsShare.initial), 500);
  assert.equal(fitOptions(1500, 0.1), 500, "the tiles never take more than two thirds");
  assert.equal(fitOptions(1500, 0.9), 750);
  assert.equal(fitOptions(600, optionsShare.initial), 280);
  assert.equal(optionsShareOf(1500, 600), 0.4);
  assert.equal(optionsShareOf(1500, 100), optionsShare.min);
});

test("the Code and Preview tiles share their room, each keeping its minimum", () => {
  assert.equal(fitCode(1001, codeShare.initial), 500);
  assert.equal(fitCode(1001, 0.9), 750, "the share is kept within its limits");
  assert.equal(fitCode(400, 0.5), tileMinimum, "a narrow pane keeps the minimum and scrolls sideways");
});

test("saved shares are restored when valid", () => {
  assert.equal(restoreShare(0.4, optionsShare), 0.4);
  assert.equal(restoreShare(340, optionsShare), optionsShare.initial, "the earlier px width is dropped");
  assert.equal(restoreShare(undefined, codeShare), codeShare.initial);
});
