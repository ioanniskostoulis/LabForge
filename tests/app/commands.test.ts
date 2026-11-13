// Licensed under the GNU General Public License v2 or later. See LICENSE.
import test from "node:test";
import assert from "node:assert/strict";
import { checkCommandSyntax, commandHelp, generalHelp, helpAlias, invalidUsage } from "forge-shell/app/command-help";
import { availableOnWelcome, commands, findCommand, helpCatalog, shared } from "../../source/app/commands";

test("every command syntax follows the shell's help notation", () => {
  const problems = commands.flatMap(command => [command.syntax, ...(command.subcommands ?? []).map(form => form.syntax)].flatMap(checkCommandSyntax));
  assert.deepEqual(problems, []);
});

test("descriptions are short imperative fragments without a final period", () => {
  for (const command of commands) for (const text of [command.description, ...(command.subcommands ?? []).map(form => form.description)]) {
    assert.match(text, /^[A-Z][^.]*[^.]$/, `${command.name}: ${text}`);
    // The shell words its shared commands; the length rule is LabForge's own.
    if (!shared.some(item => item.spec.name === command.name)) assert.ok(text.length <= 70, `${command.name}: ${text}`);
  }
});

test("each example is accepted by its command's argument pattern", () => {
  for (const command of commands) if (command.example) {
    const [verb, ...rest] = command.example.split(" ");
    assert.equal(verb, command.name);
    assert.ok(command.args.test(rest.join(" ")), command.example);
  }
});

test("every command is in exactly one help group, and the welcome set is real commands", () => {
  const grouped = helpCatalog.groups.flatMap(([, names]) => [...names]);
  assert.deepEqual([...grouped].sort(), commands.map(command => command.name).sort());
  for (const name of availableOnWelcome) assert.ok(findCommand(name), name);
});

test("the welcome overview lists only welcome commands, in File, View, Editor, Help, Console order", () => {
  const overview = generalHelp(true, helpCatalog);
  assert.equal(overview.lines?.[0], "help <command> for details. <value> required; [value] optional.");
  assert.deepEqual(overview.groups?.map(group => group.title), ["File", "View", "Editor", "Help", "Console"]);
  const listed = overview.groups!.flatMap(group => group.items.map(item => item.label));
  assert.ok(!listed.includes("save") && !listed.includes("build") && !listed.includes("pdf"));
  assert.deepEqual(generalHelp(false, helpCatalog).groups?.map(group => group.title), ["File", "Edit", "View", "Editor", "Document", "Help", "Plots and tables", "Console"]);
});

test("details, usage errors and aliases use the catalogue", () => {
  const editor = commandHelp("editor", false, helpCatalog).lines!.map(line => typeof line === "string" ? line : `${line.indent ?? 0}|${line.label}|${line.comment}`);
  assert.equal(editor[0], "0|editor|List editor options and their states");
  assert.ok(editor.includes("1|minimap|Minimap"));
  assert.equal(editor.at(-1), "0|Example|editor minimap on");
  assert.deepEqual(commandHelp("build", true, helpCatalog).lines, ["Open a report project first."]);
  const usage = invalidUsage(findCommand("panel")!).lines!;
  assert.equal(usage[0], "Invalid arguments. Usage:");
  assert.equal(usage.at(-1), "Type help panel for details.");
  assert.equal(helpAlias("files -h"), "help files");
  assert.equal(helpAlias("--help"), "help");
});

test("each editor option is a command of its own, with the old editor form kept", () => {
  for (const name of ["wrap", "minimap", "trimsave", "tabsize", "brackets", "caret", "highlight", "hidden"]) assert.ok(findCommand(name), name);
  assert.ok(findCommand("wrap")!.args.test("off") && !findCommand("wrap")!.args.test("maybe"));
  assert.ok(findCommand("tabsize")!.args.test("2") && !findCommand("tabsize")!.args.test("3"));
  assert.ok(findCommand("editor")!.args.test("wrap off") && findCommand("editor")!.args.test("brackets dimmed on"));
  assert.ok(findCommand("brackets")!.args.test("dimmed on") && findCommand("brackets")!.args.test("") && !findCommand("brackets")!.args.test("style grey"));
  assert.ok(findCommand("caret")!.args.test("blink off") && !findCommand("autoclose") && !findCommand("smoothblink"));
  assert.ok(availableOnWelcome.has("wrap") && availableOnWelcome.has("hidden"));
});

test("the shared document verbs exist, and tabs works without a report", () => {
  for (const name of ["tabs", "tab", "undo", "redo"]) assert.ok(findCommand(name), name);
  assert.ok(availableOnWelcome.has("tabs") && !availableOnWelcome.has("tab") && !availableOnWelcome.has("undo"));
  assert.ok(findCommand("tab")!.args.test("2") && !findCommand("tab")!.args.test("") && !findCommand("tab")!.args.test("x"));
});

test("the shell's shared commands are used, with no LabForge duplicates", () => {
  for (const name of ["new", "open", "recent", "save", "close", "zoom", "terminal", "version", "changes", "about", "licenses", "shortcuts"]) assert.ok(findCommand(name), name);
  assert.equal(commands.filter(command => command.name === "zoom").length, 1);
  assert.ok(!findCommand("fit"), "LabForge has no Fit");
  assert.ok(!findCommand("font"), "the Terminal text size is terminal font");
  assert.deepEqual(findCommand("panel")!.choices, ["on", "off", "terminal", "plots", "tables", "messages"]);
  assert.equal(new Set(commands.map(command => command.name)).size, commands.length);
});
