// Licensed under the GNU General Public License v2 or later. See LICENSE.
import { Compartment, EditorState, Prec, RangeSetBuilder, StateEffect, StateField, type Extension, type Range } from "@codemirror/state";
import { Decoration, EditorView, ViewPlugin, drawSelection, rectangularSelection, scrollPastEnd, hoverTooltip, highlightActiveLineGutter, keymap, lineNumbers, type DecorationSet, type ViewUpdate } from "@codemirror/view";
import { bibliographyEntries, documentLabels, fileArgument, fileChoices, nameArgument, type CitationEntry } from "./references";
import katex from "katex";
import "katex/contrib/mhchem";
import { defaultKeymap, history, historyKeymap, indentLess, redo, toggleComment, undo, selectAll } from "@codemirror/commands";
import { HighlightStyle, StreamLanguage, StringStream, type StreamParser, bracketMatching, codeFolding, foldAll, foldGutter, foldKeymap, foldService, foldable, indentUnit, syntaxHighlighting, unfoldAll } from "@codemirror/language";
import { acceptCompletion, autocompletion, closeBrackets, closeBracketsKeymap, completionKeymap, completionStatus, type CompletionContext, type CompletionResult } from "@codemirror/autocomplete";
import { gotoLine, selectNextOccurrence, selectSelectionMatches } from "@codemirror/search";
import { FindController, searchCount, type FindBar } from "forge-shell/app/find-bar";
export { searchCount, type FindBar } from "forge-shell/app/find-bar";
import { codeSummaries } from "./code-summaries";
import { showMinimap } from "@replit/codemirror-minimap";
import { Tag } from "@lezer/highlight";
import { UI_ICONS } from "forge-shell/app/tool-icons";
import { preambleRange } from "../engine/preamble";
import { joinLines, matchEnvironment, sortLines, tabIndent, trimTrailingWhitespace } from "./editor-commands";
import { editorDefaults, type EditorSettings } from "./editor-settings";
import { roundedSelection } from "forge-shell/app/code-editor";
import { availableCommands, commandAt, commandKeys, findFrameworkCommand, frameworkCommands, frameworkKeys, getReportPackages, keysContext, refSnippet, type FrameworkCommand } from "./framework-commands";
import { checkTex, type TexProblem } from "./tex-lint";
import type { BuildDiagnostic } from "../engine/tex-diagnostics";
import { texCommandNames } from "./tex-names";
import { CommandLanguageSession } from "./command-language";
import { mathAtCursor } from "./math-preview";
import { proseWords } from "./spell-check";
import { escaped, sourceRegions } from "./source-reader";
import { showContextMenu } from "forge-shell/app/context-menu";

/** Highlight tags for the LaTeX token kinds; app.css colours them through the `syntax-*` classes. */
const latexTags = { command: Tag.define(), keyword: Tag.define(), environment: Tag.define(), comment: Tag.define(), math: Tag.define(), brace: Tag.define() };
type TokenKind = keyof typeof latexTags;
/** 0: ordinary text; 1: after \begin or \end, expecting "{"; 2: inside the environment name; 3: expecting the closing "}". */
type LatexState = { environment: 0 | 1 | 2 | 3 };

/** Commands that set up or define things (the preamble) are coloured as keywords; `\\` and `&`, which lay out lines and cells, are too. */
const setupCommand = /^\\(?:documentclass|usepackage|input|labforgesetup|(?:re)?newcommand|providecommand|def|(?:Re|Provide)?NewDocumentCommand|DeclareMathOperator|DeclareSIUnit|(?:re)?newenvironment|NewDocumentEnvironment)\*?$/;

/** The LaTeX tokens the editor colours: commands, \begin/\end environment names, comments, math delimiters and braces. */
const latexParser: StreamParser<LatexState> = {
  name: "latex",
  startState: () => ({ environment: 0 }),
  token(stream, state): TokenKind | null {
    if (stream.sol()) state.environment = 0;
    if (state.environment === 1 && stream.eat("{")) { state.environment = 2; return "brace"; }
    if (state.environment === 2 && stream.eatWhile(/[^}\n]/)) { state.environment = 3; return "environment"; }
    if ((state.environment === 2 || state.environment === 3) && stream.eat("}")) { state.environment = 0; return "brace"; }
    state.environment = 0;
    if (stream.match(/^\\(?:begin|end)(?=\{)/)) { state.environment = 1; return "command"; }
    const command = stream.match(/^\\[a-zA-Z@]+\*?/) as RegExpMatchArray | null;
    if (command) return setupCommand.test(command[0]) ? "keyword" : "command";
    if (stream.match(/^\\\\/)) return "keyword";
    if (stream.match(/^\\./)) return null;
    if (stream.eat("&")) return "keyword";
    if (stream.eat("%")) { stream.skipToEnd(); return "comment"; }
    if (stream.eat("{") || stream.eat("}")) return "brace";
    if (stream.match(/^\${1,2}/)) return "math";
    if (!stream.eatWhile(/[^\\%{}$&]/)) stream.next();
    return null;
  },
  tokenTable: latexTags,
  languageData: { commentTokens: { line: "%" }, closeBrackets: { brackets: ["(", "[", "{", "$"] } },
};
export const latexLanguage = StreamLanguage.define<LatexState>(latexParser);

/** One line cut into runs by the editor's own tokenizer, each with its token kind (`null` for plain text); the welcome page colours its sketch with it. */
export function latexRuns(line: string): { text: string; kind: TokenKind | null }[] {
  const runs: { text: string; kind: TokenKind | null }[] = [];
  const stream = new StringStream(line, 4, 4), state = latexParser.startState!(4);
  while (!stream.eol()) {
    stream.start = stream.pos;
    const kind = latexParser.token(stream, state) as TokenKind | null;
    if (stream.pos === stream.start) stream.next();
    runs.push({ text: stream.current(), kind });
  }
  return runs;
}

export const latexHighlight = HighlightStyle.define((Object.keys(latexTags) as TokenKind[]).map(kind => ({ tag: latexTags[kind], class: `syntax-${kind}` })));

/** Place the cursor in the first `{}` or `[]` of an inserted snippet, or after it when it has none. */
function applySnippet(text: string) {
  return (view: EditorView, _completion: unknown, from: number, to: number) => {
    const stops = [text.indexOf("{"), text.indexOf("[")].filter(index => index >= 0);
    const cursor = stops.length ? from + Math.min(...stops) + 2 : from + text.length + 1;
    view.dispatch({ changes: { from, to, insert: `\\${text}` }, selection: { anchor: cursor }, userEvent: "input.complete" });
  };
}

