// Licensed under the GNU General Public License v2 or later. See LICENSE.
// Rebuild and serve the browser preview, and open the desktop app on it with --desktop.
import electron from "electron";
import { startForgePreview } from "forge-shell/scripts/web";
import { startServer } from "forge-shell/scripts/serve";

await startForgePreview({
  productName: "LabForge",
  desktop: process.argv.includes("--desktop"),
  electronPath: electron,
  startServer,
  watchPaths: ["source", "assets", "documentation", "scripts", "public", "VERSION", "package.json", "tsconfig.json", "LICENSE", "NOTICE.md", "README.md", "CHANGELOG.md"],
});
