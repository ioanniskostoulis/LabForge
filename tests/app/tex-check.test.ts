// Licensed under the GNU General Public License v2 or later. See LICENSE.
import test from "node:test";
import assert from "node:assert/strict";
import { checkTex, isTexDownload, requiredTools } from "../../source/engine/tex-check";

test("a complete toolchain gives no warning", async () => {
  const result = await checkTex("xelatex", "darwin", async () => true);
  assert.deepEqual(result, { ok: true, missing: [], message: "", url: "" });
});

test("missing tools are named with the download address for the platform", async () => {
  const mac = await checkTex("xelatex", "darwin", async tool => tool === "biber");
  assert.equal(mac.ok, false);
  assert.deepEqual(mac.missing, ["latexmk", "xelatex"]);
  assert.match(mac.message, /missing: latexmk, xelatex/);
  assert.match(mac.message, /tug\.org\/mactex/);
  const win = await checkTex("xelatex", "win32", async () => false);
  assert.match(win.message, /miktex\.org/);
});

test("the builder chosen for the report decides which engine is required", () => {
  assert.deepEqual(requiredTools("lualatex"), ["latexmk", "lualatex", "biber"]);
});

test("only the TeX download pages may be opened", async () => {
  const result = await checkTex("xelatex", "win32", async () => false);
  assert.equal(isTexDownload(result.url), true);
  assert.equal(isTexDownload("https://example.com/"), false);
  assert.equal(isTexDownload("file:///etc/passwd"), false);
});
