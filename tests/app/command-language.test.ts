// Licensed under the GNU General Public License v2 or later. See LICENSE.
import assert from "node:assert/strict";
import { test } from "node:test";
import { CommandLanguageSession } from "../../source/app/command-language";

test("a typed backslash switches once and the command terminator restores the prior source", () => {
  const actions: string[] = [];
  const session = new CommandLanguageSession(action => { actions.push(action); return true; });
  session.typed("\\"); session.typed("m"); session.typed("y"); session.typed("{"); session.stop();
  assert.deepEqual(actions, ["begin", "restore"]);
});

test("a second backslash ends a one-character command without starting another switch", () => {
  const actions: string[] = [];
  const session = new CommandLanguageSession(action => { actions.push(action); return true; });
  session.typed("\\"); session.typed("\\"); session.typed("plain");
  assert.deepEqual(actions, ["begin", "restore"]);
});

test("failed switches and multi-character insertion cannot leave a source waiting to restore", () => {
  const actions: string[] = [];
  const session = new CommandLanguageSession(action => { actions.push(action); return false; });
  session.typed("\\"); session.stop(); session.typed("\\alpha");
  assert.deepEqual(actions, ["begin"]);
});
