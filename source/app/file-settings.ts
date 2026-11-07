// Licensed under the GNU General Public License v2 or later. See LICENSE.

/** How the inspector lists project files; one app preference object (`files` in `labforge.settings`). */
export type FilesSettings = { showHidden: boolean };

export const filesDefaults: FilesSettings = { showHidden: false };

/** An earlier `view` key (Groups or Tree) is dropped: the tree is the only view. */
export function restoreFilesSettings(stored: unknown): FilesSettings {
  const source = stored && typeof stored === "object" ? stored as Record<string, unknown> : {};
  return { showHidden: typeof source.showHidden === "boolean" ? source.showHidden : filesDefaults.showHidden };
}
