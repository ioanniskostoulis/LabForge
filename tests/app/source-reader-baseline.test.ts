// Licensed under the GNU General Public License v2 or later. See LICENSE.
// Records what the editor's scanners produce today, so the shared source reader can replace them without changing any result.
// Run with UPDATE_BASELINE=1 to rewrite tests/fixtures/source-reader/baseline.json.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { EditorState } from "@codemirror/state";
import { ensureSyntaxTree } from "@codemirror/language";
import { latexFoldRange, latexLanguage } from "../../source/app/latex-editor";
import { proseWords } from "../../source/app/spell-check";
import { checkTex } from "../../source/app/tex-lint";
import { mathAtCursor } from "../../source/app/math-preview";
import { findFrameworkCommand, frameworkCommands, frameworkKeys } from "../../source/app/framework-commands";
import { texCommandNames } from "../../source/app/tex-names";

const fixtures = "tests/fixtures/source-reader";
const known = {
  isLatexCommand: (name: string) => texCommandNames.has(name) || !!findFrameworkCommand(name),
  suggestFrom: () => texCommandNames,
  isKnownCommand: (name: string) => !!findFrameworkCommand(name),
  commandKeys: (name: string) => frameworkCommands.find(command => command.name === name)?.keys,
  keyValues: (key: string) => frameworkKeys[key]?.values,
  commandArgument: (name: string) => /\{<([^>]+)>[^}]*\}/.exec(frameworkCommands.find(command => command.name === name)?.syntax ?? "")?.[1],
};

function sources(): [string, string][] {
  const files = ["assets/templates/report/main.tex", "assets/welcome.tex", ...readdirSync("tests/tex").filter(file => file.endsWith(".tex")).sort().map(file => `tests/tex/${file}`)];
  const inputs = JSON.parse(readFileSync(`${fixtures}/inputs.json`, "utf8")) as string[];
  return [...files.map(file => [file, readFileSync(file, "utf8")] as [string, string]), ...inputs.map((text, index) => [`input ${index}`, text] as [string, string])];
}

function tokens(text: string): string[] {
  const state = EditorState.create({ doc: text, extensions: [latexLanguage] });
  const kinds: string[] = [];
  ensureSyntaxTree(state, state.doc.length, 5000)!.iterate({ enter: node => { if (node.type.name && node.type.name !== "Document" && !node.type.isTop) kinds.push(`${node.from}-${node.to} ${node.type.name}`); } });
  return kinds;
}

/** Runs of cursor positions that give the same preview: `[first, last, from, to, tex]`. */
function math(text: string): (string | number)[][] {
  const runs: (string | number)[][] = [];
  for (let cursor = 0; cursor <= text.length; cursor++) {
    const range = mathAtCursor(text, cursor);
    if (!range) continue;
    const last = runs[runs.length - 1];
    if (last && last[1] === cursor - 1 && last[2] === range.from && last[3] === range.to && last[4] === range.tex) last[1] = cursor;
    else runs.push([cursor, cursor, range.from, range.to, range.tex]);
  }
  return runs;
}

function folds(text: string): string[] {
  const state = EditorState.create({ doc: text });
  const ranges: string[] = [];
  for (let number = 1; number <= state.doc.lines; number++) {
    const range = latexFoldRange(state, state.doc.line(number).from);
    if (range) ranges.push(`${number}: ${range.from}-${range.to}`);
  }
  return ranges;
}

function record(text: string) {
  return {
    tokens: tokens(text),
    prose: proseWords(text).map(word => `${word.from}-${word.to} ${word.word}`),
    lint: checkTex(text, known).map(problem => `${problem.from}-${problem.to} ${problem.message}`),
    math: math(text),
    folds: folds(text),
  };
}

test("highlighting, prose words, lint, math preview and folding match the recorded baseline", () => {
  const current = Object.fromEntries(sources().map(([name, text]) => [name, record(text)]));
  if (process.env.UPDATE_BASELINE) writeFileSync(`${fixtures}/baseline.json`, JSON.stringify(current, null, 1) + "\n");
  const baseline = JSON.parse(readFileSync(`${fixtures}/baseline.json`, "utf8"));
  for (const name of Object.keys(baseline)) assert.deepEqual(current[name], baseline[name], name);
  assert.deepEqual(Object.keys(current), Object.keys(baseline));
});