/** Key names, and the values of a key, offered inside the `[…]` of a framework command. */
function keyCompletions(context: CompletionContext): CompletionResult | null {
  const line = context.state.doc.lineAt(context.pos);
  const before = line.text.slice(0, context.pos - line.from);
  const found = keysContext(before);
  if (!found) return null;
  const value = /^([a-z-]+)=([\w-]*)$/.exec(found.typed);
  if (value) {
    const key = commandKeys(found.command).find(candidate => candidate.name === value[1]);
    if (!key?.values) return null;
    const options = key.values.filter(item => item.startsWith(value[2]) && item !== value[2]).map(item => ({ label: item, type: "constant" }));
    return options.length ? { from: context.pos - value[2].length, options, filter: false } : null;
  }
  if (!/^[a-z]*$/.test(found.typed) || (!found.typed && !context.explicit && !/[\[,]\s*$/.test(before))) return null;
  const options = commandKeys(found.command).filter(key => !found.used.includes(key.name) && key.name.startsWith(found.typed))
    .map(key => ({ label: key.name, detail: key.description.split(/[;:.]/)[0], apply: `${key.name}=`, type: "property" }));
  return options.length ? { from: context.pos - found.typed.length, options, filter: false } : null;
}

/** Environment names offered inside `\begin{…}` and `\end{…}`. Package names come from the open report. */
function environmentCompletions(context: CompletionContext): CompletionResult | null {
  const line = context.state.doc.lineAt(context.pos);
  const before = line.text.slice(0, context.pos - line.from);
  if (/(^|[^\\])%/.test(before)) return null;
  const found = /\\(begin|end)\{([a-zA-Z*@]*)$/.exec(before);
  if (!found) return null;
  const typed = found[2];
  const after = line.text.slice(context.pos - line.from);
  const rest = /^[a-zA-Z*@]*(?=\})/.exec(after)?.[0] ?? "";
  const names = new Map<string, string>([
    ["document", "Report body"], ["itemize", "Bulleted list"], ["enumerate", "Numbered list"],
    ["description", "Description list"], ["figure", "Figure float"], ["table", "Table float"],
    ["tabular", "Table rows"], ["equation", "Displayed equation"], ["center", "Centered text"],
    ["flushleft", "Left-aligned text"], ["flushright", "Right-aligned text"],
    ["quote", "Quotation"], ["quotation", "Long quotation"], ["verbatim", "Verbatim text"],
    ["minipage", "Box with its own width"],
  ]);
  const packages = getReportPackages().names;
  if (packages.has("amsmath")) for (const name of ["equation*", "align", "align*", "aligned", "alignedat", "gather", "gather*", "multline", "multline*", "split", "cases", "matrix", "pmatrix", "bmatrix"]) names.set(name, "Mathematics environment (amsmath)");
  if (packages.has("multicol")) names.set("multicols", "Text in columns (multicol)");
  if (packages.has("pgfplots")) { names.set("tikzpicture", "TikZ drawing"); names.set("axis", "Plot axes (pgfplots)"); }
  const source = context.state.doc.toString();
  const uncommented = source.split("\n").map(text => text.replace(/(^|[^\\])%.*$/, "$1")).join("\n");
  for (const match of uncommented.matchAll(/\\(?:newenvironment|renewenvironment|NewDocumentEnvironment|RenewDocumentEnvironment)\*?\s*\{([a-zA-Z][a-zA-Z*@]*)\}/g)) names.set(match[1], "Defined in this report");
  if (found[1] === "end") {
    const stack: string[] = [];
    const preceding = source.slice(0, context.pos - found[0].length).split("\n").map(text => text.replace(/(^|[^\\])%.*$/, "$1")).join("\n");
    for (const match of preceding.matchAll(/\\(begin|end)\{([a-zA-Z][a-zA-Z*@]*)\}/g)) {
      if (match[1] === "begin") stack.push(match[2]);
      else if (stack.at(-1) === match[2]) stack.pop();
    }
    for (const name of stack.reverse()) if (!names.has(name)) names.set(name, "Open environment");
    const open = stack.filter((name, index) => stack.indexOf(name) === index);
    const options = [...open, ...[...names.keys()].filter(name => !open.includes(name))];
    return { from: context.pos - typed.length, to: context.pos + rest.length, options: options.filter(name => name.startsWith(typed) && name !== typed).map(name => ({ label: name, detail: open.includes(name) ? "Open environment" : names.get(name), type: "type" })), filter: false };
  }
  return { from: context.pos - typed.length, to: context.pos + rest.length, options: [...names].filter(([name]) => name.startsWith(typed) && name !== typed).map(([label, detail]) => ({ label, detail, type: "type" })), filter: false };
}

/**
 * LabForge's own commands offered without the backslash: `mypl` offers `\myplot{}`, and accepting writes the backslash. It starts at three letters
 * (`myp`), never inside a longer word, an escape or a comment, and offers only the `my…` commands, so ordinary words do not open the list.
 */
function bareCompletions(context: CompletionContext): CompletionResult | null {
  const word = context.matchBefore(/my[a-z]{1,}/);
  if (!word || word.text.length < 3) return null;
  const line = context.state.doc.lineAt(word.from);
  const before = context.state.sliceDoc(line.from, word.from);
  if (/[a-zA-Z@\\]$/.test(before) || /(^|[^\\])%/.test(before)) return null;
  const options = frameworkCommands.filter(command => command.name.startsWith(word.text) && command.name !== word.text && command.name !== "myref*")
    .map(command => {
      const text = command.name === "myref" ? refSnippet(context.state.sliceDoc(Math.max(0, word.from - 40), word.from)) : command.snippet;
      return { label: `\\${text}`, detail: command.description.replace(/;.*$/, ""), apply: applySnippet(text) };
    });
  return options.length ? { from: word.from, options, filter: false } : null;
}

/** The report's files, as project paths, for the names `\myfigure`, `\myplot` and `\mytable` offer. */
let projectFileNames: readonly string[] = [];
let citationEntries: readonly CitationEntry[] = [];
/** The keys `\cite{` offers: the entries of the report's references.bib. */
export function setCitationSource(bib: string | null): void { citationEntries = bib ? bibliographyEntries(bib) : []; }

/** Keys inside `\cite{…}` and labels inside `\myref{…}` or `\ref{…}`, ranked by how early the typed text occurs. */
function nameCompletions(context: CompletionContext): CompletionResult | null {
  const line = context.state.doc.lineAt(context.pos);
  const before = line.text.slice(0, context.pos - line.from);
  if (/(^|[^\\])%/.test(before)) return null;
  const file = fileArgument(before);
  if (file) {
    const typed = file.typed.toLowerCase();
    const listed = /\{([^{}]*)$/.exec(before)![1].split(",").slice(0, -1).map(name => name.trim());
    const rank = (name: string) => { const at = name.toLowerCase().indexOf(typed); return at < 0 ? -1 : at; };
    const options = fileChoices(file.kind, projectFileNames, listed).filter(name => name !== file.typed && rank(name) >= 0).sort((a, b) => rank(a) - rank(b))
      .map(name => ({ label: name, type: "variable" }));
    const rest = /^[^,{}]*/.exec(line.text.slice(context.pos - line.from))![0];
    return options.length ? { from: line.from + file.start, to: context.pos + rest.length, options, filter: false } : null;
  }
  const found = nameArgument(before);
  if (!found) return null;
  const typed = found.typed.toLowerCase();
  const names = found.kind === "citation" ? citationEntries.map(entry => ({ name: entry.key, detail: entry.detail })) : documentLabels(context.state.doc.toString());
  const rank = (name: string) => { const at = name.toLowerCase().indexOf(typed); return at < 0 ? -1 : at; };
  const options = names.filter(entry => entry.name !== found.typed && rank(entry.name) >= 0).sort((a, b) => rank(a.name) - rank(b.name))
    .map(entry => ({ label: entry.name, detail: entry.detail, type: "variable" }));
  const rest = /^[^,{}\s]*/.exec(line.text.slice(context.pos - line.from))![0];
  return options.length ? { from: line.from + found.start, to: context.pos + rest.length, options, filter: false } : null;
}

/** Every available command that extends the typed `\prefix`; CodeMirror scrolls the list. */
export function texCompletions(context: CompletionContext): CompletionResult | null {
  const environment = environmentCompletions(context);
  if (environment) return environment;
  const names = nameCompletions(context);
  if (names) return names;
  const word = context.matchBefore(/\\[a-zA-Z]*/);
  if (!word) return keyCompletions(context) ?? bareCompletions(context);
  if (word.text.length < 2 && !context.explicit) return null;
  const prefix = word.text.toLowerCase();
  const before = context.state.sliceDoc(Math.max(0, word.from - 40), word.from);
  const options = availableCommands().filter(command => `\\${command.name}`.toLowerCase().startsWith(prefix) && `\\${command.name}` !== word.text && command.name !== "myref*")
    .map(command => { const snippet = command.name === "myref" ? refSnippet(before) : command.snippet;
      return { label: `\\${snippet}`, detail: command.description.replace(/;.*$/, ""), apply: applySnippet(snippet) }; });
  return options.length ? { from: word.from, options, filter: false } : null;
}

/** The hover card for a framework command: syntax, description, keys and an example. */
export function commandTooltip(command: FrameworkCommand): HTMLElement {
  const root = document.createElement("div");
  root.className = "cm-command-help";
  const add = (className: string, text: string) => { const row = document.createElement("div"); row.className = className; row.textContent = text; root.append(row); };
  add("cm-command-syntax", command.syntax);
  add("cm-command-description", command.description);
  // A standard or custom command also says where it comes from.
  const source = (command as { package?: string }).package;
  if (source) add("cm-command-package", `From ${source}`);
  const keys = commandKeys(command);
  if (keys.length) {
    const list = document.createElement("div");
    list.className = "cm-command-keys";
    for (const key of keys) {
      const row = document.createElement("div"); row.className = "cm-command-key";
      const name = document.createElement("span"); name.className = "cm-command-key-name"; name.textContent = key.name;
      row.append(name, key.description);
      list.append(row);
    }
    root.append(list);
  }
  add("cm-command-example", command.example);
  return root;
}

const commandHover = hoverTooltip((view, position) => {
  const line = view.state.doc.lineAt(position);
  const found = commandAt(line.text, position - line.from);
  if (!found) return null;
  return { pos: line.from + found.from, end: line.from + found.to, above: true, create: () => ({ dom: commandTooltip(found.command) }) };
}, { hoverTime: 350 });

/* Source and build problems mark the exact text with a quiet tint and straight underline; hover explains it. */

const problemMark = Decoration.mark({ class: "cm-texError" });
const spellingMark = Decoration.mark({ class: "cm-spellingError" });
const setSpelling = StateEffect.define<DecorationSet>();
const spelling = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update: (value, tr) => {
    if (tr.docChanged) value = Decoration.none;
    for (const effect of tr.effects) if (effect.is(setSpelling)) value = effect.value;
    return value;
  },
  provide: field => EditorView.decorations.from(field),
});
/* Spelling answers are cached per word for the session; Add to dictionary and Ignore update the cache directly. */
const spellCache = new Map<string, boolean>();
const recheckSpelling = StateEffect.define<null>();
/** Debounced desktop spelling sends only prose words, from the app's own dictionaries, and never starts TeX. */
export const proseSpellcheck: Extension = [spelling, sourceRegions, ViewPlugin.fromClass(class {
  private timer: number | undefined;
  constructor(private view: EditorView) { this.schedule(); }
  update(update: ViewUpdate): void {
    if (update.docChanged || update.transactions.some(tr => tr.effects.some(effect => effect.is(recheckSpelling)))) this.schedule();
  }
  destroy(): void { if (this.timer !== undefined) clearTimeout(this.timer); }
  private schedule(): void {
    if (this.timer !== undefined) clearTimeout(this.timer);
    const doc = this.view.state.doc;
    this.timer = window.setTimeout(async () => {
      this.timer = undefined;
      const check = window.labforge?.misspelledWords;
      if (!check || this.view.state.doc !== doc) return;
      const words = proseWords(doc.toString(), this.view.state.field(sourceRegions));
      const unknown = [...new Set(words.map(item => item.word))].filter(word => !spellCache.has(word));
      if (unknown.length) {
        let wrong: string[];
        try { wrong = await check(unknown); } catch { return; }
        const marked = new Set(wrong);
        for (const word of unknown) spellCache.set(word, marked.has(word));
      }
      if (this.view.state.doc !== doc) return;
      const ranges = words.filter(item => spellCache.get(item.word)).map(item => spellingMark.range(item.from, item.to));
      this.view.dispatch({ effects: setSpelling.of(Decoration.set(ranges)) });
    }, 180);
  }
})];

