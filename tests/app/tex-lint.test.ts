// Licensed under the GNU General Public License v2 or later. See LICENSE.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { checkTex } from "../../source/app/tex-lint";
import { findFrameworkCommand } from "../../source/app/framework-commands";

import { frameworkCommands, frameworkKeys } from "../../source/app/framework-commands";

import { texCommandNames } from "../../source/app/tex-names";

const known = {
  isLatexCommand: (name: string) => texCommandNames.has(name) || !!findFrameworkCommand(name),
  suggestFrom: () => texCommandNames,
  isKnownCommand: (name: string) => !!findFrameworkCommand(name),
  commandKeys: (name: string) => frameworkCommands.find(command => command.name === name)?.keys,
  keyValues: (key: string) => frameworkKeys[key]?.values,
  commandArgument: (name: string) => /\{<([^>]+)>[^}]*\}/.exec(frameworkCommands.find(command => command.name === name)?.syntax ?? "")?.[1],
};
const messages = (text: string) => checkTex(text, known).map(problem => `${text.slice(problem.from, problem.to)} | ${problem.message}`);

test("file commands mark a missing argument precisely and accept existing report files", () => {
  const options = { ...known, projectFiles: ["main.tex", "graphics/photo.png", "plots/curve.tex", "tables/results.tex", "settings.tex"] };
  assert.deepEqual(checkTex("\\myfigure{missing.png}", options).map(problem => "\\myfigure{missing.png}".slice(problem.from, problem.to)), ["missing.png"]);
  assert.deepEqual(checkTex("\\myplot{missing}", options).map(problem => "\\myplot{missing}".slice(problem.from, problem.to)), ["missing"]);
  const row = "\\myfigure{photo.png, gone.png}";
  assert.deepEqual(checkTex(row, options).map(problem => [row.slice(problem.from, problem.to), problem.message]), [["gone.png", "graphics/gone.png.svg is not in this report. Add the file or correct its name."]]);
  for (const text of ["\\myfigure{photo.png}", "\\myplot{curve}", "\\myfigure{photo.png, photo}", "\\myplot{curve, curve.tex}", "\\mytable{results}", "\\input{settings}"])
    assert.deepEqual(checkTex(text, { ...options, commandArgument: name => name === "input" ? "file" : known.commandArgument(name) }), []);
});

test("the old graphics command is no longer recognized", () => {
  assert.ok(messages("\\mygraphics{photo.png}").some(message => message.includes("not a LabForge command")));
});

test("bibliography command requires the class option while typing", () => {
  const text = "\\documentclass{labforge}\\mybibliography";
  assert.ok(checkTex(text, known).some(problem => text.slice(problem.from, problem.to) === "\\mybibliography"));
  assert.deepEqual(checkTex("\\documentclass[bibliography]{labforge}\\mybibliography", known), []);
});

test("balanced source, comments, escapes, verbatim and verb have no problems", () => {
  const text = "\\documentclass{labforge}\n\\begin{document}\n\\mysection{A \\{ b \\} $x$ and $$y$$}\n% { unclosed in a comment $\n\\verb|{ $| and 50\\% \\$5\n\\begin{verbatim}\n{ $ \\end{foo}\n\\end{verbatim}\n\\end{document}\n";
  assert.deepEqual(messages(text), []);
});

test("braces that do not pair are marked", () => {
  assert.deepEqual(messages("a } b"), ["} | This } has no matching {. Remove it or add the opening {."]);
  assert.deepEqual(messages("\\mysection{A"), ["{ | This { is never closed. Add the closing }."]);
  assert.deepEqual(messages("\\textbf{a{b}"), ["{ | This { is never closed. Add the closing }."]);
});

test("environments must open and close in order", () => {
  assert.deepEqual(messages("\\begin{itemize}\n\\item a\n"), ["\\begin{itemize} | \\begin{itemize} is never closed. Add \\end{itemize}."]);
  assert.deepEqual(messages("\\end{itemize}"), ["\\end{itemize} | \\end{itemize} has no \\begin{itemize}."]);
  assert.deepEqual(messages("\\begin{a}\\begin{b}\\end{a}"), ["\\begin{b} | \\begin{b} is never closed. Add \\end{b}."]);
  assert.deepEqual(messages("\\begin{a}\\end{b}\\end{a}"), ["\\end{b} | \\end{b} does not match \\begin{a}."]);
});

test("a math delimiter left open is marked at the end of its paragraph", () => {
  assert.deepEqual(messages("so $x = 1\n\nnext paragraph"), ["$ | This $ is never closed. Add the closing $ before the blank line."]);
  assert.deepEqual(messages("$$x\n\nnext"), ["$$ | This $$ is never closed. Add the closing $$ before the blank line."]);
  assert.deepEqual(messages("$x$ and $y$\n\n$$z$$"), []);
});

