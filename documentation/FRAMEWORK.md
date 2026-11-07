# LabForge report class

`assets/framework/labforge.cls` is the TeX framework source, rewritten from scratch on 2026-10-16. LabForge copies it into each project as `.labforge.cls`, next to `main.tex`, so a report builds with `latexmk main.tex` on any computer with a TeX distribution, with or without LabForge. LabForge replaces a project's copy when it differs, on open and before each build.

A new project holds `main.tex`, `.settings.tex`, `.labforge.cls`, `.latexmkrc`, `references.bib` and the folders `graphics/`, `plots/` and `tables/`. The two dotted support files remain hidden in Finder and the Files tree unless hidden files are shown. `.latexmkrc` sends LaTeX intermediates, `main.bbl` among them, to `.build/`. Older projects with ordinary `settings.tex` and `labforge.cls` are migrated to dotted names when opened; older `src/` and `zds/` layouts are migrated by hand.

## Document setup

```latex
\documentclass[preset=report, language=greek, bibliography]{.labforge}
```

| Option | Values | Default |
|---|---|---|
| `preset` | A name defined in `.settings.tex`; new reports include `default`, `report`, `thesis` (`none` still reads as `default`) | `default` when left out |
| `language` | `greek`, `english` | `greek` |
| `bibliography` | present or absent; reads `references.bib` and runs biber | absent |
| `fontsize` | `8pt`, `9pt`, `10pt`, `11pt`, `12pt`, `14pt`, `17pt`, `20pt` (the class builds on `extarticle`, from the `extsizes` package; BasicTeX needs `tlmgr install extsizes`) | `10pt` |

Columns are not a class option: write `\begin{multicols}{2}` … `\end{multicols}` in `main.tex`, as in plain LaTeX. Put `\myreport` or `\mythesis`, an abstract or anything else that should run across the page before `\begin{multicols}`. Inside it, the title commands and `place=span` blocks still run across all columns. Write `\mybibliography` inside them for a list in the columns, or after `\end{multicols}` for one across the page.

A report's styles live in `.settings.tex`, next to `main.tex`. The class supplies every baseline value, then reads this file. Each `\labforgepreset{<name>}{<keys>}` block applies its keys only when `main.tex` selects that name with `preset=<name>`. The new `default` block is empty; `report` and `thesis` list only changes. Add another block with a distinct name to create a style; Builder and `preset <name>` in Terminal list it after the file changes. A `\labforgesetup{...}` after the blocks applies shared project overrides, and one in the preamble of `main.tex` applies last. LabForge currently writes `plot default` changes in that preamble. `.settings.tex` is user-owned and is not replaced with the class. Older `settings.tex` files with only `\labforgesetup` receive the new style declarations above their existing overrides when LabForge opens the report. Keep the file in the project: a non-default preset without a matching definition gives a build error. Avoid blank lines inside a keys block; TeX reads one as a paragraph break.

`margin` supplies all four page margins by default. `margin-left`, `margin-right`, `margin-top` and `margin-bottom` override one side independently, for example `\labforgesetup{margin=1in, margin-left=1.25in, margin-bottom=1.4in}`. The top margin is exact; the bottom is at least the requested size because the text height is rounded down to a whole number of lines.

## Bibliography

The `bibliography` option makes the class load biblatex and read `references.bib`, so `\cite{key}` works and latexmk runs biber. Without the option no bibliography tool runs and `\mybibliography` prints nothing. The list is printed where `\mybibliography` (or `\printbibliography`, the same thing) is written: before `\end{document}` for a list across the page, or inside `multicols` for a list in the columns. With the option on and no list written, the build warns. Entries stay in English under a Greek main language.

## Commands

Every command has the form `\my<thing>[keys]{content}` and uses the same key names.