/** Offer replacements, Add to dictionary and Ignore only for a word marked as misspelled. */
export function spellingContextMenu(view: EditorView, event: MouseEvent | KeyboardEvent, enabled: boolean): boolean {
  const bridge = window.labforge;
  if (!enabled || !bridge?.wordSuggestions) return false;
  const pointer = "clientX" in event && !!(event.clientX || event.clientY);
  const position = pointer ? view.posAtCoords({ x: event.clientX, y: event.clientY }) : view.state.selection.main.head;
  if (position === null) return false;
  let marked = false;
  view.state.field(spelling).between(position, position, (from, to) => { if (position >= from && position <= to) marked = true; });
  const item = marked ? proseWords(view.state.doc.toString()).find(word => position >= word.from && position <= word.to) : undefined;
  if (!item) return false;
  event.preventDefault();
  const original = view.state.doc;
  const caret = pointer ? null : view.coordsAtPos(position);
  const x = pointer ? event.clientX : caret?.left ?? 0;
  const y = pointer ? event.clientY : caret?.bottom ?? 0;
  const accept = (keep: ((word: string) => Promise<void>) | undefined) => async () => {
    spellCache.set(item.word, false);
    view.dispatch({ effects: recheckSpelling.of(null) });
    try { await keep?.(item.word); } catch { /* The word stays accepted for this session. */ }
  };
  void bridge.wordSuggestions(item.word).catch(() => [] as string[]).then(choices => {
    if (view.state.doc !== original) return;
    showContextMenu(x, y, [
      ...(choices.length ? choices.map(label => ({ label, action: () => {
        if (view.state.doc !== original) return;
        view.dispatch({ changes: { from: item.from, to: item.to, insert: label }, selection: { anchor: item.from + label.length }, userEvent: "input" });
        view.focus();
      } })) : [{ label: "No spelling suggestions" }]),
      { label: "", separator: true },
      { label: "Add to dictionary", action: accept(bridge.addWord) },
      { label: "Ignore", action: accept(bridge.ignoreWord) },
    ]);
  });
  return true;
}
const setSourceProblems = StateEffect.define<TexProblem[]>();
const setBuildProblems = StateEffect.define<TexProblem[]>();
type ProblemState = { source: TexProblem[]; build: TexProblem[]; marks: DecorationSet };
function problemState(source: TexProblem[], build: TexProblem[]): ProblemState {
  const ranges = [...source, ...build].filter(problem => problem.to > problem.from).sort((a, b) => a.from - b.from || a.to - b.to)
    .map(problem => problemMark.range(problem.from, problem.to));
  return { source, build, marks: Decoration.set(ranges) };
}
const texProblems = StateField.define<ProblemState>({
  create: () => problemState([], []),
  update: (value, tr) => {
    let source = tr.docChanged ? [] : value.source;
    let build = tr.docChanged ? [] : value.build;
    for (const effect of tr.effects) {
      if (effect.is(setSourceProblems)) source = effect.value;
      if (effect.is(setBuildProblems)) build = effect.value;
    }
    return source === value.source && build === value.build ? value : problemState(source, build);
  },
  provide: field => EditorView.decorations.from(field, value => value.marks),
});
function problemsOf(text: string, projectFiles: readonly string[]): TexProblem[] {
  return checkTex(text, {
    isKnownCommand: name => !!findFrameworkCommand(name),
    isLatexCommand: name => texCommandNames.has(name) || !!findFrameworkCommand(name),
    suggestFrom: () => texCommandNames,
    commandKeys: name => frameworkCommands.find(command => command.name === name)?.keys,
    keyValues: key => frameworkKeys[key]?.values,
    commandArgument: name => name === "input" ? "file" : /\{<([^>]+)>[^}]*\}/.exec(frameworkCommands.find(command => command.name === name)?.syntax ?? "")?.[1],
    projectFiles,
  });
}
const problemHover = hoverTooltip((view, position) => {
  const problems = view.state.field(texProblems);
  const found = [...problems.source, ...problems.build].find(problem => position >= problem.from && position <= problem.to);
  if (!found) return null;
  return { pos: found.from, end: found.to, above: true, create: () => {
    const dom = document.createElement("div"); dom.className = "cm-texErrorTip"; dom.textContent = found.message;
    return { dom };
  } };
}, { hoverTime: 250 });
export const texProblemExtensions: Extension = [texProblems, problemHover];

