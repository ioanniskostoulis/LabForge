// Licensed under the GNU General Public License v2 or later. See LICENSE.
// Generate the desktop package configuration from the shared Forge defaults and this app's profile.
import { readFileSync, writeFileSync } from "node:fs";
import { electronBuilderConfig } from "forge-shell/scripts/package-config";
import { renderDmgBackground } from "forge-shell/scripts/dmg-background";

const config = JSON.parse(readFileSync("forge.config.json", "utf8"));
const builder = electronBuilderConfig(config);
// A .lfg is a folder; the shell's association does not say so, and without it Finder shows an ordinary folder.
for (const association of builder.fileAssociations ?? []) association.isPackage = true;
if (process.platform === "darwin") builder.mac.extraResources.push({ from: "build/native/mac-input-source.node", to: "native/mac-input-source.node" });
if (process.platform === "win32") (builder.win.extraResources ??= []).push({ from: "build/native/win-input-source.node", to: "native/win-input-source.node" });
writeFileSync("build/electron-builder.json", `${JSON.stringify(builder, null, 2)}\n`);
// The macOS disk image window is drawn from the profile; only a macOS package uses it.
if (process.platform === "darwin") renderDmgBackground();
