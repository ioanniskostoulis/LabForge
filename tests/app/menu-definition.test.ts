// Licensed under the GNU General Public License v2 or later. See LICENSE.
import { test } from "node:test";
import assert from "node:assert/strict";
import { checkShortcuts } from "forge-shell/app/shortcuts";
import { collectShortcuts, type MenuNode } from "forge-shell/app/menus";
import { menuForState, type MenuState } from "../../source/app/menu-definition";
import { editorDefaults } from "../../source/app/editor-settings";
import { filesDefaults } from "../../source/app/file-settings";

const state: MenuState = { hasReport: true, showInspector: true, showBottomPanel: true, editor: editorDefaults, files: filesDefaults, appearance: "dark" };
const ids = (nodes: readonly MenuNode[]): string[] => nodes.flatMap(node => [...(node.id ? [node.id] : []), ...ids(node.submenu ?? [])]);

test("the menu keys pass the shell's shortcut check on macOS and Windows, with no exclusions", () => {
  for (const [mac, building] of [[true, false], [true, true], [false, false], [false, true]]) {
    const entries = collectShortcuts(menuForState({ ...state, building }, { desktop: true, mac }));
    assert.deepEqual(checkShortcuts(entries, mac), [], mac ? "macOS" : "Windows");
  }
});

test("standard items keep the shell's labels and keys, and Build and Cancel build share one key", () => {
  const all = (nodes: readonly MenuNode[]): MenuNode[] => nodes.flatMap(node => [node, ...all(node.submenu ?? [])]);
  const mac = all(menuForState(state, { desktop: true, mac: true }));
  const find = (id: string) => mac.find(node => node.id === id)!;
  assert.equal(find("view.actualSize").key, "CmdOrCtrl+1");
  assert.ok(!find("view.fit"), "the editor has nothing to fit");
  assert.equal(find("file.new").label, "New report");
  assert.equal(find("edit.replace").key, "Alt+CmdOrCtrl+F");
  assert.equal(find("edit.copy").role, "copy");
  assert.equal(find("edit.selectAll").role, undefined);
  const building = all(menuForState({ ...state, building: true }, { desktop: true, mac: true }));
  assert.equal(find("build").key, building.find(node => node.id === "cancelBuild")!.key);
  assert.equal(find("cancelBuild").key, undefined);
});

test("Help uses the shell's 6.0.0 guide order without an updates action", () => {
  const help = menuForState(state, { desktop: true, mac: false }).find(menu => menu.label === "Help")!;
  assert.deepEqual(ids(help.submenu!), ["about", "about.whatsNew", "about.shortcuts", "writingHelper", "about.licenses"]);
  const mac = menuForState(state, { desktop: true, mac: true }).find(menu => menu.label === "Help")!;
  assert.equal(ids(mac.submenu!)[0], "about.whatsNew", "macOS keeps About in the application menu");
});

test("File › Open recent lists recent reports on the desktop only", () => {
  const file = (desktop: boolean, recent: string[]) => menuForState({ ...state, recent }, { desktop, mac: true })[0].submenu!;
  assert.deepEqual(ids(file(true, ["/a/one.lfg", "/b/two.lfg"])).filter(id => id.startsWith("file.recent")), ["file.recent.0", "file.recent.1", "file.recent.clear"]);
  assert.equal(file(true, []).find(node => node.label === "Open recent")!.submenu![0].label, "No recent files");
  assert.ok(!file(false, ["/a/one.lfg"]).some(node => node.label === "Open recent"));
});
