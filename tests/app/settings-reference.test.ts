// Licensed under the GNU General Public License v2 or later. See LICENSE.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { classOptionRows, settingRows } from "../../source/app/settings-reference";
import { fontSizes, languages, presets } from "../../source/app/document-class";

const cls = readFileSync("assets/framework/labforge.cls", "utf8");

test("the reference lists every \\labforgesetup key of the class, once", () => {
  const block = cls.slice(cls.indexOf("\\keys_define:nn { labforge / setup }"), cls.indexOf("\\NewDocumentCommand \\labforgesetup"));
  const keys = [...block.matchAll(/^\s+([a-z-]+)\s+\.(?:tl|int|bool|dim|choices)/gm)].map(match => match[1]);
  assert.deepEqual([...settingRows.map(row => row.key)].sort(), [...keys].sort());
  assert.equal(new Set(settingRows.map(row => row.key)).size, settingRows.length);
});

test("the reference's defaults are the class baseline values", () => {
  const start = cls.indexOf("% The class owns the baseline.");
  const body = cls.slice(start, cls.indexOf("\\bool_new:N \\l_lf_preset_found_bool", start));
  const values = new Map([...body.matchAll(/([a-z-]+)\s*=\s*([^,\n]*)/g)].map(match => [match[1], match[2].trim().replaceAll("~", " ")]));
  for (const row of settingRows) {
    if (!values.has(row.key)) continue;
    const value = values.get(row.key)!;
    if (value) assert.equal(row.initial, value, row.key);
  }
  assert.ok(values.size >= 25);
});

test("the class options in the reference match the Builder's choices", () => {
  const takes = (key: string) => classOptionRows.find(row => row.key === key)!.takes;
  for (const preset of presets) assert.ok(takes("preset").includes(preset), preset);
  for (const language of languages) assert.ok(takes("language").includes(language), language);
  for (const size of fontSizes) assert.ok(takes("fontsize").includes(size), size);
});

test("settings.tex declares an empty default style and only changed values in the others", () => {
  const settings = readFileSync("assets/templates/report/settings.tex", "utf8");
  assert.match(settings, /\\labforgepreset\{default\}\{\}/);
  assert.match(settings, /\\labforgepreset\{report\}\{[\s\S]*?line-spread = 1\.6/);
  assert.match(settings, /\\labforgepreset\{thesis\}\{[\s\S]*?section-center = true/);
  assert.doesNotMatch(readFileSync("assets/templates/report/main.tex", "utf8"), /\\input/);
  assert.match(cls, /\\IfFileExists\{settings\.tex\}\{\\input\{settings\.tex\}\}/);
});