/** Build errors only mark a token when TeX supplied one and it occurs on the reported line. */
export function locateBuildProblem(text: string, issue: BuildDiagnostic): TexProblem | null {
  if (!issue.line || !issue.token || !/^(?:\.\/)?main\.tex$/.test(issue.file ?? "")) return null;
  const lines = text.split("\n");
  if (issue.line < 1 || issue.line > lines.length) return null;
  const line = lines[issue.line - 1];
  const index = line.lastIndexOf(issue.token);
  if (index < 0) return null;
  const from = lines.slice(0, issue.line - 1).reduce((sum, part) => sum + part.length + 1, 0) + index;
  return { from, to: from + issue.token.length, message: issue.message };
}

function diagnosticMinimap(): Extension {
  return showMinimap.compute([texProblems], state => {
    const problems = state.field(texProblems);
    const color = getComputedStyle(document.body).getPropertyValue("--error").trim();
    const gutter: Record<number, string> = {};
    for (const problem of [...problems.source, ...problems.build]) gutter[state.doc.lineAt(problem.from).number] = color;
    return { create: () => ({ dom: document.createElement("div") }), displayText: "blocks", showOverlay: "always", gutters: [gutter] };
  });
}

/* Folding: sectioning commands and environments. */

const headingLevels: Record<string, number> = { part: 0, chapter: 1, section: 2, mysection: 2, subsection: 3, mysubsection: 3, subsubsection: 4, mysubsubsection: 4, paragraph: 5 };
const headingPattern = /^\s*\\(part|chapter|section|subsection|subsubsection|mysection|mysubsection|mysubsubsection|paragraph)\*?(?![a-zA-Z@])/;
const rulePattern = /^\s*%\s*={8,}\s*$/;

/** A foldable region that starts on the line beginning at `lineStart`, or `null`. */
export function latexFoldRange(state: EditorState, lineStart: number): { from: number; to: number } | null {
  const doc = state.doc;
  const line = doc.lineAt(lineStart);
  const heading = headingPattern.exec(line.text);
  if (heading) {
    const level = headingLevels[heading[1]];
    let last = line.number;
    for (let number = line.number + 1; number <= doc.lines; number++) {
      const text = doc.line(number).text;
      const next = headingPattern.exec(text);
      if ((next && headingLevels[next[1]] <= level) || /^\s*\\end\{document\}/.test(text)) break;
      last = number;
    }
    while (last > line.number && !doc.line(last).text.trim()) last--;
    return last > line.number ? { from: line.to, to: doc.line(last).to } : null;
  }
  const begin = /\\begin\{([^}]+)\}/.exec(line.text);
  if (begin && begin[1] !== "document") {
    const name = begin[1].replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const token = new RegExp(`\\\\(begin|end)\\{${name}\\}`, "g");
    let depth = 0;
    for (let number = line.number; number <= doc.lines; number++) {
      const raw = doc.line(number).text;
      // A comment starts at a % that is not escaped; after \\ (a line break) it is one.
      const comment = [...raw.matchAll(/%/g)].find(match => !escaped(raw, match.index))?.index;
      const text = comment === undefined ? raw : raw.slice(0, comment);
      for (const match of text.matchAll(token)) {
        if (number === line.number && match.index! < begin.index) continue;
        depth += match[1] === "begin" ? 1 : -1;
        if (depth === 0) return number > line.number + 1 ? { from: line.to, to: doc.line(number - 1).to } : null;
      }
    }
  }
  return null;
}

/* Auto-closing environments. */

