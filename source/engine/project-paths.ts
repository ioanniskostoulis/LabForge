// Licensed under the GNU General Public License v2 or later. See LICENSE.
// Path rules shared by the engine and the interface; no Node imports, so the renderer can bundle them.

/** Spreadsheet types the table and plot generators read. */
export const spreadsheetExtensions = [".xlsx", ".xlsm", ".xls", ".xlsb", ".csv", ".ods"];

/** Spreadsheets under `data/`, which the Source lists of Plots and Tables offer. */
export function isDataSpreadsheet(relative: string): boolean {
  const dot = relative.lastIndexOf(".");
  return relative.startsWith("data/") && dot > 0 && spreadsheetExtensions.includes(relative.slice(dot).toLowerCase()) && !relative.split("/").some(part => part.startsWith(".") || part.startsWith("~$"));
}

/** The report class each project carries; LabForge keeps it current. */
export const projectClassFile = ".labforge.cls";
export const projectSettingsFile = ".settings.tex";

/** Why a path cannot be renamed or moved, or `null` when it can. The report class and LabForge read these paths by name. */
export function renameBlockReason(relative: string): string | null {
  if (isProtectedProjectPath(relative)) return `${relative} cannot be renamed: LabForge and the report class find it by name.`;
  if (relative === "references.bib") return `${relative} cannot be renamed: the report class reads it by that name.`;
  return null;
}

/** Paths the report needs to build or open: the inspector offers no removal for them. */
export function isProtectedProjectPath(relative: string): boolean {
  return ["main.tex", projectSettingsFile, projectClassFile, "settings.tex", "labforge.cls", ".labforge.json", ".latexmkrc", "data", "graphics", "plots", "tables"].includes(relative);
}
