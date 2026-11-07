// Licensed under the GNU General Public License v2 or later. See LICENSE.
// The four Help dialogs come from the shell (forge-shell/app/about); LabForge adds its About paragraphs, the works it
// includes beyond the shared ones, and Help › Writing helper.
import { escape, term, infoWindow, SHARED_WORKS, showAbout as sharedAbout, showLicenses as sharedLicenses, type InfoOptions, type IncludedWork } from "forge-shell/app/about";
import { forgeApp } from "./profile";
import { frameworkCommands } from "./framework-commands";
import { classOptionRows, settingRows, type SettingRow } from "./settings-reference";

/** Third-party work bundled with the desktop app beyond the shell's shared works, as listed in NOTICE.md. */
const INCLUDED: readonly IncludedWork[] = [
  ["SheetJS CE", "reads spreadsheet files; Apache License 2.0", "https://sheetjs.com/"],
  ["PDF.js", "draws the in-app PDF preview; Apache License 2.0", "https://mozilla.github.io/pdf.js/"],
  ["CodeMirror", "the LaTeX source editor, with Lezer and its helpers; MIT", "https://codemirror.net/"],
  ["codemirror-minimap", "the optional editor minimap, by Brady Madden (Replit); MIT", "https://github.com/replit/codemirror-minimap"],
  ["KaTeX", "draws the formula preview; MIT", "https://katex.org/"],
];

/** The product, purpose, wordmark and version every information dialog shows. */
export function infoOptions(logo: string, version: string): InfoOptions {
  return { productName: forgeApp.identity.name, purpose: forgeApp.identity.purpose, logo, version };
}

export function showAbout(info: InfoOptions): void {
  sharedAbout(info, `
        <div class="block">
          <div class="about-heading">LabForge</div>
          <p class="about-intro">LabForge is a desktop workspace for writing LaTeX reports and producing their PDF, plots and tables. It is part of the Forge family of apps designed and directed by <strong>Ioannis Shi Kostoulis</strong>.</p>
        </div>
        <div class="block">
          <p class="about-intro">LabForge compiles reports with an installed TeX distribution. XeLaTeX, biber, latexmk and document fonts are not bundled.</p>
          <p class="about-intro">The LabForge name, logo and icon are not granted by the license below.</p>
        </div>`);
}

/** LabForge's own license, the shared and LabForge's included works, then the full GPL text. */
export function showLicenses(info: InfoOptions): Promise<void> {
  return sharedLicenses(info, [...SHARED_WORKS, ...INCLUDED]);
}

/** Class options, \\labforgesetup keys and LabForge commands for Help › Writing helper. */
export function showWritingHelper(info: InfoOptions): void {
  const settings = (rows: readonly SettingRow[]) => rows.map(row => term(row.key, `${row.what} Takes ${row.takes}. Default ${row.initial}.`)).join("");
  const block = (title: string, intro: string, rows: string) =>
    `<div class="block"><div class="about-heading">${escape(title)}</div><p class="about-intro">${escape(intro)}</p><div class="terms reference">${rows}</div></div>`;
  infoWindow("writing helper", info, [
    block("Class options", "Written in \\documentclass[…]{.labforge}, or chosen in the Builder.", settings(classOptionRows)),
    block("Settings", "The class supplies baseline values. Define styles with \\labforgepreset{name}{key=value, …} in .settings.tex; select one with preset= in main.tex.", settings(settingRows)),
    block("Commands", "LabForge's own commands. Keys go in square brackets before the braces.",
      frameworkCommands.map(command => term(command.syntax, `${command.description}${command.keys.length ? `. Keys: ${command.keys.join(", ")}` : ""}.`)).join("")),
    block("Reference labels", "Use a label with \\myref for its kind and number, or with \\ref for numbers alone. Both commands accept comma-separated labels.", [
      term("fig:<path>", "A numbered image from \\myfigure, such as fig:setup/photo."),
      term("plot:<path>", "A numbered plot from \\myplot, such as plot:absorbance. Plots use the Figure name."),
      term("tab:<path>", "A numbered table from \\mytable, such as tab:yields."),
      term("<label>[1]", "A part of figures or plots set side by side, such as fig:setup[2] for Figure 3b."),
      term("label=<name>", "A formula, reaction or section label, such as equilibrium, formation or intro. Formula rows also accept name[1], name[2] and so on."),
    ].join("")),
  ].join(""));
}
