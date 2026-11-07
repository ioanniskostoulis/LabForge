// Licensed under the GNU General Public License v2 or later. See LICENSE.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { EditorState } from "@codemirror/state";
import { CompletionContext } from "@codemirror/autocomplete";
import { afterNominativeArticle, commandAt, findFrameworkCommand, frameworkCommands, frameworkKeys, keysContext, latexHelp, refSnippet } from "../../source/app/framework-commands";
import { texCompletions } from "../../source/app/latex-editor";

const complete = (doc: string, explicit = false) => texCompletions(new CompletionContext(EditorState.create({ doc, selection: { anchor: doc.length } }), doc.length, explicit));

test("every catalogue command is in FRAMEWORK.md and uses keys from the shared list", () => {
  const framework = readFileSync("documentation/FRAMEWORK.md", "utf8");
  for (const command of frameworkCommands) {
    assert.ok(framework.includes(`\\${command.name}`), command.name);
    for (const key of command.keys) assert.ok(frameworkKeys[key], `${command.name}: ${key}`);
    assert.ok(command.syntax.startsWith(`\\${command.name}`), command.name);
    assert.ok(command.example.startsWith(`\\${command.name}`), command.name);
  }
});

test("lookup accepts a backslash and falls back from a starred name", () => {
  assert.equal(findFrameworkCommand("\\myfigure")?.name, "myfigure");
  assert.equal(findFrameworkCommand("\\mygraphics"), undefined);
  assert.equal(findFrameworkCommand("myref*")?.name, "myref*");
  assert.equal(findFrameworkCommand("mytable*")?.name, "mytable");
  assert.equal(findFrameworkCommand("unknown"), undefined);
});

test("the hover finds the command under the pointer", () => {
  assert.equal(commandAt("See \\myfigure[width=1]{a}", 6)?.command.name, "myfigure");
  assert.equal(commandAt("See \\myref*{x}", 8)?.command.name, "myref*");
  // A standard command has an entry too; one that is in no list has none.
  assert.equal(commandAt("See \\textbf{x}", 6)?.command.name, "textbf");
  assert.equal(commandAt("See \\nosuchcommand{x}", 6), null);
  assert.equal(commandAt("See \\myfigure{a}", 1), null);
});

test("the latex verb lists commands and shows one entry", () => {
  assert.equal(latexHelp("")!.length, frameworkCommands.length + 2);
  const entry = latexHelp("\\mytable")!.map(line => typeof line === "string" ? line : `${line.indent ?? 0}|${line.label}`);
  assert.equal(entry[0], "0|\\mytable[<keys>]{<file>}");
  assert.ok(entry.includes("1|place"));
  assert.equal(entry.at(-1), "0|Example");
  assert.equal(latexHelp("nothing"), null);
});

test("completion offers framework commands first and key names inside brackets", () => {
  assert.deepEqual(complete("\\mys")!.options.map(option => option.label), ["\\mysection{}", "\\mysubsection{}", "\\mysubsubsection{}"]);
  const keys = complete("\\myfigure[ca")!;
  assert.deepEqual(keys.options.map(option => option.label), ["caption", "caption-align"]);
  assert.equal(keys.from, "\\myfigure[".length);
  assert.ok(!complete("\\myfigure[caption=x, ", true)!.options.some(option => option.label === "caption"));
  assert.deepEqual(complete("\\myplot[place=w")!.options.map(option => option.label), ["wrap", "wrap-left"]);
  assert.equal(complete("\\mylineskip[x"), null);
  assert.equal(keysContext("\\myfigure[caption={a, b}, wi")?.typed, "wi");
});

test("my… commands are offered without the backslash from three letters", () => {
  assert.deepEqual(complete("mypl")!.options.map(option => option.label), ["\\myplot{}"]);
  assert.equal(complete("mypl")!.from, 0);
  assert.ok(complete("Text mys")!.options.length >= 3);
  assert.equal(complete("my"), null);
  assert.equal(complete("myself"), null);
  assert.equal(complete("amypl"), null);
  assert.equal(complete("% mypl"), null);
  assert.equal(complete("\\mypl")!.from, 0);
  assert.equal(complete("mylineskip"), null);
});

test("a nominative article before \\myref chooses [nom]", () => {
  assert.ok(afterNominativeArticle("Όπως φαίνεται, ο "));
  assert.ok(afterNominativeArticle("Ο"));
  assert.ok(afterNominativeArticle("ή "));
  assert.ok(!afterNominativeArticle("στον "));
  assert.ok(!afterNominativeArticle("του "));
  assert.ok(!afterNominativeArticle("mo "));
  assert.equal(refSnippet("ο "), "myref[nom]{}");
  assert.equal(refSnippet("στον "), "myref{}");
  assert.ok(complete("ο \\myre")!.options.some(option => option.label === "\\myref[nom]{}"));
  assert.ok(complete("στον \\myre")!.options.some(option => option.label === "\\myref{}"));
});
