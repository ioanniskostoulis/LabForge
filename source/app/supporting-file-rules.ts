// Licensed under the GNU General Public License v2 or later. See LICENSE.
/** A protected path may still be editable; this list concerns file contents only. */
export function supportingFileEditable(path: string): boolean {
  return ![".settings.tex", "settings.tex", ".labforge.cls", "labforge.cls", ".labforge.json", ".latexmkrc"].includes(path);
}
export function supportingTextFile(path: string): boolean {
  return /\.(?:tex|bib|sty|cls|txt|md|csv)$/i.test(path) || path === ".latexmkrc" || path === ".labforge.json";
}