/** After `\begin{name}` at the end of a line, Enter opens an indented line and adds `\end{name}` below, unless the environment is already closed. */
export function closeEnvironment(view: { state: EditorState; dispatch: EditorView["dispatch"] }): boolean {
  const { state } = view;
  const selection = state.selection.main;
  if (!selection.empty) return false;
  const line = state.doc.lineAt(selection.head);
  const before = state.sliceDoc(line.from, selection.head);
  const after = state.sliceDoc(selection.head, line.to);
  const begin = /\\begin\{([^}]+)\}(?:\[[^\]]*\]|\{[^}]*\})*\s*$/.exec(before);
  if (!begin || after.trim() || begin[1] === "document") return false;
  const name = begin[1].replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  let balance = 0;
  for (const match of state.sliceDoc(selection.head).matchAll(new RegExp(`\\\\(begin|end)\\{${name}\\}`, "g"))) {
    balance += match[1] === "begin" ? 1 : -1;
    if (balance < 0) return false;
  }
  const indent = /^\s*/.exec(line.text)![0];
  const inner = `\n${indent}${state.facet(indentUnit)}`;
  view.dispatch({ changes: { from: selection.head, to: line.to, insert: `${inner}\n${indent}\\end{${begin[1]}}` },
    selection: { anchor: selection.head + inner.length }, scrollIntoView: true, userEvent: "input" });
  return true;
}

/** Enter between a matching `[]`, `{}` or `()` puts the cursor on an indented line of its own and the closer on the line below. */
export function explodeBrackets(view: { state: EditorState; dispatch: EditorView["dispatch"] }): boolean {
  const { state } = view;
  const selection = state.selection.main;
  if (!selection.empty) return false;
  const head = selection.head;
  const pair = state.sliceDoc(Math.max(0, head - 1), head + 1);
  if (!["[]", "{}", "()"].includes(pair)) return false;
  const indent = /^\s*/.exec(state.doc.lineAt(head).text)![0];
  const inner = `\n${indent}${state.facet(indentUnit)}`;
  view.dispatch({ changes: { from: head, insert: `${inner}\n${indent}` }, selection: { anchor: head + inner.length }, scrollIntoView: true, userEvent: "input" });
  return true;
}

/* Bracket pair colors and whitespace in selections. */

/**
 * Depth of each brace, square bracket and parenthesis, skipping comments and escaped brackets. A closer only closes an opener of its own kind,
 * so a stray `)` such as the one in "1) first" neither counts nor changes the depth. Returns `[position, depth]` pairs within `[from, to)`.
 */
export function bracketDepths(text: string, from: number, to: number): [number, number][] {
  const out: [number, number][] = [];
  const open: string[] = [];
  const pairs: Record<string, string> = { "}": "{", "]": "[", ")": "(" };
  for (let index = 0; index < to && index < text.length; index++) {
    const char = text[index];
    if (char === "\\") { index++; continue; }
    if (char === "%") { const end = text.indexOf("\n", index); if (end < 0) break; index = end; continue; }
    if (char === "{" || char === "[" || char === "(") { if (index >= from) out.push([index, open.length]); open.push(char); }
    else if (pairs[char]) {
      // Close the nearest opener of this kind, and anything left open inside it.
      const at = open.lastIndexOf(pairs[char]);
      if (at < 0) continue;
      open.length = at;
      if (index >= from) out.push([index, open.length]);
    }
  }
  return out;
}

const bracketMarks = [0, 1, 2].map(level => Decoration.mark({ class: `cm-bracket-${level + 1}` }));
const dimMarks = [0, 1, 2, 3, 4, 5].map(level => Decoration.mark({ class: `cm-bracket-dim-${level + 1}` }));
/** Bracket marks for one style: `pick` maps a depth to its mark. */
const bracketPlugin = (pick: (depth: number) => Decoration) => ViewPlugin.fromClass(class {
  decorations: DecorationSet;
  constructor(view: EditorView) { this.decorations = this.build(view); }
  update(update: ViewUpdate) { if (update.docChanged || update.viewportChanged) this.decorations = this.build(update.view); }
  build(view: EditorView): DecorationSet {
    const builder = new RangeSetBuilder<Decoration>();
    const { from, to } = view.viewport;
    const text = view.state.sliceDoc(0, to);
    for (const [position, depth] of bracketDepths(text, from, to)) builder.add(position, position + 1, pick(depth));
    return builder.finish();
  }
}, { decorations: plugin => plugin.decorations });
/** Three hues by depth, and a pastel yellow that fades with depth; the two can be used together. */
const bracketColorExtension: Extension = bracketPlugin(depth => bracketMarks[depth % 3]);
const bracketDimmedExtension: Extension = bracketPlugin(depth => dimMarks[Math.min(depth, dimMarks.length - 1)]);

const spaceMark = Decoration.mark({ class: "cm-selectionSpace" });
const selectionWhitespace = ViewPlugin.fromClass(class {
  decorations: DecorationSet;
  constructor(view: EditorView) { this.decorations = this.build(view); }
  update(update: ViewUpdate) { if (update.docChanged || update.selectionSet || update.viewportChanged) this.decorations = this.build(update.view); }
  build(view: EditorView): DecorationSet {
    const marks: Range<Decoration>[] = [];
    for (const range of view.state.selection.ranges) {
      if (range.empty) continue;
      for (const visible of view.visibleRanges) {
        const from = Math.max(range.from, visible.from), to = Math.min(range.to, visible.to);
        if (from >= to) continue;
        const text = view.state.sliceDoc(from, to);
        for (let index = 0; index < text.length; index++) if (text[index] === " " || text[index] === "\t") marks.push(spaceMark.range(from + index, from + index + 1));
      }
    }
    return Decoration.set(marks, true);
  }
}, { decorations: plugin => plugin.decorations });

/* Selection: one rounded shape around the selected text. The current line is highlighted only while nothing is selected. */

const activeLineMark = Decoration.line({ class: "cm-activeLine" });
const activeLineHighlight = ViewPlugin.fromClass(class {
  decorations: DecorationSet;
  constructor(view: EditorView) { this.decorations = this.build(view); }
  update(update: ViewUpdate) { if (update.docChanged || update.selectionSet || update.viewportChanged) this.decorations = this.build(update.view); }
  build(view: EditorView): DecorationSet {
    const { main } = view.state.selection;
    return main.empty ? Decoration.set([activeLineMark.range(view.lineBlockAt(main.head).from)]) : Decoration.none;
  }
}, { decorations: plugin => plugin.decorations });

/* Find and replace. */

export interface LatexEditorOptions {
  parent: HTMLElement;
  findBar: FindBar;
  /** Accelerators the menus own; the editor drops its default bindings for them (CodeMirror binds Mod-i, for one). */
  reservedKeys: readonly string[];
  settings: EditorSettings;
  onChange(text: string): void;
  onCommandInputSource?(action: "begin" | "restore"): boolean;
  onCommandInputContext?(active: boolean): void;
  /** The cursor or selection moved, or the text changed. */
  onSelection?(): void;
  /** ⌘-click (Ctrl-click) at `offset`; true when it opened something. */
  onCodeClick?(offset: number): boolean;
}