| Command | Content | Keys |
|---|---|---|
| `\myfigure` | image file in `graphics/` (subfolders in the name: `setup/photo.png`); several, comma-separated, side by side | `label`, `caption`, `subcaption`, `caption-align`, `hyphenate`, `width`, `height`, `place` |
| `\myplot` | pgfplots file in `plots/`; several, comma-separated, side by side | `label`, `caption`, `subcaption`, `caption-align`, `hyphenate`, `width`, `height`, `place` |
| `\mytable` | table file in `tables/` | `label`, `caption`, `caption-align`, `hyphenate`, `width`, `place` |
| `\myformula` | math; `&` aligns top-level rows and each `\\` row gets a number | `label`, `place` |
| `\myequation` | math, unnumbered | `place` |
| `\myreaction` | mhchem formula, numbered R1, R2… | `label`, `place` |
| `\mysection`, `\mysubsection`, `\mysubsubsection` | title | `label` |
| `\myreport` | none | `header`, `title`, `author`, `conducted`, `submitted`, `institution` |
| `\mythesis` | none | `title`, `subtitle`, `author`, `email`, `orcid`, `degree`, `supervisor`, `institution`, `place`, `date` |
| `\mylineskip`, `\mytoday` | none | none |
| `\mybibliography` | none | none |

Keys:

- `label`: the name `\myref` uses. Figures, plots and tables default to a kind prefix and their file name without the folder or the extension: `fig:photo` for `setup/photo.png`, `plot:absorbance`, `tab:yields`.
- `caption`: a figure, plot or table without one has no number. Text with a comma goes in braces: `caption={Mass, time and yield.}`.
- `subcaption`: for several files, the text under each one after its letter: `subcaption={Before, After}` gives (a) Before and (b) After. An item with a comma goes in braces: `subcaption={{Mass, time}, Yield}`. A missing or empty item shows only its letter; without `subcaption` there are no letters and no line for them.
- `width`: a length (`8cm`) or a fraction of the column (`0.5`); with several files, the width of each.
- `height`: a length.
- `caption-align`: `justify`, `center`, `left` or `right`; aligns this caption only. The setup keys `figure-caption-align`, `plot-caption-align` and `table-caption-align` set one kind, and `caption-align` every caption without its own.
- `hyphenate`: `true` or `false`; allows or stops hyphenation inside this caption, where `caption-hyphenate` sets every caption.
- `place`:
  - `here` (default): exactly where it is written. Written in the middle of a paragraph, a figure, plot, table, formula or reaction is set under the line it is written on, and the paragraph continues below it.
  - `float`: here if it fits in the rest of the column; otherwise the text after it fills the column and the block follows the first paragraph in the next column or page.
  - `span`: across all columns. The columns before it are balanced and reopened after it.
  - `wrap`, `wrap-left`: figures and plots in one column; the next paragraphs run beside the figure, on the right or the left. A heading, block or table that comes first ends the wrap with blank lines. A figure that would run past the page bottom waits for the next page.

In `\myformula`, top-level rows receive separate equation numbers, as in `align`. `\nonumber` leaves a row unnumbered. With `label=steps`, the numbered rows get `steps[1]`, `steps[2]`, and so on; an unnumbered row does not take an index. `\ref{steps[2]}` gives its bare number and `\myref{steps[2]}` gives its singular name and number. The base `\ref{steps}` lists all bare numbers, joined with “and” or “και”; `\myref{steps}` gives the plural equation name and links each number to its row. `\ref{steps[1], steps[2]}` also gives a linked bare-number list. A one-row formula keeps the singular form. A nested `aligned` or `alignedat` block counts as one top-level row.

Several files in `\myfigure` or `\myplot`, such as `\myfigure[caption={Two setups.}, subcaption={Before, After}]{before.png, after.png}`, are set in one row under one caption and one number, `sub-figure-gap` apart. Without `width`, each takes an equal share of the line; a figure given only `height` keeps that height, so the row has one height. The images share a bottom line and the subcaptions are centred under them. A row wider than the line is scaled to fit, with a warning when `width` or `height` was given. The default label comes from the first file. With a caption, the parts are `fig:x[1]`, `fig:x[2]`, and so on: `\myref{fig:x[2]}` gives “Figure 3b” in both languages, `\myref{fig:x[1], fig:x[2]}` “Figures 3a and 3b”, `\ref{fig:x[1]}` “3a”, and `\myref{fig:x}` the whole figure. `place=wrap` and `wrap-left` take one file; a row is placed here with a warning. More subcaptions than files, or a subcaption for one file, give a warning.

