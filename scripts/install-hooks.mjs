// Licensed under the GNU General Public License v2 or later. See LICENSE.
// Install the local Git hook used by GitHub Desktop and command-line commits.
import { installVersionHook } from "forge-shell/scripts/version-hook";

installVersionHook({ marker: "# LabForge automatic patch version hook" });
