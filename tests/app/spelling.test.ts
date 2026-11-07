// Licensed under the GNU General Public License v2 or later. See LICENSE.
import test from "node:test";
import assert from "node:assert/strict";
import { createSpellingEngine, spellingLanguage } from "../../source/desktop/spelling";

test("the dictionaries in assets check English and Greek words by alphabet", () => {
  const engine = createSpellingEngine("assets/spelling");
  assert.equal(spellingLanguage("μέτρηση"), "el");
  assert.equal(spellingLanguage("measured"), "en");
  assert.deepEqual(engine.misspelled(["The", "measured", "oscilloscope", "recieve", "μέτρηση", "λανθασμένη", "μέτριση", "XRD", "ΑΠΘ"]), ["recieve", "μέτριση"]);
  assert.equal(engine.suggest("recieve")[0], "receive");
  assert.equal(engine.suggest("wrod")[0], "word");
  assert.ok(engine.suggest("λανθασμενη").includes("λανθασμένη"));
});

test("accepted words count in either case and in both languages", () => {
  const engine = createSpellingEngine("assets/spelling");
  engine.accept(["dawdawd", "Κοστούλης"]);
  assert.deepEqual(engine.misspelled(["dawdawd", "Dawdawd", "Κοστούλης", "wrod"]), ["wrod"]);
});
