// Licensed under the GNU General Public License v2 or later. See LICENSE.
// The options of the class line and the keys of \labforgesetup with what each takes, for Help › Writing helper.
// tests/app/settings-reference.test.ts keeps the keys and defaults in step with assets/framework/labforge.cls.

export type SettingRow = { key: string; takes: string; initial: string; what: string };

/** Options of `\documentclass[…]{.labforge}`. */
export const classOptionRows: readonly SettingRow[] = [
  { key: "preset", takes: "a name defined in .settings.tex, such as default, report, thesis", initial: "default", what: "The style applied on top of the class's baseline values." },
  { key: "language", takes: "greek, english", initial: "greek", what: "Main language, and the language of Figure, Table and the title labels." },
  { key: "fontsize", takes: "8pt, 9pt, 10pt, 11pt, 12pt, 14pt, 17pt, 20pt", initial: "10pt", what: "Base text size." },
  { key: "bibliography", takes: "on or off (write the word to turn it on)", initial: "off", what: "Makes biblatex and biber read references.bib." },
];

/** Keys of `\labforgesetup{…}`, which override the preset. */
export const settingRows: readonly SettingRow[] = [
  { key: "margin", takes: "a length: 1in, 2.5cm, 20mm", initial: "1in", what: "Page margin on all sides." },
  { key: "margin-left", takes: "a length: 1in, 2.5cm, 20mm", initial: "margin", what: "Left page margin; overrides margin." },
  { key: "margin-right", takes: "a length: 1in, 2.5cm, 20mm", initial: "margin", what: "Right page margin; overrides margin." },
  { key: "margin-top", takes: "a length: 1in, 2.5cm, 20mm", initial: "margin", what: "Top page margin; overrides margin." },
  { key: "margin-bottom", takes: "a length: 1in, 2.5cm, 20mm", initial: "margin", what: "Minimum bottom page margin; the line grid may add less than one line." },
  { key: "line-spread", takes: "a decimal above 0: 1.15, 1.5, 1.6", initial: "1.5", what: "Line spacing; everything vertical is counted in whole lines of this height." },
  { key: "indent", takes: "a length: 0.5in, 1.5em", initial: "0.5in", what: "First-line indent, also the column gap, the list indent and the heading hang." },
  { key: "paragraph-space", takes: "a whole number of lines from 0", initial: "0", what: "Blank lines between paragraphs." },
  { key: "block-space", takes: "a whole number of lines from 0", initial: "0", what: "Lines above and below figures, plots and tables." },
  { key: "block-gap", takes: "a whole number of lines from 0", initial: "0", what: "Extra lines between two blocks in a row." },
  { key: "caption-gap", takes: "a fraction of a line: 0.35", initial: "0.35", what: "Space between a figure, plot or table and its caption." },
  { key: "subcaption-gap", takes: "a fraction of a line: 0.25", initial: "0.25", what: "Space between an image and its subcaption." },
  { key: "caption-spread", takes: "a fraction of line-spread: 0.75", initial: "0.75", what: "Line spacing inside captions as a share of the body's; never below single spacing." },
  { key: "math-gap", takes: "a fraction of a line: 0.25", initial: "0.25", what: "Space around formulas taller than a line; none above after a short line." },
  { key: "block-snap", takes: "auto, line, half, off", initial: "auto", what: "Whether the space around blocks grows to keep text on the grid; auto does so in columns only." },
  { key: "sub-figure-gap", takes: "a length: 1.5em, 5mm", initial: "1.5em", what: "Space between figures or plots set side by side." },
  { key: "math-space", takes: "a whole number of lines from 0", initial: "0", what: "Extra lines around equations and reactions." },
  { key: "section-numbers", takes: "true, false", initial: "true", what: "Shows heading numbers (I., I.II.)." },
  { key: "section-hang", takes: "true, false", initial: "true", what: "Hangs the heading number in the left margin." },
  { key: "section-center", takes: "true, false", initial: "false", what: "Centres top-level headings; applies when section-hang is false." },
  { key: "number-depth", takes: "1, 2, 3, 4", initial: "2", what: "How deep figure, table and equation numbers go: 3, 1.3, 1.2.3, 1.2.3.4." },
  { key: "caption-align", takes: "justify, center, left, right", initial: "justify", what: "Alignment of captions; caption-align= in a block's keys changes one caption." },
  { key: "figure-caption-align", takes: "justify, center, left, right", initial: "caption-align", what: "Alignment of figure captions; overrides caption-align." },
  { key: "plot-caption-align", takes: "justify, center, left, right", initial: "caption-align", what: "Alignment of plot captions; overrides caption-align." },
  { key: "table-caption-align", takes: "justify, center, left, right", initial: "caption-align", what: "Alignment of table captions; overrides caption-align." },
  { key: "caption-hyphenate", takes: "true, false", initial: "true", what: "Hyphenation inside captions; hyphenate= in a block's keys changes one caption." },
  { key: "caption-color", takes: "a colour name: black, blue", initial: "black", what: "Caption colour; ignored when caption-theme is on." },
  { key: "caption-theme", takes: "true, false", initial: "false", what: "Puts captions in the theme colour." },
  { key: "theme-color", takes: "six hex digits without #: 061027", initial: "061027", what: "The theme colour." },
  { key: "main-font", takes: "an installed font name", initial: "empty (Libertinus Serif)", what: "Replaces the text font." },
  { key: "math-font", takes: "an installed font name", initial: "empty (Libertinus Math)", what: "Replaces the maths font." },
  { key: "mono-font", takes: "an installed font name", initial: "empty (DejaVu Sans Mono)", what: "Replaces the code font." },
  { key: "plot-line-width", takes: "a length: 0.8pt", initial: "0.8pt", what: "Width of data lines." },
  { key: "plot-axis-width", takes: "a length: 0.5pt", initial: "0.5pt", what: "Width of axes and ticks." },
  { key: "plot-tick-length", takes: "a length: 4pt", initial: "4pt", what: "Major tick length; minor ticks are half." },
  { key: "plot-minor-ticks", takes: "a whole number from 0", initial: "1", what: "Minor ticks between major ones." },
  { key: "plot-padding", takes: "a decimal from 0 to about 0.2", initial: "0.06", what: "Space between the data and the frame, as a fraction of each axis range." },
  { key: "plot-balance", takes: "a decimal from 0 to 1", initial: "0.5", what: "Blank space on the right of a plot: 0 centres the whole picture, 1 the frame." },
  { key: "plot-mark-size", takes: "a length: 2pt", initial: "2pt", what: "Size of point markers." },
  { key: "plot-grid", takes: "none, major, both", initial: "none", what: "Grid lines." },
  { key: "plot-colors", takes: "black, color", initial: "black", what: "Series in black or in colour." },
  { key: "plot-legend", takes: "a corner such as north~west", initial: "north west", what: "Legend corner; other pgfplots positions are passed through." },
];
