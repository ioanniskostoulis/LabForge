// Licensed under the GNU General Public License v2 or later. See LICENSE.
import type { MenuNode } from "forge-shell/app/menus";
import { helpMenu } from "forge-shell/app/about";
import { recentMenu } from "forge-shell/app/saving";
import { appShortcut } from "forge-shell/app/shortcuts";
import { standardItem, zoomItems } from "forge-shell/app/standard-items";
import type { StandardAction } from "forge-shell/app/shared-commands";
import { forgeApp } from "./profile";
import { editorFamilies, editorToggles, tabSizes, type EditorSettings } from "./editor-settings";
import type { FilesSettings } from "./file-settings";

export type MenuState = {
  hasReport: boolean;
  showInspector: boolean;
  showBottomPanel: boolean;
  editor: EditorSettings;
  files: FilesSettings;
  appearance: "dark" | "light" | "pride";
  /** A build is running, so it can be cancelled. */
  building?: boolean;
  /** The PDF keeps the cursor's line in view. */
  pdfFollow?: boolean;
  /** Save also builds the PDF. */
  buildOnSave?: boolean;
  /** Reports opened or saved lately, newest first, for File › Open recent. */
  recent?: string[];
};

/** One action catalogue for the browser menu and the desktop's native menu. */
export function menuForState(state: MenuState, options: { desktop: boolean; mac: boolean }): MenuNode[] {
  const item = (id: string, label: string, key?: string, enabled = true): MenuNode =>
    ({ id, label, enabled, ...(key ? { key } : {}) });
  const report = state.hasReport;
  const buildKey = appShortcut("B", "app", options.mac);
  const desktopReport = report && options.desktop;
  /** A standard item of the shell, with its own label and key, for this platform. */
  const standard = (action: StandardAction, extra: Partial<MenuNode> = {}): MenuNode => standardItem(action, { noun: "report" }, extra, options.mac);
  // Undo and Redo are app actions on desktop too: the editor keeps its own history, which native roles cannot reach.
  // Cut, Copy and Paste keep their roles and leave their keys to text fields; Select all follows the focus, so LabForge runs it.
  const edit: MenuNode[] = [standard("edit.undo"), standard("edit.redo"), { separator: true },
    standard("edit.cut"), standard("edit.copy"), standard("edit.paste"), standard("edit.selectAll", { role: undefined })];
  // Appearance lists Dark and Light; another appearance leaves both unchecked.
  const appearance: MenuNode[] = (["dark", "light"] as const).map(value => ({
    id: `theme${value[0].toUpperCase()}${value.slice(1)}`,
    label: `${value[0].toUpperCase()}${value.slice(1)}`,
    checked: state.appearance === value,
  }));
  // Editor options are app preferences, so they stay available with no report open.
  const editorMenu: MenuNode[] = [
    ...editorToggles.filter(toggle => !toggle.family && toggle.key !== "wrap" && (toggle.key !== "commandLanguage" || options.desktop)).map(toggle => ({ id: `editor.${toggle.key}`, label: toggle.label, checked: state.editor[toggle.key] })),
    ...editorFamilies.map(family => ({ label: family.label, submenu: [
      ...editorToggles.filter(toggle => toggle.family === family.name).map(toggle => ({ id: `editor.${toggle.key}`, label: toggle.label, checked: state.editor[toggle.key] })),
    ] })),
    { label: "Tab size", submenu: tabSizes.map(size => ({ id: `editor.tabSize.${size}`, label: `${size} spaces`, checked: state.editor.tabSize === size })) },
    { separator: true },
    item("foldAll", "Fold all", undefined, report), item("unfoldAll", "Unfold all", undefined, report),
  ];
  return [
    { label: "File", submenu: [standard("file.new"), standard("file.open"),
      ...(options.desktop ? [recentMenu(state.recent ?? [])] : []),
      { separator: true }, standard("file.save", { enabled: desktopReport }), item("showContents", "Show project contents", undefined, desktopReport), item("showInFinder", options.mac ? "Show file in Finder" : "Show file in File Explorer", undefined, desktopReport), item("exportZip", "Export as ZIP…", undefined, desktopReport), standard("file.close", { enabled: report })] },
    { label: "Edit", submenu: [...edit, { separator: true },
      standard("edit.toggleComment", { enabled: report }), item("joinLines", "Join lines", undefined, report), item("sortLines", "Sort lines", undefined, report), item("trimWhitespace", "Trim trailing whitespace", undefined, report),
      { separator: true }, standard("edit.find", { enabled: report }), standard("edit.replace", { enabled: report }),
      item("renameLabel", "Rename label…", undefined, report), { separator: true },
      standard("edit.findNext", { enabled: report }), standard("edit.findPrevious", { enabled: report }), standard("edit.goToLine", { enabled: report })] },
    { label: "View", submenu: [
      // The zooms set the editor's text size; text has nothing to fit, so LabForge has no Fit.
      ...zoomItems(report).filter(node => node.id !== "view.fit"), { separator: true },
      standard("view.inspector", { checked: state.showInspector }),
      standard("view.bottomPanel", { checked: state.showBottomPanel }),
      item("pdf", "Show PDF preview", undefined, report), { id: "pdfFollow", label: "PDF follows cursor", checked: !!state.pdfFollow, enabled: options.desktop }, { separator: true },
      { ...item("wrapText", "Wrap text", appShortcut("W", "app", options.mac)), checked: state.editor.wrap }, { label: "Editor", submenu: editorMenu },
      { id: "files.hidden", label: "Show hidden files", checked: state.files.showHidden }, { separator: true },
      { label: "Appearance", submenu: appearance }] },
    // Build and Cancel build are one toggle: the key Build PDF takes cancels while a build runs.
    { label: "Document", submenu: [item("build", "Build PDF", state.building ? undefined : buildKey, desktopReport && !state.building), item("cancelBuild", "Cancel build", state.building ? buildKey : undefined, desktopReport && !!state.building), { separator: true }, item("showInPdf", "Show in PDF", undefined, desktopReport), { id: "buildOnSave", label: "Build on save", checked: !!state.buildOnSave, enabled: options.desktop }] },
    help(options.desktop && options.mac),
  ];
}

/** The shell's Help menu with Writing helper after the information dialogs; Check for updates… ends it. */
function help(appMenuHasAbout: boolean): MenuNode {
  const shared = helpMenu(forgeApp.identity.name, appMenuHasAbout, !!forgeApp.identity.repository).submenu ?? [];
  const updates = shared.findIndex(node => node.id === "about.updates");
  const informational = updates < 0 ? shared : shared.slice(0, updates - 1);
  return { label: "Help", submenu: [...informational, { separator: true }, { id: "writingHelper", label: "Writing helper…" }, ...(updates < 0 ? [] : shared.slice(updates - 1))] };
}
