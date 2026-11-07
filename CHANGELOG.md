# Changelog

## 2.7.1

- Opens a report dropped on the window from Finder or File Explorer; files dropped on the file tree are still added to the report, and a file that is not a report is named in Messages.
- Shows a status at the right of every file in the inspector's tree, editable or read-only, and no longer on the header of a supporting file beside the editor.
- Updates the shared Forge frame to forge-shell 3.1.1: chips drawn as a button group, a legible label on a disabled primary button, a focus ring on the panel buttons and the tool flyout with its tools' names.

## 2.7.0

- Writes LaTeX reports on macOS and Windows: each report is one `.lfg` package holding `main.tex` and its files, edited in place, with a CodeMirror editor for the code and a PDF preview beside it. The tools help to write `.tex` code; there are no word-processor formatting buttons.
- Builds the PDF with an installed TeX distribution (`latexmk`, `biber` and XeLaTeX or LuaLaTeX), keeps the last good PDF after a failed build, and lists TeX errors and warnings in Messages with the file and line they come from. At launch LabForge checks for these tools and links to the download page when one is missing.
- Provides the `labforge` report class, which every new report uses and LabForge keeps current: titles, sections, figures, plots, tables, formulas and chemical reactions, with presets defined in `.settings.tex`, a Greek or English report language, block spacing that keeps the text on its grid, side-by-side figures with subcaptions and references such as `\myref{fig:x[2]}`.
- Makes plots and tables from spreadsheets and CSV files in the Plots and Tables panes, with options beside the code and a live preview; tables convert formulas, ions, units and uncertainties to `\ce`, siunitx macros and math where they are certain, and both can be regenerated when their data change.
- Helps while writing: completion of commands, labels, citations and file names, a hover entry for every report command, source checks, Greek and English spell checking with a personal dictionary, a formula preview, folding, Find and replace in every text view, Rename label, a reference check after Save and after a build, and Cmd-click (Ctrl-click on Windows) from a reference to its label and between the PDF and its source line.
- Lets each editor option be switched on or off (word wrap, minimap, bracket colours, caret blink and glide, line highlight, tab size, trimming whitespace on save), in View › Editor or in the Terminal, kept for every report.
- Lists the report's files in the inspector as a tree with the commands of Finder and File Explorer, and opens supporting files such as `references.bib` beside the editor with an unsaved mark.
- Shares its frame with the other Forge apps: menus with the same labels and keys (Fit on Cmd + 0 and Actual size on Cmd + 1 in every app; Actual size sets the editor's text size here), document tabs that can be dragged to a new order, the inspector, a Terminal with the shared commands (`new`, `open`, `recent`, `save`, `close`, `undo`, `redo`, `zoom`, `panel`, `inspector`, `theme`, `font`, `about`, `changes`, `shortcuts`, `licenses`, `updates`) beside LabForge's own, Messages, Dark and Light.
- Checks for updates from Help › Check for updates…; on the desktop **Update and restart** downloads the new release, checks it and installs it. At most once a day at launch a newer release is noted in Messages.
- Keeps the last ten reports in File › Open recent and in the system's recent documents.
- Moved Build PDF to Shift + Cmd + B (Ctrl + Shift + B on Windows); while a build runs, the same key cancels it. Wrap text is Shift + Cmd + W and Replace… is Option + Cmd + F on macOS and Ctrl + H on Windows.
- Exports a report as a single ZIP file, and converts older ZIP `.lfg` files when they are opened.
- The macOS disk image is not signed by Apple: open LabForge with a right click and Open the first time.