The title commands show only the keys given, centred. A value takes several lines with `\\`: `author={A. One \\ B. Two}`, `institution={University \\ Department}`. `\myreport` is the lab report cover (header, title, authors, dates, institution); `\mythesis` is the thesis cover (bold title, subtitle, author, an `EMAIL:` and `ORCID:` line, degree, supervisor, institution, then place and date; `date` is the current year when omitted). `\mytitle` was replaced by `\myreport`.

A key a command does not use gives a warning and is ignored. Removed from the old framework: `\mymath`, `\mychem`, `\mychemfig`, `\myquote`, `\mytext`, `\setdocpreset`, `\setdoclanguage`, `\togglebibliography`.

## References

| Written | Greek | English |
|---|---|---|
| `\myref{fig:photo}` | Σχήμα 1.1 | Figure 1 |
| `\myref{fig:photo, fig:setup}` | Σχήματα 1.1 και 1.2 | Figures 1 and 2 |
| `\myref{tab:yields}` | (στον) Πίνακα 1.1 | Table 1 |
| `\myref[nom]{tab:yields}` | (ο) Πίνακας 1.1 | Table 1 |
| `\myref{equilibrium}` | Σχέση 1.1 | Equation 1 |
| `\myref{steps}` for two rows | Σχέσεις 1.1 και 1.2 | Equations 1 and 2 |
| `\myref{steps[2]}` | Σχέση 1.2 | Equation 2 |
| `\myref{formation}` | Αντίδραση R1.1 | Reaction R1 |
| `\myref{tab:yields, formation}` | Πίνακα 1.1 και Αντίδραση R1.1 | Table 1 and Reaction R1 |
| `\myref[nom]{tab:yields, formation}` | Πίνακας 1.1 και Αντίδραση R1.1 | Table 1 and Reaction R1 |
| `\myref{intro}` | Ενότητα I | Section I |
| `\myref*{equilibrium}` | 1.1 | 1 |

Greek names are in the accusative, which is also the form after a genitive article ("στον Πίνακα", "του Πίνακα"); `[nom]` gives the nominative for the subject of a sentence ("ο Πίνακας"). Only "Πίνακας" changes form. A mixed list names each kind separately; it does not give a shared plural name. In Greek, use the mixed form where one case fits the whole list, such as `Βλέπε \myref{tab:yields, formation}`. When each item needs its own article or preposition, write two calls, such as `στον \myref{tab:yields} και στην \myref{formation}`. Each label also records its kind in the `.aux` file, so `\myref` knows which name to print. `\ref` accepts comma-separated labels and joins their linked bare numbers with “and” or “και”; one label keeps its normal LaTeX behavior. An undefined label remains `??` and produces a LaTeX warning. Every defined reference is a link in the PDF; headings appear as PDF bookmarks. `\label` and `\cite` work as in plain LaTeX.

## Tables

A table file holds its columns, header and rows in a `labtable` environment:

```latex
\begin{labtable}{l c c r}
    \tablehead{Sample & Mass (g) & Time (min) & Yield (\%)}
    A1 & 2.013 & 11 & 87.0 \\
    A2 & 2.026 & 12 & 94.0 \\
\end{labtable}
```

`labtable` exists only inside a file read by `\mytable`; written in the document it is an error that says so. The older form without the environment, `\tablecolumns{l c c r}` followed by the header and rows, still works. Columns are `l`, `c` or `r`, each with an optional width in brackets relative to the others: in `{l[0.6] c c[2]}` the last column is twice as wide as the middle one and the first 0.6 of it. With any width given, every column gets a fixed share of the table's width (a column without one counts as 1, and the gaps are 1 em) and text longer than its column wraps onto more lines, each a line of the grid; a single word or formula wider than its column runs over it, and TeX reports an overfull line at the table file's line. Without widths, columns take their natural width and the gaps between them grow to fill the table, or shrink to a quarter of 1 em when it is too wide. The rules are drawn by the class. `\tablerule` between two rows draws a thin rule like the one under the header, for summary rows such as the mean. Each row is its own line of text, so a long table breaks between rows across columns and pages, and its header row is repeated at the top of each new column or page. The caption stays with the table and never splits.

