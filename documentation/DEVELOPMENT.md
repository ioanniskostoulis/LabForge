# Development

The shared rules are in the `documentation/` folder of the pinned `forge-shell` (`GUIDELINES.md`, `UPDATING.md`, `INSTALLER.md`). This document records what belongs to LabForge.

## Commands

| Command | Action |
|---|---|
| `npm install` | Installs the dependencies and, through `prepare`, the version hook |
| `npm run build` | Builds the renderer, the Electron main process, the preload script and the engine into `build/` |
| `npm run check` | Typechecks the project |
| `npm test` | Builds, then runs the engine tests (`tests/engine`) |
| `npm run test:app` | Runs the interface and project tests (`tests/app`) and the conformance tests of the pinned shell |
| `npm run test:shell` | Builds, then runs `forge-shell check-app` against the profile and the page |
| `npm run checks` | Runs the four commands above |
| `npm run web` | Builds and serves the browser preview on `http://127.0.0.1:4185/`; `PORT` changes the port; rebuilds on change |
| `npm run dev` | The same watcher with an Electron window |
| `npm start` | Builds and runs the desktop application |
| `npm run dist` | Packages the macOS disk image; on Windows, the unpacked application and the Forge setup |
| `npm run icon:document` | Regenerates the `.lfg` document icons from `assets/icon.png` and the profile |
| `node scripts/check-release.mjs [--mac\|--win]` | Checks the release source, the pins, the versions and the packaged notices |

`FORGE_STYLE_LINT=error` turns the warnings of the style lint into errors.

## Browser preview

The preview runs the renderer, styles and shell components of the desktop application. It has no file access. `browserAdapter()` in `source/app/main.ts` answers instead: a new report is a temporary sample, and Save, Build, Open, Show in Finder, the plot and table commands and the data files of Plots and Tables answer that they need the desktop application. Builds, previews, PDF output and archive behaviour are checked in the desktop application. Appending `?tex-missing` to the address shows the warning for missing TeX tools.

## TeX

PDF builds need `latexmk`, `biber` and XeLaTeX or LuaLaTeX; on macOS they are searched in `/Library/TeX/texbin`, `/opt/homebrew/bin` and `/usr/local/bin`, then in `PATH`. The class tests in `tests/engine` skip themselves without them. The default fonts (Libertinus and DejaVu Sans Mono) come with TeX Live and MiKTeX. LabForge does not bundle TeX.

## Releases

| Subject | Rule |
|---|---|
| Version | `VERSION` is edited by hand. The pre-commit hook copies it to `package.json` and `package-lock.json` when it changed, and otherwise raises the patch version by one. |
| Changelog | `CHANGELOG.md` holds a `## <VERSION>` section for the current `VERSION`; the release notes are that section. |
| Workflows | Four workflows in `.github/workflows/`, written by `forge-shell workflows` from the pinned shell and not edited by hand: Build desktop apps (pushes to `main`, version tags, by hand), Build for mac, Build for windows and Clear all. |
| Files | `LabForge-v<version>.dmg` and `LabForge-v<version>.exe`, published to the release `v<version>` after the Linux checks and the builds succeed. |
| Shell update | The archive is pinned in `source/`, the shell changelog is read, the checks run following `UPDATING.md` of the shell. |
| Windows | Verified by the automated build, installer check and launch screenshot; not tested by hand. |
