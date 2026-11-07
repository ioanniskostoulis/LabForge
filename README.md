# LabForge

LabForge is a desktop workspace for writing LaTeX reports on macOS and Windows. It combines a CodeMirror editor for `main.tex`, a PDF preview, project files, generators for plots and tables, a Terminal and a Messages log. It follows the principle that what is coded is what is obtained: the tools help to write `.tex` code, and no formatting buttons exist.

## Report project

A report is one `.lfg` folder, shown as one file in Finder, edited in place. File › Export as ZIP makes a single file of it, and older ZIP `.lfg` files convert when they are opened.

| Content | Role |
|---|---|
| `main.tex` | The report, edited in the centre view |
| `labforge.cls` | The report class; LabForge keeps the copy current |
| `.latexmkrc` | Sends LaTeX intermediates to the hidden `.build/` folder |
| `data/`, `graphics/`, `plots/`, `tables/` | Spreadsheets and references, images, generated plots, generated tables |

The report builds with `latexmk main.tex` on any computer that has a TeX distribution, with or without LabForge.

## Requirements

LabForge does not bundle TeX. PDF builds need `latexmk`, `biber` and the engine of the report (XeLaTeX or LuaLaTeX) from a distribution such as MacTeX or MiKTeX. At launch, LabForge checks for these tools and, when one is missing, warns in Messages and links to the download page. Editing and saving do not need TeX.

## Commands

| Command | Purpose |
|---|---|
| `npm install` | Installs the dependencies and the version hook |
| `npm start` | Builds and runs the desktop application |
| `npm run web` | Serves the browser preview on `http://127.0.0.1:4185/` |
| `npm run checks` | Runs the typecheck, the engine tests, the interface tests and the shell check |
| `npm run dist` | Packages the macOS disk image; on Windows, the unpacked application and the setup |

The browser preview has no file access, so Save, Build and opening files need the desktop application.

## Documents

| File | Content |
|---|---|
| `documentation/INTERFACE.md` | The product and interface profile |
| `documentation/FRAMEWORK.md` | The report class and its commands |
| `documentation/DEVELOPMENT.md` | Running, testing and releasing |
| `CHANGELOG.md` | The changes of each version |
| `NOTICE.md` | Credits and third-party work |

The shared interface code is the `forge-shell` package, pinned as the archive in `source/`. LabForge is licensed under GPL-2.0-or-later (`LICENSE`).