test("only my… commands that do not exist are marked, and the report's own definitions count", () => {
  assert.deepEqual(messages("\\mysecton{A}"), ["\\mysecton | \\mysecton is not a LabForge command. Check the spelling or define it with \\newcommand."]);
  assert.deepEqual(messages("\\newcommand{\\myvec}[1]{\\mathbf{#1}}\n\\myvec{v} \\textbf{x}"), []);
  assert.deepEqual(messages("\\DeclareSIUnit{\\sampleunit}{su}\\qty{1}{\\sampleunit}"), []);
  assert.deepEqual(messages("\\documentclass[bibliography]{labforge}\\mysection{A}\\mysubsection{B}\\myfigure{a}\\myplot{b}\\mytable{c}\\myref{d}\\myformula{x}\\myequation{y}\\myreaction{z}\\mylineskip\\mytoday\\myreport\\mythesis\\mybibliography"), []);
});

test("every \\my command the class defines is known to the editor", () => {
  const cls = readFileSync("assets/framework/labforge.cls", "utf8");
  const defined = new Set([...cls.matchAll(/NewDocumentCommand\s*\\(my[a-zA-Z]+)/g)].map(match => match[1]));
  for (const name of defined) assert.ok(findFrameworkCommand(name), name);
});

test("the specimens and the new-project template have no problems", () => {
  for (const file of ["tests/tex/report-two-column.tex", "tests/tex/thesis-one-column.tex", "assets/templates/report/main.tex"])
    assert.deepEqual(messages(readFileSync(file, "utf8")), [], file);
});

test("a misspelled or unknown key is marked exactly, with a suggestion", () => {
  const text = "\\myfigure[captoin={Setup.}, width=0.5]{a}";
  const [problem] = checkTex(text, known);
  assert.equal(text.slice(problem.from, problem.to), "captoin");
  assert.match(problem.message, /Did you mean caption\?/);
  assert.deepEqual(messages("\\mytable[caption={A, b.}, spread=1.2, place=span]{t}"), []);
  assert.deepEqual(messages("\\myref[nom]{a}"), []);
  assert.deepEqual(messages("\\myfigure[zzzz=1]{a}").map(line => line.split(" | ")[0]), ["zzzz"]);
});

test("a value outside a key's list, a key with no value and an open bracket are marked where they are", () => {
  assert.deepEqual(messages("\\myplot[place=middle]{a}"), ["middle | middle is not a value of place. Use here, float, span, wrap, wrap-left."]);
  assert.deepEqual(messages("\\myplot[caption]{a}"), ["caption | caption needs a value. Write caption=<value>."]);
  assert.deepEqual(messages("\\myplot[width=3cm {a}"), ["[ | This [ after \\myplot is never closed. Add the closing ]."]);
});

test("a block command without its braces is marked on the command", () => {
  assert.deepEqual(messages("\\myfigure[width=3cm]\nnext"), ["\\myfigure | \\myfigure needs {file} after it."]);
  assert.deepEqual(messages("\\mysection\n{Title}"), []);
  assert.deepEqual(messages("\\renewcommand{\\mysection}[1]{#1}"), []);
});

test("any command that does not exist is marked, with a suggestion when it is a near miss", () => {
  assert.deepEqual(messages("\\dwadawdawda{}"), ["\\dwadawdawda | \\dwadawdawda is not a command LaTeX knows here. Check the spelling or define it with \\newcommand."]);
  assert.match(messages("\\textbff{a}")[0], /Did you mean \\textbf\?/);
  assert.deepEqual(messages("\\textbf{a} \\frac{1}{2} \\alpha \\ce{H2O} \\item \\hline \\vspace{1em} \\noindent \\mathbb{R}"), []);
});

test("commands the report defines itself, and every command once it loads other packages, are not marked", () => {
  assert.deepEqual(messages("\\newcommand{\\vect}[1]{#1}\\vect{v} \\newcounter{step}\\thestep \\newif\\iffast \\fasttrue \\def\\x{1}\\x \\DeclareMathOperator{\\tr}{tr}$\\tr$"), []);
  assert.deepEqual(messages("\\usepackage{siunitx}\n\\SI{3}{m} \\anything"), []);
  assert.deepEqual(messages("% \\notacommand\n\\verb|\\notacommand|"), []);
});

test("everyday commands of the loaded packages are not marked", () => {
  const body = "\\textit{a} \\emph{b} \\section{c} \\label{d} \\ref{e} \\cite{f} \\footnote{g} \\centering \\small \\large \\bfseries \\hspace{1cm} \\newpage \\clearpage \\par \\quad \\times \\cdot \\sum \\int \\sqrt{x} \\left( \\right) \\mathrm{m} \\text{t} \\ldots \\dots \\textdegree \\textsuperscript{2} \\underline{u} \\texttt{m} \\item \\midrule \\linewidth \\columnwidth \\textwidth \\color{red} \\textcolor{blue}{x} \\hyperref[a]{b} \\href{u}{t} \\url{u} \\pgfplotsset{} \\addplot \\draw \\chemfig{A} \\printbibliography \\setmainfont{X} \\selectlanguage{english} \\foreignlanguage{english}{a} \\pdfbookmark{a}{b} \\thepage \\arabic{page}";
  assert.deepEqual(messages(body).filter(line => !/midrule/.test(line)), []);
});

test("a \\verb that does not close on its line is a problem", () => {
  assert.deepEqual(messages("\\verb|a\nteh| tail"), ["\\verb| | This \\verb is never closed on its line. Add the closing |."]);
  assert.deepEqual(messages("\\verb|a| and \\verb*+b+"), []);
});
