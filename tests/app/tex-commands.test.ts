// Licensed under the GNU General Public License v2 or later. See LICENSE.
import test from "node:test";
import assert from "node:assert/strict";
import { commandCategories, commandDefinition, commandProblem, parseCustomCommands, preloadedPackages, standardCommands } from "../../source/app/tex-commands";
import { findFrameworkCommand, latexHelp, setCustomCommands } from "../../source/app/framework-commands";
import { searchCommands } from "../../source/app/insert-tools";

test("the standard commands are listed once each, by topic, with a snippet and a description", () => {
  const names = standardCommands.map(command => command.name);
  assert.equal(new Set(names).size, names.length, "a name is listed twice");
  for (const command of standardCommands) {
    assert.ok(command.description && command.package, command.name);
    assert.ok((commandCategories as readonly string[]).includes(command.category), command.name);
  }
  for (const name of ["noindent", "columnwidth", "textwidth", "linewidth", "hspace", "frac", "ce", "textcolor"]) assert.ok(findFrameworkCommand(name), name);
  assert.equal(findFrameworkCommand("\\frac")!.snippet, "frac{}{}");
  assert.equal(findFrameworkCommand("noindent")!.snippet, "noindent");
});

test("latex lists topics, packages and one entry from any source", () => {
  const text = (lines: ReturnType<typeof latexHelp>) => lines!.map(line => typeof line === "string" ? line : `${line.label} ${line.comment}`).join("\n");
  assert.match(text(latexHelp("")), /latex <topic> lists more: structure, lengths, spacing/);
  assert.match(text(latexHelp("lengths")), /columnwidth/);
  assert.match(text(latexHelp("packages")), /amsmath/);
  assert.match(text(latexHelp("\\textwidth")), /From LaTeX/);
  assert.equal(latexHelp("nonsense"), null);
  assert.ok(preloadedPackages.length >= 15);
});

test("a report's own commands are read with their comments and argument counts", () => {
  const text = [
    "% A bold vector.", "\\newcommand{\\vect}[1]{\\mathbf{#1}}", "",
    "% Mean value", "% over a run.", "\\DeclareMathOperator{\\mean}{mean}", "\\providecommand\\unit[2]{#1\\,#2}",
    "\\NewDocumentCommand{\\pair}{m m}{(#1, #2)}", "\\newcommand{\\plain}{text}",
    "% A pressure unit.", "\\DeclareSIUnit{\\atmosphere}{atm}",
  ].join("\n");
  const found = parseCustomCommands(text);
  assert.deepEqual(found.map(command => [command.name, command.snippet, command.description]), [
    ["vect", "vect{}", "A bold vector."], ["mean", "mean", "Mean value over a run."], ["unit", "unit{}{}", "A command of this report"],
    ["pair", "pair{}{}", "A command of this report"], ["plain", "plain", "A command of this report"],
    ["atmosphere", "atmosphere", "A pressure unit."],
  ]);
  assert.equal(found[0].syntax, "\\vect{<#1>}");
  setCustomCommands(found);
  assert.equal(findFrameworkCommand("\\vect")!.description, "A bold vector.");
  assert.ok(searchCommands("vect", [], found).some(hit => hit.label === "\\vect" && hit.category === "Custom" && hit.id === "custom:vect"));
  assert.ok(searchCommands("column").some(hit => hit.label === "\\columnwidth"));
  assert.ok(findFrameworkCommand("DeclareSIUnit"));
  assert.ok(findFrameworkCommand("newcommand"));
  setCustomCommands([]);
});

test("a definition inside a comment is not a command", () => {
  const text = "% Example: \\newcommand{\\vect}[1]{\\mathbf{#1}}\n\\newcommand{\\real}{x} % \\newcommand{\\no}{y}\n";
  assert.deepEqual(parseCustomCommands(text).map(command => command.name), ["real"]);
});

test("a new command is checked and written as a commented \\newcommand", () => {
  const taken = (name: string) => name === "frac";
  assert.equal(commandProblem("vect", "1", "\\mathbf{#1}", taken), null);
  assert.match(commandProblem("v3ct", "1", "x", taken)!, /letters only/);
  assert.match(commandProblem("frac", "0", "x", taken)!, /already exists/);
  assert.match(commandProblem("a", "x", "x", taken)!, /number from 0 to 9/);
  assert.match(commandProblem("a", "1", "  ", taken)!, /what the command does/);
  assert.match(commandProblem("a", "1", "#2", taken)!, /uses #2/);
  assert.match(commandProblem("a", "0", "{x", taken)!, /braces/);
  assert.equal(commandDefinition("vect", 1, " \\mathbf{#1} ", "A bold vector."), "% A bold vector.\n\\newcommand{\\vect}[1]{\\mathbf{#1}}\n");
  assert.equal(commandDefinition("plain", 0, "text", ""), "\\newcommand{\\plain}{text}\n");
});