/** The editor's text size as a theme, so changing it makes CodeMirror measure line heights again. */
export function zoomTheme(size: number): Extension {
  return EditorView.theme({ "&": { fontSize: `${size}px` }, ".cm-scroller": { fontSize: `${size}px` } });
}

/** The extensions for the View › Editor options and the text size; the center editor and the Plots and Tables code use the same. */
export function editorOptionExtensions(s: EditorSettings, fontSize: number) {
  return {
    wrap: s.wrap ? EditorView.lineWrapping : [],
    autoClose: s.autoClose ? [closeBrackets(), keymap.of(closeBracketsKeymap)] : [],
    bracketColors: s.bracketColors ? bracketColorExtension : [],
    bracketDimmed: s.bracketDimmed ? bracketDimmedExtension : [],
    smoothBlink: s.smoothBlink ? EditorView.editorAttributes.of({ class: "cm-smoothBlink" }) : [],
    smoothCaret: s.smoothCaret ? EditorView.editorAttributes.of({ class: "cm-smoothCaret" }) : [],
    minimap: s.minimap ? showMinimap.of({ create: () => ({ dom: document.createElement("div") }), displayText: "blocks", showOverlay: "always" }) : [],
    cursorMargin: s.cursorMargin ? EditorView.scrollMargins.of(view => ({ top: view.defaultLineHeight * 3, bottom: view.defaultLineHeight * 3 })) : [],
    selectionWhitespace: s.selectionWhitespace ? selectionWhitespace : [],
    activeLine: s.activeLine ? [activeLineHighlight, highlightActiveLineGutter()] : [],
    spellcheck: [EditorView.contentAttributes.of({ spellcheck: "false" }), ...(s.spellcheck ? [proseSpellcheck] : [])],
    tabSize: [EditorState.tabSize.of(s.tabSize), indentUnit.of(" ".repeat(s.tabSize))],
    zoom: zoomTheme(fontSize),
  };
}

/** The center LaTeX editor. Each project keeps its own state, so switching tabs keeps its text, selection and undo history. */
export class LatexEditor {
  readonly view: EditorView;
  private settings: EditorSettings;
  private readonly commandInput: CommandLanguageSession;
  private readonly reportCommandInputContext: (active: boolean) => void;
  private fontSize = 14;
  private readonly finder: FindController;
  private projectFiles: readonly string[] = [];
  private sourceTimer: number | undefined;
  private mathTimer: number | undefined;
  private mathPopup: HTMLElement | undefined;
  readonly compartments = { wrap: new Compartment(), autoClose: new Compartment(), bracketColors: new Compartment(), bracketDimmed: new Compartment(), smoothBlink: new Compartment(),
    smoothCaret: new Compartment(), minimap: new Compartment(), cursorMargin: new Compartment(), selectionWhitespace: new Compartment(),
    activeLine: new Compartment(), spellcheck: new Compartment(), tabSize: new Compartment(), zoom: new Compartment(), summaries: new Compartment() };
  private readonly extensions: Extension[];

  constructor(options: LatexEditorOptions) {
    this.settings = { ...editorDefaults, ...options.settings };
    this.commandInput = new CommandLanguageSession(options.onCommandInputSource ?? (() => false));
    this.reportCommandInputContext = options.onCommandInputContext ?? (() => {});
    this.finder = new FindController(() => this.view, options.findBar);
    // Menu accelerators read `CmdOrCtrl+Shift+Z`; CodeMirror key names read `Mod-Shift-z`.
    const reserved = new Set(options.reservedKeys.map(key => key.replace("CmdOrCtrl", "Mod").replaceAll("+", "-").toLowerCase()));
    const bindings = [...defaultKeymap, ...historyKeymap, ...foldKeymap].filter(binding => !binding.key || !reserved.has(binding.key.toLowerCase()));
    this.extensions = [
      lineNumbers(),
      // Room below the last line, so folding or unfolding keeps the line you clicked where it was instead of re-clamping the scroll.
      scrollPastEnd(),
      foldGutter({ markerDOM: open => { const marker = document.createElement("span"); marker.className = open ? "cm-foldMarker open" : "cm-foldMarker"; marker.innerHTML = UI_ICONS.chevronRight; return marker; } }),
      // A folded range reads as three mono dots in the colour of comments.
      codeFolding({ placeholderDOM: (_view, onclick) => {
        const dots = document.createElement("span");
        dots.className = "cm-foldPlaceholder syntax-comment"; dots.textContent = "..."; dots.setAttribute("aria-label", "Folded lines. Click to unfold.");
        dots.addEventListener("click", onclick);
        return dots;
      } }),
      foldService.of((state, lineStart) => latexFoldRange(state, lineStart)),
      history(),
      // The cursor always blinks at CodeMirror's 1.2 s rate; the smooth option only changes the timing function in app.css.
      EditorState.allowMultipleSelections.of(true),
      // Option-click adds a cursor and Shift-Option-drag selects a column, as in VS Code.
      EditorView.clickAddsSelectionRange.of(event => event.altKey && !event.shiftKey),
      rectangularSelection({ eventFilter: event => event.altKey && event.shiftKey }),
      drawSelection(),
      roundedSelection(),
      bracketMatching(),
      latexLanguage,
      syntaxHighlighting(latexHighlight),
      commandHover,
      texProblemExtensions,
      autocompletion({ override: [texCompletions], maxRenderedOptions: Number.MAX_SAFE_INTEGER, icons: false }),
      ...this.finder.extensions(),
      Prec.highest(keymap.of([
        { key: "Tab", run: view => acceptCompletion(view) || tabIndent(view) },
        { key: "Shift-Tab", run: indentLess },
        { key: "Mod-d", run: selectNextOccurrence, preventDefault: true },
        { key: "Mod-Shift-l", run: selectSelectionMatches, preventDefault: true },
        { key: "Ctrl-j", run: joinLines, preventDefault: true },
        { key: "Mod-Shift-\\", run: matchEnvironment },
        { key: "Enter", run: view => this.settings.autoClose && completionStatus(view.state) !== "active" && (closeEnvironment(view) || explodeBrackets(view)) },
      ])),
      keymap.of([...completionKeymap, ...bindings]),
      ...(Object.entries(this.optionContents()) as [keyof LatexEditor["compartments"], Extension][]).map(([key, content]) => this.compartments[key].of(content)),
      EditorView.contentAttributes.of({ "aria-label": "LaTeX source editor", autocapitalize: "off", autocorrect: "off" }),
      EditorView.domEventHandlers({
        contextmenu: event => spellingContextMenu(this.view, event, this.settings.spellcheck),
        // Files dropped from the system are not pasted as text: the window opens the reports among them.
        drop: event => !!event.dataTransfer && Array.from(event.dataTransfer.types).includes("Files"),
        focus: () => { this.reportCommandInputContext(this.settings.commandLanguage); this.scheduleMathPreview(); return false; },
        keydown: event => {
          if (event.shiftKey && event.key === "F10" && spellingContextMenu(this.view, event, this.settings.spellcheck)) return true;
          if (this.settings.commandLanguage && /^(?:Escape|Tab|Enter|Backspace|Delete|Arrow(?:Left|Right|Up|Down)|Home|End|PageUp|PageDown)$/.test(event.key)) this.commandInput.stop();
          return false;
        },
        blur: () => { this.commandInput.stop(); this.reportCommandInputContext(false); this.hideMathPreview(); return false; },
        mousedown: event => {
          this.commandInput.stop();
          // ⌘-click (Ctrl-click) follows a reference, file name or citation; Option-click still adds a cursor.
          if (event.button !== 0 || !(event.metaKey || event.ctrlKey) || event.altKey || !options.onCodeClick) return false;
          const offset = this.view.posAtCoords({ x: event.clientX, y: event.clientY });
          if (offset === null || !options.onCodeClick(offset)) return false;
          event.preventDefault();
          return true;
        },
        paste: () => { this.commandInput.stop(); return false; },
      }),
      // CodeMirror's own words in the Go to line dialog, in sentence case.
      EditorState.phrases.of({ "go": "Go", "close": "Close" }),
      EditorView.updateListener.of(update => {
        if (this.settings.commandLanguage && update.docChanged) {
          const typed = update.transactions.filter(tr => tr.isUserEvent("input.type"));
          if (typed.length) for (const transaction of typed) transaction.changes.iterChanges((_fromA, _toA, _fromB, _toB, inserted) => this.commandInput.typed(inserted.toString()));
          else this.commandInput.stop();
        } else if (update.selectionSet && !update.docChanged) this.commandInput.stop();
        if (update.docChanged) { options.onChange(update.state.doc.toString()); this.scheduleSourceCheck(); }
        if (update.docChanged || update.selectionSet) options.onSelection?.();
        if (update.docChanged || update.selectionSet) this.scheduleMathPreview();
      }),
    ];
    this.view = new EditorView({ parent: options.parent, state: this.createState("") });
    this.view.scrollDOM.addEventListener("scroll", () => this.scheduleMathPreview(), { passive: true });
    window.addEventListener("blur", () => { this.commandInput.stop(); this.reportCommandInputContext(false); this.hideMathPreview(); });
    window.addEventListener("resize", () => this.hideMathPreview());
    window.addEventListener("focus", () => this.reportCommandInputContext(this.settings.commandLanguage && this.view.hasFocus));
    this.scheduleSourceCheck();
  }

