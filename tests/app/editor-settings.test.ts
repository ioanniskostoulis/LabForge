// Licensed under the GNU General Public License v2 or later. See LICENSE.
import test from "node:test";
import assert from "node:assert/strict";
import { editorCommand, editorCompletions, editorDefaults, restoreEditorSettings } from "../../source/app/editor-settings";

test("editor settings restore valid values, keep defaults otherwise and map the earlier editorWrap", () => {
  assert.deepEqual(restoreEditorSettings(undefined), editorDefaults);
  assert.deepEqual(restoreEditorSettings({ minimap: true, tabSize: 2, smoothBlink: "yes", cursorBlink: false, unknown: 1 }), { ...editorDefaults, minimap: true, tabSize: 2 });
  assert.equal(restoreEditorSettings({ tabSize: 3 }).tabSize, 4);
  assert.deepEqual(restoreEditorSettings({ bracketStyle: "grey" }), { ...editorDefaults, bracketColors: false, bracketDimmed: true });
  assert.deepEqual(restoreEditorSettings({ bracketStyle: "x" }), editorDefaults);
  assert.equal(restoreEditorSettings(undefined, false).wrap, false);
  assert.equal(restoreEditorSettings({ wrap: true }, false).wrap, true);
});

test("the editor verb lists, queries and sets options with the shared wording", () => {
  const list = editorCommand([], editorDefaults)!;
  assert.equal(list.lines.length, 15);
  assert.deepEqual(list.lines[0], { marker: "[on]", enabled: true, label: "wrap", comment: "Word wrap" });
  assert.deepEqual(editorCommand(["minimap"], editorDefaults)!.lines, ["Minimap is off."]);
  assert.deepEqual(editorCommand(["minimap", "on"], editorDefaults), { lines: ["Minimap enabled."], patch: { minimap: true } });
  assert.deepEqual(editorCommand(["mathpreview", "on"], editorDefaults), { lines: ["Math preview enabled."], patch: { mathPreview: true } });
  assert.deepEqual(editorCommand(["commandlanguage", "on"], editorDefaults), { lines: ["English input for LaTeX commands enabled."], patch: { commandLanguage: true } });
  assert.deepEqual(editorCommand(["wrap", "on"], editorDefaults), { lines: ["Word wrap is already on."] });
  assert.deepEqual(editorCommand(["tabsize", "8"], editorDefaults), { lines: ["Tab size set to 8 spaces."], patch: { tabSize: 8 } });
  assert.equal(editorCommand(["tabsize", "3"], editorDefaults), null);
  assert.deepEqual(editorCommand(["brackets", "dimmed", "on"], editorDefaults), { lines: ["Dimmed brackets enabled."], patch: { bracketDimmed: true } });
  assert.deepEqual(editorCommand(["brackets", "dimmed"], editorDefaults)!.lines, ["Dimmed brackets is off."]);
  assert.equal(editorCommand(["brackets", "style", "grey"], editorDefaults), null);
  assert.deepEqual(editorCommand(["caret", "blink", "off"], editorDefaults), { lines: ["Smooth cursor blinking disabled."], patch: { smoothBlink: false } });
  assert.deepEqual(editorCommand(["brackets", "colored", "on"], editorDefaults), { lines: ["Bracket pair colors is already on."] });
  assert.equal(editorCommand(["caret", "nothing"], editorDefaults), null);
  assert.equal(editorCommand(["brackets", "colors", "on", "x"], editorDefaults), null);
  assert.equal(editorCommand(["autoclose"], editorDefaults), null);
  assert.deepEqual(editorCommand(["caret"], editorDefaults)!.lines.map(line => typeof line === "string" ? line : line.label), ["caret blink", "caret smooth", "caret margin"]);
  assert.equal(editorCommand(["minimap", "maybe"], editorDefaults), null);
  assert.equal(editorCommand(["nothing"], editorDefaults), null);
});

test("editor completions offer option names, then on, off or tab sizes", () => {
  assert.deepEqual(editorCompletions("editor mi"), ["editor minimap"]);
  assert.deepEqual(editorCompletions("editor minimap o"), ["editor minimap on", "editor minimap off"]);
  assert.deepEqual(editorCompletions("editor caret "), ["editor caret blink", "editor caret smooth", "editor caret margin"]);
  assert.deepEqual(editorCompletions("editor brackets di"), ["editor brackets dimmed"]);
  assert.deepEqual(editorCompletions("editor tabsize "), ["editor tabsize 2", "editor tabsize 4", "editor tabsize 8"]);
});
