// Licensed under the GNU General Public License v2 or later. See LICENSE.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { classDefaults, classLineChange, presetNames, presetValues, readClassOptions } from "../../source/app/document-class";

const apply = (text: string, change: ReturnType<typeof classLineChange>): string =>
  change ? text.slice(0, change.from) + change.insert + text.slice(change.to) : text;

test("the class line's options are read, with the class defaults for options left out", () => {
  assert.deepEqual(readClassOptions(readFileSync("assets/templates/report/main.tex", "utf8")),
    { preset: "default", language: "greek", fontsize: "10pt", bibliography: false });
  assert.deepEqual(readClassOptions("\\documentclass{labforge}\n"), classDefaults);
  assert.deepEqual(readClassOptions("\\documentclass{.labforge}\n"), classDefaults);
  assert.deepEqual(readClassOptions("\\documentclass[ language = english , bibliography=false ]{labforge}"),
    { ...classDefaults, language: "english", bibliography: false });
  assert.equal(readClassOptions("\\documentclass{article}\n"), null);
  assert.equal(readClassOptions("% \\documentclass{labforge}\n\\documentclass{article}\n"), null);
});

test("changing an option rewrites only the class line and keeps other options in order", () => {
  const text = "% top\n\\documentclass[preset=report, fontsize=11pt, language=greek, bibliography]{labforge}\n\\begin{document}\n";
  assert.equal(apply(text, classLineChange(text, { preset: "thesis" })),
    "% top\n\\documentclass[preset=thesis, fontsize=11pt, language=greek, bibliography]{labforge}\n\\begin{document}\n");
  assert.equal(apply(text, classLineChange(text, { language: "english", bibliography: false })),
    "% top\n\\documentclass[preset=report, fontsize=11pt, language=english]{labforge}\n\\begin{document}\n");
  assert.equal(classLineChange(text, { preset: "report", bibliography: true }), null);
  assert.equal(apply("\\documentclass{labforge}", classLineChange("\\documentclass{labforge}", { language: "greek" })), "\\documentclass{labforge}");
  assert.equal(apply("\\documentclass{labforge}", classLineChange("\\documentclass{labforge}", { language: "english", bibliography: true })),
    "\\documentclass[language=english, bibliography]{labforge}");
  assert.equal(apply("\\documentclass[bibliography]{labforge}", classLineChange("\\documentclass[bibliography]{labforge}", { bibliography: false })),
    "\\documentclass{labforge}");
  assert.equal(classLineChange("\\documentclass{article}", { preset: "thesis" }), null);
  assert.equal(apply("\\documentclass{.labforge}", classLineChange("\\documentclass{.labforge}", { preset: "poster" })),
    "\\documentclass[preset=poster]{.labforge}");
});

test("font size is read and written like the other options", () => {
  assert.equal(readClassOptions("\\documentclass[fontsize=12pt]{labforge}")?.fontsize, "12pt");
  assert.equal(apply("\\documentclass{labforge}", classLineChange("\\documentclass{labforge}", { fontsize: "11pt" })), "\\documentclass[fontsize=11pt]{labforge}");
  assert.equal(apply("\\documentclass[fontsize=11pt]{labforge}", classLineChange("\\documentclass[fontsize=11pt]{labforge}", { fontsize: "12pt" })), "\\documentclass[fontsize=12pt]{labforge}");
});

test("style names come from uncommented settings.tex declarations", () => {
  assert.deepEqual(presetNames(readFileSync("assets/templates/report/settings.tex", "utf8")), ["default", "report", "thesis"]);
  assert.deepEqual(presetNames("% \\labforgepreset{ignored}{}\n\\labforgepreset{poster}{margin=2cm}\n\\labforgepreset{poster}{}"), ["default", "poster"]);
  assert.equal(presetValues("\\labforgepreset{poster}{margin=2cm, caption-color={blue}}", "poster"), "margin=2cm, caption-color={blue}");
});