  /** What each option compartment holds for the current settings. */
  private optionContents(): Record<keyof LatexEditor["compartments"], Extension> {
    const contents = editorOptionExtensions(this.settings, this.fontSize);
    return { ...contents, minimap: this.settings.minimap ? diagnosticMinimap() : [], summaries: this.settings.summaries ? codeSummaries : [] };
  }

  /** Apply new settings to the visible state. */
  configure(settings: EditorSettings): void {
    this.settings = { ...settings };
    if (!settings.commandLanguage) this.commandInput.stop();
    if (settings.mathPreview) this.scheduleMathPreview(); else this.hideMathPreview();
    // A menu or Terminal toggle can change this while the editor already has focus.
    this.reportCommandInputContext(this.settings.commandLanguage && this.view.hasFocus);
    this.reconfigure();
  }

  private reconfigure(): void {
    const contents = this.optionContents();
    this.view.dispatch({ effects: (Object.keys(this.compartments) as (keyof typeof contents)[]).map(key => this.compartments[key].reconfigure(contents[key])) });
  }

  /** A fresh state for a project's text, with an empty undo history. */
  createState(text: string): EditorState {
    return EditorState.create({ doc: text, extensions: this.extensions });
  }

  /** Show a project's state with the current settings applied. */
  setState(state: EditorState): void {
    this.commandInput.stop();
    this.hideMathPreview();
    this.view.setState(state);
    this.reconfigure();
    this.scheduleSourceCheck();
  }

  /** Schedule one source scan after editing pauses. An explicit build is never started here. */
  private scheduleSourceCheck(): void {
    if (this.sourceTimer !== undefined) clearTimeout(this.sourceTimer);
    const doc = this.view.state.doc;
    this.sourceTimer = window.setTimeout(() => {
      this.sourceTimer = undefined;
      if (this.view.state.doc !== doc) return;
      const problems = problemsOf(doc.toString(), this.projectFiles);
      if (this.view.state.doc === doc) this.view.dispatch({ effects: setSourceProblems.of(problems) });
    }, 180);
  }

  /** Render just the expression at the cursor after typing pauses. This never runs TeX or builds a PDF. */
  private scheduleMathPreview(): void {
    this.hideMathPreview();
    if (!this.settings.mathPreview) return;
    this.mathTimer = window.setTimeout(() => { this.mathTimer = undefined; this.showMathPreview(); }, 300);
  }

  private hideMathPreview(): void {
    if (this.mathTimer !== undefined) clearTimeout(this.mathTimer);
    this.mathTimer = undefined;
    this.mathPopup?.remove();
    this.mathPopup = undefined;
  }

  private showMathPreview(): void {
    if (!this.settings.mathPreview || !this.view.hasFocus || !this.view.state.selection.main.empty) return;
    const cursor = this.view.state.selection.main.head;
    const doc = this.view.state.doc;
    const from = Math.max(0, cursor - 8192), to = Math.min(doc.length, cursor + 8192);
    const range = mathAtCursor(this.view.state.sliceDoc(from, to), cursor - from);
    if (!range?.tex.trim()) return;
    const coordinates = this.view.coordsAtPos(cursor), bounds = this.view.scrollDOM.getBoundingClientRect();
    if (!coordinates || coordinates.bottom < bounds.top || coordinates.top > bounds.bottom) return;
    const popup = document.createElement("div");
    popup.className = "math-preview";
    popup.addEventListener("mousedown", event => event.preventDefault());
    popup.setAttribute("role", "status");
    popup.setAttribute("aria-label", "Math preview");
    const label = document.createElement("div"); label.className = "math-preview-label"; label.textContent = "Math preview";
    const content = document.createElement("div"); content.className = "math-preview-content";
    popup.append(label, content);
    try {
      katex.render(range.tex, content, { displayMode: true, output: "mathml", throwOnError: true, trust: false, strict: "ignore", maxExpand: 100 });
    } catch (error) {
      const command = /Undefined control sequence: (\\[a-zA-Z]+)/.exec(String(error))?.[1];
      if (!command) return; // An unfinished expression is expected while typing.
      content.textContent = `Quick preview cannot render ${command}. Build PDF for the full result.`;
      content.classList.add("math-preview-unavailable");
    }
    document.body.append(popup);
    popup.style.maxWidth = `${Math.max(160, Math.min(420, bounds.width - 16))}px`;
    const width = popup.offsetWidth, height = popup.offsetHeight;
    let left = coordinates.right + 12, top = coordinates.top;
    if (left + width > bounds.right - 8) left = coordinates.left - width - 12;
    if (left < bounds.left + 8) { left = bounds.left + 8; top = coordinates.bottom + 10; }
    if (top + height > window.innerHeight - 8) top = Math.max(8, coordinates.top - height - 10);
    popup.style.left = `${Math.max(8, left)}px`;
    popup.style.top = `${Math.max(8, top)}px`;
    this.mathPopup = popup;
  }