## Generated plots and tables

LabForge writes table files into `tables/` and plot files into `plots/` from spreadsheet ranges in the folder that holds the report file (older reports keep theirs in `data/`), from a function or from typed points (the Plots and Tables panes, or `table add` and `plot add` in the Terminal). They are ordinary `.tex` files for `\mytable` and `\myplot`, and build without LabForge. Three kinds of comment line let LabForge read them back:

```latex
% labforge plot {"kind":"plot","xlabel":"Time (s)","series":[{"type":"data","source":"data/runs.csv","x":"A","y":"B","hash":"61584f971751"}]}
\begin{tikzpicture}
  \begin{axis}[
    xlabel={Time (s)},
    grid=major,
  ]
    \addplot[mark=*] coordinates {
      % data 1: data/runs.csv, columns A and B
      (0,0)
      (1,2)
      % end of data 1
    };
    \addlegendentry{Measured}
  \end{axis}
\end{tikzpicture}
```

- The first line holds the settings the file was written from, as JSON. A file without it is treated as written by hand.
- Spreadsheet data sits between `% data` and `% end of data` lines (numbered in a plot, one per series). A plot range has x in its first column and a series in each further column; a first row that is not numbers names the series in the legend. Regenerate replaces only those lines and the settings line, so edits elsewhere in the file stay. Removing the markers stops regenerate for that file.
- The settings line keeps a short hash of each data file. A file whose data file changed or is missing is out of date; LabForge says so in Messages when the report opens and in the `plots` and `tables` listings. Regenerate is manual. The `.lfg` archive keeps no file dates, so a change is found by content, not by date.

Names are automatic: `plot_1.tex` and `table_1.tex`, or `<data file>_plot_1.tex` and `<data file>_table_1.tex` when the file reads a spreadsheet, counting up past names already taken. Rename them in Files.

