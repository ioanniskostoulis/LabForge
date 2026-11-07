// Licensed under the GNU General Public License v2 or later. See LICENSE.
// Package the Windows desktop payload with the installer supplied by the pinned Forge shell.
import { buildInstaller } from "forge-shell/scripts/build-installer";

const result = await buildInstaller({ stageOnly: process.argv.includes("--stage-only") });
console.log(`LabForge setup staged: ${result.manifest.files.length} files, ${result.manifest.bytes} bytes.`);