  setProjectFiles(files: readonly string[]): void { this.projectFiles = files; projectFileNames = files; this.scheduleSourceCheck(); }
  setBuildDiagnostics(issues: readonly BuildDiagnostic[]): void {
    const text = this.view.state.doc.toString();
    this.view.dispatch({ effects: setBuildProblems.of(issues.map(issue => locateBuildProblem(text, issue)).filter((item): item is TexProblem => !!item)) });
  }
  selectProblem(problem: TexProblem): void {
    this.view.dispatch({ selection: { anchor: problem.from, head: problem.to }, scrollIntoView: true });
    this.view.focus();
  }
  refreshDiagnosticColors(): void { if (this.settings.minimap) this.view.dispatch({ effects: this.compartments.minimap.reconfigure(diagnosticMinimap()) }); }

  /** Put the cursor where a new report is written: two lines below `\begin{document}`, or at the end when there is none. */
  goToWriting(): void {
    const doc = this.view.state.doc;
    const found = /^\\begin\{document\}/m.exec(doc.toString());
    const line = found ? Math.min(doc.lineAt(found.index).number + 2, doc.lines) : doc.lines;
    this.view.dispatch({ selection: { anchor: doc.line(line).from }, scrollIntoView: true });
  }

  get state(): EditorState { return this.view.state; }
  get text(): string { return this.view.state.doc.toString(); }
  get hasFocus(): boolean { return this.view.hasFocus; }
  focus(): void { this.view.focus(); }
  /** Select the whole document, also the lines CodeMirror has not drawn. */
  selectAll(): void { this.view.focus(); selectAll(this.view); }
  /** Replace the whole text as one undoable edit, keeping the cursor at its offset or at the end. */
  replaceAll(text: string): void {
    const head = Math.min(this.view.state.selection.main.head, text.length);
    this.view.dispatch({ changes: { from: 0, to: this.view.state.doc.length, insert: text }, selection: { anchor: head } });
  }
  /** Put text at the cursor, replacing the selection, as one undoable edit, and focus the editor with the cursor after it. */
  insertAtCursor(text: string): void {
    const { from, to } = this.view.state.selection.main;
    this.view.dispatch({ changes: { from, to, insert: text }, selection: { anchor: from + text.length }, scrollIntoView: true, userEvent: "input" });
    this.view.focus();
  }
  /** Write a framework command at the cursor from the toolbar. `{}` and `[]` are cursor stops; a selection goes inside the first `{}`. */
  insertCommand(snippet: string): void {
    const { from, to } = this.view.state.selection.main;
    const selected = this.view.state.sliceDoc(from, to);
    const brace = snippet.indexOf("{}");
    let text = `\\${snippet}`, cursor: number;
    if (selected && brace >= 0) { text = `\\${snippet.slice(0, brace + 1)}${selected}${snippet.slice(brace + 1)}`; cursor = from + text.length; }
    else {
      const stops = [snippet.indexOf("{"), snippet.indexOf("[")].filter(index => index >= 0);
      cursor = stops.length ? from + Math.min(...stops) + 2 : from + text.length;
    }
    this.view.dispatch({ changes: { from, to, insert: text }, selection: { anchor: cursor }, scrollIntoView: true, userEvent: "input" });
    this.view.focus();
  }
  /** Make the text `next` as one undoable edit that changes only what differs, so the cursor and folds elsewhere stay. `cursor` is where the cursor goes, in `next`. */
  applyText(next: string, cursor?: number): void {
    const current = this.view.state.doc.toString();
    let start = 0;
    while (start < current.length && start < next.length && current[start] === next[start]) start++;
    let end = 0;
    while (end < current.length - start && end < next.length - start && current[current.length - 1 - end] === next[next.length - 1 - end]) end++;
    this.view.dispatch({ changes: { from: start, to: current.length - end, insert: next.slice(start, next.length - end) },
      ...(cursor === undefined ? {} : { selection: { anchor: cursor } }), scrollIntoView: true, userEvent: "input" });
  }
  /** Put the cursor at the end of the preamble, where settings and commands of the report's own are written, and show it. */
  revealPreamble(): boolean {
    const range = preambleRange(this.view.state.doc.toString());
    if (!range) return false;
    const at = range.from + this.view.state.sliceDoc(range.from, range.to).replace(/\s+$/, "").length;
    this.view.dispatch({ selection: { anchor: at }, scrollIntoView: true });
    this.view.focus();
    return true;
  }
  /** Replace a range as one undoable edit. */
  replace(from: number, to: number, insert: string): void { this.view.dispatch({ changes: { from, to, insert } }); }
  undo(): boolean { return undo(this.view); }
  redo(): boolean { return redo(this.view); }
  toggleComment(): boolean { return toggleComment(this.view); }
  sortLines(): boolean { return sortLines(this.view); }
  joinLines(): boolean { return joinLines(this.view); }
  trimWhitespace(): boolean { return trimTrailingWhitespace(this.view); }
  gotoLine(): boolean { return gotoLine(this.view); }
  foldAll(): boolean { return foldAll(this.view); }
  unfoldAll(): boolean { return unfoldAll(this.view); }

  /** Re-measure after the editor's font size or container changes. */
  refresh(): void { this.view.requestMeasure(); }

  /** Sets the text size. A theme change makes CodeMirror measure line heights again, so the line numbers follow (a CSS size alone left them at the old spacing). */
  setFontSize(size: number): void {
    this.fontSize = size;
    this.view.dispatch({ effects: this.compartments.zoom.reconfigure(zoomTheme(size)) });
  }

  /* Find and replace bar, shown as CodeMirror's search panel. */

  /** Open the bar; `replace` also shows the replace row. A single-line selection becomes the query. */
  openFind(replace: boolean): void { this.finder.openFind(replace); }
  findNext(): void { this.finder.findNext(); }
  findPrevious(): void { this.finder.findPrevious(); }
  closeFind(): void { this.finder.closeFind(); }
  /** True when the node is inside the Find bar. */
  inFind(node: Node | null): boolean { return this.finder.contains(node); }
}