Plot files are indented in steps of four spaces (LabForge uses the editor's tab size) and write their axis options one per line (`xlabel`, `ylabel`, `grid=major`, `xmode=log`, `ymode=log`); everything else comes from the class's `plot-*` settings below. Spreadsheet series and typed points are drawn with `mark=*`, functions with `domain=from:to, samples=100`. Table files are the format above; merged spreadsheet cells keep their text in the first cell, special characters are escaped, and with smart formatting on, formulas are written as `\ce{H2O}`, units as siunitx macros with `\per` (`\unit{\gram\per\mole}`, `\qty{3.2}{\milli\litre}`), scientific notation and uncertainties as `\num`, and symbols such as `T_max` as math; plain numbers and sample names keep their text. Width and height belong to the line in `main.tex`, not the file: `\myplot[width=0.8, height=6cm]{plot_1.tex}`.

## Settings

The class stores the baseline values below. `.settings.tex` defines styles with the same keys through `\labforgepreset{name}{...}`. The `default` style changes nothing, while `report` and `thesis` apply only the listed differences. A blank cell means the class baseline remains in effect.

| Key | Default | `report` | `thesis` |
|---|---|---|---|
| `margin` | 1in | 1in | 0.8in |
| `line-spread` | 1.5 | 1.6 | 1.15 |
| `indent` | 0.5in | 0.5in | 0.2in |
| `section-numbers` | true | true | false |
| `section-hang` | true | true | false |
| `section-center` | false | false | true |
| `number-depth` (1 to 4: n, S.n, S.SS.n, S.SS.SSS.n) | 2 | 2 | 1 |
| `paragraph-space` (lines) | 0 | | |
| `block-space` (lines around figures, plots, tables) | 0 | | |
| `block-gap` (extra lines between back-to-back blocks) | 0 | | |
| `sub-figure-gap` (space between figures or plots side by side) | 1.5em | | |
| `caption-gap` (lines from a figure or plot to its caption, from a table caption's baseline to the table) | 0.35 | | |
| `subcaption-gap` (lines from an image to its subcaption) | 0.25 | | |
| `caption-spread` (line spread inside captions, as a share of `line-spread`; never below single spacing) | 0.75 | | |
| `math-gap` (lines above and below a formula taller than a line; none above after a short line) | 0.25 | | |
| `block-snap` (`auto`, `line`, `half`, `off`: whether the space around blocks grows to keep the text on the grid; `auto` is `off` in one column and `line` in columns) | auto | | |
| `math-space` (lines around equations and reactions) | 0 | | |
| `plot-line-width` | 0.8pt | | |
| `plot-axis-width` (axes and ticks) | 0.5pt | | |
| `plot-tick-length` (minor ticks are half) | 4pt | | |
| `plot-minor-ticks` (between major ticks) | 1 | | |
| `plot-padding` (data to frame, a fraction of each axis range) | 0.06 | | |
| `plot-balance` (blank space on the right of a plot, as a fraction of the width of its y label and tick labels; 0 centres the whole picture, 1 centres the frame) | 0.5 | | |
| `plot-mark-size` | 2pt | | |
| `plot-grid` (`none`, `major`, `both`) | none | | |
| `plot-colors` (`black`, `color`) | black | | |
| `plot-legend` (a corner, set in by 4% like the data; any other pgfplots position is passed through) | north west | | |
| `caption-align` (`justify`, `center`, `left`, `right`) | justify | | |
| `figure-caption-align`, `plot-caption-align`, `table-caption-align` (the same choices, for one kind) | `caption-align` | | |
| `caption-hyphenate` (`true`, `false`) | true | | |
| `caption-color` | black | | |
| `caption-theme` (captions in the theme colour; wins over `caption-color`) | false | false | true |
| `theme-color` (hex, no `#`; a dark brown-red, midnight blue in `thesis`) | 451B13 | | 061027 |
| `main-font`, `math-font`, `mono-font` | Libertinus Serif, Libertinus Math, DejaVu Sans Mono | | |

Plot defaults (`plot default` in Terminal writes them as `\labforgesetup{plot-<key> = <value>}` in the preamble of `main.tex`) are applied to every pgfplots axis, so a plot file sets only what is specific to it and its own options win. Axes are boxed with ticks on all four sides pointing in, plus minor ticks and a small font for labels and legend. With `plot-colors=black` the first plots are black and solid, then dashed, dotted, dash-dotted, loosely dashed and densely dotted, so a plot reads in greyscale; `color` keeps pgfplots' own colours. To make a plot value part of a named style, set it inside that style's block in `.settings.tex`.

The default fonts ship with every TeX distribution, so a report looks the same on macOS and Windows: Libertinus (open licence, Greek and mathematics in one family) and DejaVu Sans Mono for code.
Math uses TeX letter style: uppercase Greek such as `\Delta` is upright, while lowercase Greek and Latin variables remain italic. Use `\itDelta` when an italic capital delta is intended.

## The line grid

All vertical space is whole lines, and the text block holds a whole number of lines. A figure, plot or side-by-side row is one block with its subcaptions and caption: they sit `caption-gap` and `subcaption-gap` lines below the image, at `caption-spread` times the line spread, and that spacing never changes. The space around a block is set by `block-snap`. Figures, plots and tables keep the white of an ordinary line break plus half a line above and below (from the baseline of the line before, to the capitals of the line after); formulas, equations and reactions add nothing and stand among the lines like a line of text, measured by their glyphs rather than amsmath's row struts. A formula taller than a line (a fraction, a root over a fraction) gets `math-gap` of a line below it, and above it unless the paragraph's last line ends before the formula starts (LaTeX's short display skip; known from the previous run), or a heading or block comes before it; there is none below it before a heading. With `off` the space is exactly that and the text goes on where the block ends. With `line` the space grows equally above and below, by at most a line, until the block fills whole lines, so the text after it stays on the grid and the lines of neighbouring columns stay level; `half` does the same in half lines. `auto` (the default) is `off` in one column and `line` in columns. Images and plots always keep the size written. A table moves as a whole with its caption, `caption-gap` and rules and follows the same rule; a table that breaks across columns or pages ends on the grid there and takes only whole steps under it. A block followed by a heading ends like a line of text (with `line`, it takes the space left over above it), so the heading's blank line is the only space before the heading, as after text. A heading is never left at the bottom of a page or column apart from a block that follows it directly or within its first two lines of text: the heading moves on with them. The lines beside a wrapped figure end once the next full line keeps the block space below it. Columns and pages are never stretched (`\raggedcolumns`, `\raggedbottom`). Table rows are one line high, which looks open at a line spread of 1.6.

## Positions from the previous run

The repeated table header, `place=float` and the page check of `place=wrap` use where things landed in the previous run, like references do. Rows, body paragraphs and floating blocks write their page and height on the page to the `.aux` file; latexmk reruns until those settle, usually in two or three runs.

## Open questions

1. Fonts: decided; Libertinus Serif and Math with DejaVu (changed from STIX Two on 2026-10-18) Sans Mono.
2. Table rows are one full line high to keep the grid; it looks open at a line spread of 1.6.
3. Done in phase C: completing `\myref` after ο, η or οι inserts `\myref[nom]{}`. Existing text is not rewritten.
4. Done in phase G: the table generator writes this table format (`source/engine/generators.ts`); generated files are described under Generated plots and tables.
5. A wrapped figure that waits for the next page can land just before a heading, leaving blank lines beside it.

## Packages and standard commands

Every report loads amsmath, chemfig, enumitem, fancyhdr, fontspec, footmisc, geometry, graphicx, hyperref, mhchem, microtype, multicol, pgfplots (with TikZ and its `calc` library), polyglossia, setspace, siunitx, unicode-math and xcolor, and biblatex with biber when the `bibliography` option is on. The Terminal command `latex packages` lists these and any literal `\usepackage` or `\RequirePackage` declarations in the preamble of `main.tex`. The latter are declarations, not a check that the local TeX distribution has installed them. Do not load the included packages again with `\usepackage`.

Besides the `\my…` commands, LabForge indexes LaTeX and package commands such as `\noindent`, `\textwidth`, `\hspace`, `\frac`, `\ce` and the siunitx `\qty{2.5}{\milli\mole\per\litre}`. It also indexes the optional booktabs rules when the report declares `\usepackage{booktabs}`. These commands complete in the editor after a letter or two, with every matching entry available in the scrollable list, and show their entry on hover. `latex <topic>` lists commands by topic, including `latex units` and `latex tables`; `latex <command>` shows one entry. Search commands matches names, descriptions, syntax, examples and package names across the active catalogue and inserts the selected command. Package commands absent from the catalogue are still listed by `latex packages` when declared, but have no completion or search entry until indexed.

siunitx uses reciprocal powers by default, so `\unit{\kilo\joule\per\mole\per\kelvin}` prints kJ mol⁻¹ K⁻¹. For a grouped denominator, use `\unit[per-mode=symbol]{\kilo\joule\per\mole\per\kelvin}` to print kJ/(mol K). The same unit expression goes in the second argument of `\qty{<number>}{<unit>}`. Put `\sisetup{per-mode=symbol}` in the preamble of `main.tex` to use slash notation throughout the report. The class leaves the reciprocal-power unit style unchanged, disables digit grouping (`\num{12345}` prints 12345), writes an uncertainty as given (`\num{12.5 \pm 0.3}` prints 12.5 ± 0.3, not 12.5(3)), and declares `\atm`, `\mmHg` and `\torr` for pressure. A report may override the number style with its own `\sisetup` and add units with `\DeclareSIUnit`.

## Your own commands

Define a command with `\newcommand` in the preamble of `main.tex`, above the main writing section:

```latex
% A bold vector, used as \vect{v}.
\newcommand{\vect}[1]{\mathbf{#1}}
```

The comment lines just above a definition are its description. `\newcommand`, `\renewcommand`, `\providecommand`, `\NewDocumentCommand` and `\DeclareMathOperator` are read (a definition inside a comment is not); the number of arguments gives the snippet's braces. A command defined there completes, shows its entry on hover, is listed by `latex custom` and in the toolbar's Custom commands menu, and the Plots and Tables previews read the preamble too, so a label may use it.

Three ways to add one: write it in the preamble (Custom commands › Go to preamble puts the cursor there), use Custom commands › New command… (name, number of arguments, description, body), or type `latex new <name> <arguments> <body>` in Terminal, for example `latex new vect 1 \mathbf{#1}`. The definition is added at the end of the preamble as one undoable edit. A name must be letters only and not already taken.
