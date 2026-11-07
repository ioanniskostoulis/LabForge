// Licensed under the GNU General Public License v2 or later. See LICENSE.
// The LaTeX commands that come with a LabForge report besides its own \my… commands: what LaTeX and the packages
// the class loads provide, the packages themselves, and the commands a project defines in main.tex.
// Completion, the editor hover and the Terminal `latex` verb all read them.
import type { FrameworkCommand } from "./framework-commands";

/** A standard or custom command: the same shape as a framework command, plus where it comes from. */
export type TexCommand = FrameworkCommand & { category: string; package: string };

type Row = [syntax: string, description: string, example?: string];

/** A category of standard commands from one source. The name comes from the syntax and the snippet has one `{}` for each `{…}` in it. */
function group(category: string, source: string, rows: Row[]): TexCommand[] {
  return rows.map(([syntax, description, example]) => {
    const name = /^\\([a-zA-Z@]+\*?)/.exec(syntax)![1];
    const stops = (syntax.match(/\{/g) ?? []).length;
    return { name, syntax, description, example: example ?? syntax, keys: [], snippet: `${name}${"{}".repeat(stops)}`, category, package: source };
  });
}

/** The topics of `latex <topic>`, in listing order. */
export const commandCategories = ["structure", "lengths", "spacing", "text", "lists", "references", "math", "symbols", "graphics", "chemistry", "units", "tables"] as const;

export const standardCommands: readonly TexCommand[] = [
  ...group("structure", "LaTeX", [
    ["\\section{<title>}", "A numbered section; \\mysection follows the report's style", "\\section{Method}"],
    ["\\subsection{<title>}", "A subsection"],
    ["\\subsubsection{<title>}", "A subsubsection"],
    ["\\chapter{<title>}", "A chapter"],
    ["\\paragraph{<title>}", "A run-in paragraph heading"],
    ["\\usepackage{<name>}", "Load a package that the report does not load already", "\\usepackage{booktabs}"],
    ["\\input{<file>}", "Read another .tex file here", "\\input{part-two}"],
    ["\\newcommand{<command>}{<definition>}", "Define a command for this report", "\\newcommand{\\sample}{text}"],
  ]),
  ...group("lengths", "LaTeX", [
    ["\\textwidth", "Width of the text block", "\\includegraphics[width=0.5\\textwidth]{a}"],
    ["\\linewidth", "Width of the current line or box", "\\hspace{0.1\\linewidth}"],
    ["\\columnwidth", "Width of one column", "\\parbox{\\columnwidth}{…}"],
    ["\\textheight", "Height of the text block"],
    ["\\paperwidth", "Width of the paper"],
    ["\\paperheight", "Height of the paper"],
    ["\\baselineskip", "Distance between two lines of text"],
    ["\\parindent", "Indent of the first line of a paragraph"],
    ["\\parskip", "Space between paragraphs"],
    ["\\columnsep", "Space between columns"],
  ]),
  ...group("spacing", "LaTeX", [
    ["\\noindent", "Start a paragraph without its indent"],
    ["\\indent", "Start a paragraph with its indent"],
    ["\\par", "End a paragraph"],
    ["\\newline", "Break the line"],
    ["\\newpage", "Start a new column or page"],
    ["\\clearpage", "Start a new page after placing floats"],
    ["\\pagebreak", "Break the page here if it is allowed"],
    ["\\nopagebreak", "Do not break the page here"],
    ["\\hspace{<length>}", "Horizontal space", "\\hspace{1em}"],
    ["\\vspace{<length>}", "Vertical space", "\\vspace{0.5\\baselineskip}"],
    ["\\hfill", "Stretch the space to fill the line"],
    ["\\vfill", "Stretch the space to fill the page"],
    ["\\quad", "Space of one em"],
    ["\\qquad", "Space of two ems"],
    ["\\smallskip", "Small vertical space"],
    ["\\medskip", "Medium vertical space"],
    ["\\bigskip", "Big vertical space"],
    ["\\phantom{<text>}", "Leave the space of the text, empty"],
    ["\\hphantom{<text>}", "Leave the width of the text, empty"],
    ["\\vphantom{<text>}", "Leave the height of the text, empty"],
    ["\\centering", "Centre the text that follows"],
    ["\\raggedright", "Set the text that follows ragged right"],
    ["\\raggedleft", "Set the text that follows ragged left"],
  ]),
  ...group("text", "LaTeX", [
    ["\\textbf{<text>}", "Bold text", "\\textbf{important}"],
    ["\\textit{<text>}", "Italic text"],
    ["\\emph{<text>}", "Emphasised text, which turns upright inside italic"],
    ["\\underline{<text>}", "Underlined text"],
    ["\\texttt{<text>}", "Monospace text", "\\texttt{main.tex}"],
    ["\\textsc{<text>}", "Small capitals"],
    ["\\textsf{<text>}", "Sans-serif text"],
    ["\\textrm{<text>}", "Roman text"],
    ["\\textsuperscript{<text>}", "Superscript text", "m\\textsuperscript{2}"],
    ["\\textsubscript{<text>}", "Subscript text"],
    ["\\footnote{<text>}", "A footnote", "text\\footnote{A note.}"],
    ["\\footnotesize", "Footnote-sized text from here"],
    ["\\small", "Small text from here"],
    ["\\large", "Large text from here"],
    ["\\Large", "Larger text from here"],
    ["\\tiny", "Tiny text from here"],
    ["\\normalsize", "Normal-sized text from here"],
    ["\\textcolor{<colour>}{<text>}", "Coloured text (xcolor)", "\\textcolor{red}{warning}"],
    ["\\color{<colour>}", "Colour the text that follows (xcolor)"],
    ["\\definecolor{<name>}{<model>}{<value>}", "Define a colour (xcolor)", "\\definecolor{accent}{HTML}{8A2B24}"],
    ["\\url{<address>}", "A web address as a link", "\\url{https://example.org}"],
    ["\\href{<address>}{<text>}", "Text as a link", "\\href{https://example.org}{the site}"],
    ["\\textdegree", "The degree sign"],
    ["\\ldots", "Three dots in text"],
  ]),
  ...group("lists", "LaTeX", [
    ["\\begin{<name>}", "Start an environment", "\\begin{itemize}"],
    ["\\end{<name>}", "End an environment"],
    ["\\item", "A list entry in itemize, enumerate or description", "\\item first"],
    ["\\setlist{<options>}", "List spacing and labels (enumitem)", "\\setlist{itemsep=0pt}"],
  ]),
  ...group("references", "LaTeX", [
    ["\\label{<name>}", "Name a place so it can be referred to", "\\label{eq:energy}"],
    ["\\ref{<name>, …}", "The linked numbers of one or more labelled places"],
    ["\\pageref{<name>}", "The page of a labelled place"],
    ["\\eqref{<name>}", "The number of an equation, in brackets (amsmath)"],
    ["\\cite{<key>}", "Cite a source from references.bib", "\\cite{smith2020}"],
    ["\\nocite{<key>}", "List a source without citing it"],
    ["\\caption{<text>}", "A caption for a float"],
  ]),
  ...group("math", "amsmath", [
    ["\\frac{<top>}{<bottom>}", "A fraction", "\\frac{a}{b}"],
    ["\\dfrac{<top>}{<bottom>}", "A fraction at display size"],
    ["\\sqrt{<expression>}", "A square root", "\\sqrt{x^2 + y^2}"],
    ["\\binom{<n>}{<k>}", "A binomial coefficient"],
    ["\\sum", "A sum sign", "\\sum_{i=1}^{n} x_i"],
    ["\\prod", "A product sign"],
    ["\\int", "An integral sign", "\\int_0^1 f(x)\\,dx"],
    ["\\oint", "A contour integral sign"],
    ["\\lim", "A limit", "\\lim_{x \\to 0}"],
    ["\\partial", "A partial derivative sign"],
    ["\\nabla", "The nabla operator"],
    ["\\infty", "Infinity"],
    ["\\left", "A bracket that grows with its content", "\\left( \\frac{a}{b} \\right)"],
    ["\\right", "The closing bracket that grows with its content"],
    ["\\text{<text>}", "Ordinary text inside a formula", "x = 1 \\text{ if } y > 0"],
    ["\\mathrm{<text>}", "Upright text in a formula", "\\mathrm{d}x"],
    ["\\mathbf{<text>}", "Bold in a formula"],
    ["\\mathit{<text>}", "Italic in a formula"],
    ["\\mathbb{<text>}", "Blackboard bold, such as the real numbers", "\\mathbb{R}"],
    ["\\mathcal{<text>}", "Calligraphic letters"],
    ["\\vec{<symbol>}", "A vector arrow"],
    ["\\hat{<symbol>}", "A hat"],
    ["\\bar{<symbol>}", "A bar"],
    ["\\dot{<symbol>}", "A time derivative dot"],
    ["\\overline{<expression>}", "A line over an expression"],
    ["\\cdot", "A centred dot"],
    ["\\times", "A multiplication cross"],
    ["\\pm", "Plus or minus"],
    ["\\leq", "Less than or equal to"],
    ["\\geq", "Greater than or equal to"],
    ["\\neq", "Not equal to"],
    ["\\approx", "Approximately equal to"],
    ["\\equiv", "Identical to"],
    ["\\propto", "Proportional to"],
    ["\\to", "A right arrow"],
    ["\\Rightarrow", "An implication arrow"],
    ["\\leftrightarrow", "A double-headed arrow"],
  ]),
  ...group("symbols", "LaTeX", [
    ["\\alpha", "Greek letter alpha"], ["\\beta", "Greek letter beta"], ["\\gamma", "Greek letter gamma"], ["\\delta", "Greek letter delta"],
    ["\\epsilon", "Greek letter epsilon"], ["\\theta", "Greek letter theta"], ["\\lambda", "Greek letter lambda"], ["\\mu", "Greek letter mu"],
    ["\\pi", "Greek letter pi"], ["\\rho", "Greek letter rho"], ["\\sigma", "Greek letter sigma"], ["\\tau", "Greek letter tau"],
    ["\\phi", "Greek letter phi"], ["\\omega", "Greek letter omega"], ["\\Delta", "Capital Greek letter delta"], ["\\Omega", "Capital Greek letter omega"],
    ["\\Sigma", "Capital Greek letter sigma"],
    ["\\textbackslash", "A backslash in text"],
    ["\\cdots", "Centred dots in a formula"],
    ["\\dots", "Dots on the line, or centred in a formula"],
  ]),
  ...group("graphics", "graphicx", [
    ["\\includegraphics{<file>}", "Place an image; \\myfigure adds a caption and a number", "\\includegraphics[width=5cm]{setup.png}"],
    ["\\scalebox{<factor>}{<content>}", "Scale content", "\\scalebox{0.8}{…}"],
    ["\\rotatebox{<angle>}{<content>}", "Rotate content", "\\rotatebox{90}{…}"],
    ["\\resizebox{<width>}{<height>}{<content>}", "Resize content to a width and height", "\\resizebox{\\linewidth}{!}{…}"],
  ]),
  ...group("graphics", "pgfplots", [
    ["\\addplot", "Add a data series to a plot (pgfplots)", "\\addplot[mark=*] coordinates {(0,0) (1,1)};"],
    ["\\addlegendentry{<text>}", "A legend entry for the last series (pgfplots)"],
  ]),
  ...group("chemistry", "mhchem", [
    ["\\ce{<formula>}", "A chemical formula or equation", "\\ce{2H2 + O2 -> 2H2O}"],
  ]),
  ...group("chemistry", "chemfig", [
    ["\\chemfig{<structure>}", "A structural formula", "\\chemfig{*6(-=-=-=)}"],
  ]),
  // siunitx v3 public commands from https://mirrors.ctan.org/macros/latex/contrib/siunitx/siunitx.pdf
  ...group("units", "siunitx", [
    ["\\num{<number>}", "Format a number or scientific notation", "\\num{1.23e-4}"],
    ["\\unit{<unit>}", "Format a unit without a number", "\\unit{\\milli\\mole\\per\\litre}"],
    ["\\qty{<number>}{<unit>}", "Format a quantity with its unit", "\\qty{2.5}{\\milli\\mole\\per\\litre}"],
    ["\\ang{<angle>}", "Format an angle", "\\ang{30;15;0}"],
    ["\\numlist{<numbers>}", "Format a list of numbers", "\\numlist{1;2;3}"],
    ["\\numrange{<first>}{<last>}", "Format a range of numbers", "\\numrange{1}{10}"],
    ["\\qtylist{<numbers>}{<unit>}", "Format a list of quantities", "\\qtylist{2;4;6}{\\metre}"],
    ["\\qtyrange{<first>}{<last>}{<unit>}", "Format a range of quantities", "\\qtyrange{2}{4}{\\metre}"],
    ["\\sisetup{<options>}", "Set number and unit formatting for the report", "\\sisetup{per-mode=symbol}"],
    ["\\DeclareSIUnit{<command>}{<unit>}", "Define a unit command", "\\DeclareSIUnit{\\sampleunit}{su}"],
    ["\\tablenum{<number>}", "Format a number in a table cell", "\\tablenum{1.23e-4}"],
    ["\\metre", "Metre unit symbol"], ["\\second", "Second unit symbol"], ["\\gram", "Gram unit symbol"],
    ["\\litre", "Litre unit symbol"], ["\\mole", "Mole unit symbol"], ["\\kelvin", "Kelvin unit symbol"],
    ["\\joule", "Joule unit symbol"],
    ["\\ampere", "Ampere unit symbol"], ["\\volt", "Volt unit symbol"], ["\\watt", "Watt unit symbol"],
    ["\\pascal", "Pascal unit symbol"], ["\\degreeCelsius", "Degree Celsius unit symbol"],
    ["\\milli", "Milli prefix"], ["\\micro", "Micro prefix"], ["\\kilo", "Kilo prefix"],
    ["\\per", "Divide by the following unit"], ["\\squared", "Square the preceding unit"], ["\\cubed", "Cube the preceding unit"],
  ]),
  ...group("units", "LabForge", [
    ["\\atm", "Atmosphere unit symbol"], ["\\mmHg", "Millimetres of mercury unit symbol"], ["\\torr", "Torr unit symbol"],
  ]),
  // Optional booktabs commands from https://mirrors.ctan.org/macros/latex/contrib/booktabs/booktabs.pdf
  ...group("tables", "booktabs", [
    ["\\toprule", "Draw a top rule in a table"],
    ["\\midrule", "Draw a rule between the table header and rows"],
    ["\\bottomrule", "Draw a bottom rule in a table"],
    ["\\cmidrule{<columns>}", "Draw a rule below selected columns", "\\cmidrule{2-3}"],
    ["\\addlinespace", "Add space between table rows"],
    ["\\specialrule{<width>}{<above>}{<below>}", "Draw a rule with custom width and spacing"],
  ]),
];

/** A package the report class loads for every report. */
export interface PackageEntry { name: string; description: string; gives: string }

export const preloadedPackages: readonly PackageEntry[] = [
  { name: "amsmath", description: "Mathematics environments and symbols", gives: "align, \\text, \\binom, \\eqref" },
  { name: "biblatex", description: "Bibliography with biber, numbered; loaded with the bibliography option", gives: "\\cite, \\mybibliography" },
  { name: "chemfig", description: "Structural formulas", gives: "\\chemfig" },
  { name: "enumitem", description: "Control of list spacing and labels", gives: "\\setlist, [itemsep=0pt]" },
  { name: "fancyhdr", description: "Running headers, set by the header key", gives: "the page header" },
  { name: "footmisc", description: "Footnotes at the foot of the page", gives: "the footnote position" },
  { name: "fontspec", description: "Fonts by name or file", gives: "\\setmainfont, \\setmonofont" },
  { name: "geometry", description: "Page margins, set by the margin key", gives: "the text block" },
  { name: "graphicx", description: "Images and scaling", gives: "\\includegraphics, \\scalebox, \\rotatebox" },
  { name: "hyperref", description: "Links and PDF bookmarks", gives: "\\url, \\href" },
  { name: "mhchem", description: "Chemical formulas and equations", gives: "\\ce" },
  { name: "microtype", description: "Fine spacing at the margins", gives: "even line ends" },
  { name: "multicol", description: "Text in columns", gives: "the multicols environment" },
  { name: "pgfplots", description: "Plots, with TikZ and its calc library", gives: "\\addplot, axis options" },
  { name: "polyglossia", description: "Languages and hyphenation", gives: "Greek and English" },
  { name: "setspace", description: "Line spread", gives: "\\setstretch, \\onehalfspacing" },
  { name: "siunitx", description: "Numbers and physical units", gives: "\\qty, \\unit, \\num" },
  { name: "unicode-math", description: "Mathematics fonts and Unicode symbols", gives: "\\symbf, \\symbb" },
  { name: "xcolor", description: "Colours", gives: "\\textcolor, \\color, \\definecolor" },
];

/* The commands a project defines. */

const definers = /\\(?:newcommand|renewcommand|providecommand|NewDocumentCommand|RenewDocumentCommand|ProvideDocumentCommand|DeclareDocumentCommand|DeclareMathOperator\*?|NewExpandableDocumentCommand|DeclareSIUnit)\*?\s*(?:\{\s*\\([a-zA-Z@]+)\s*\}|\\([a-zA-Z@]+))/g;

/** The text of the first `{…}` group at or after `from`, with where it ends, or `null`. */
function braced(text: string, from: number): { body: string; end: number } | null {
  const open = text.indexOf("{", from);
  if (open < 0) return null;
  let depth = 0;
  for (let at = open; at < text.length; at++) {
    if (text[at] === "\\") { at++; continue; }
    if (text[at] === "{") depth++;
    else if (text[at] === "}" && --depth === 0) return { body: text.slice(open + 1, at), end: at + 1 };
  }
  return null;
}

/** The comment lines (`% …`) directly above `index`, as one sentence of description. */
function commentAbove(text: string, index: number): string {
  const lines = text.slice(0, index).split("\n");
  lines.pop();
  const found: string[] = [];
  for (let at = lines.length - 1; at >= 0 && /^\s*%/.test(lines[at]); at--) found.unshift(lines[at].replace(/^\s*%+\s?/, "").trim());
  return found.join(" ").trim();
}

/**
 * The commands defined in `text` with \newcommand, \renewcommand, \providecommand, \NewDocumentCommand and friends, or \DeclareMathOperator.
 * The comment lines just above a definition are its description; the number of arguments gives the snippet's braces.
 */
export function parseCustomCommands(text: string, file = "main.tex"): TexCommand[] {
  const found = new Map<string, TexCommand>();
  for (const match of text.matchAll(definers)) {
    // A definition inside a comment is not one.
    const lineStart = text.lastIndexOf("\n", match.index!) + 1;
    if (/(?:^|[^\\])%/.test(text.slice(lineStart, match.index!))) continue;
    const name = match[1] ?? match[2];
    const after = match.index! + match[0].length;
    const definer = /\\([A-Za-z]+)/.exec(match[0])![1];
    let count = 0;
    let signature = "";
    if (/Document/.test(definer)) {
      const spec = braced(text, after);
      if (spec) { count = (spec.body.match(/[mM](?![a-z])|[mM]\b/g) ?? []).length; signature = spec.body; }
    } else if (/DeclareMathOperator|DeclareSIUnit/.test(definer)) {
      count = 0;
    } else {
      const given = /^\s*\[\s*(\d)\s*\]/.exec(text.slice(after));
      count = given ? Number(given[1]) : 0;
    }
    const description = commentAbove(text, match.index!) || (definer === "DeclareSIUnit" ? "A unit defined by this report" : "A command of this report");
    const optional = /[oO]/.test(signature) || /^\s*\[\s*\d\s*\]\s*\[/.test(text.slice(after));
    const syntax = `\\${name}${optional ? "[<option>]" : ""}${Array.from({ length: count }, (_, index) => `{<#${index + 1}>}`).join("")}`;
    found.set(name, { name, syntax, description, example: syntax, keys: [], snippet: `${name}${"{}".repeat(count)}`, category: "custom", package: file });
  }
  return [...found.values()];
}

/** The definition `latex new` and the New command form write: a comment for the description, then \newcommand. */
export function commandDefinition(name: string, args: number, body: string, description: string): string {
  return `${description.trim() ? `% ${description.trim().replace(/\s+/g, " ")}\n` : ""}\\newcommand{\\${name}}${args ? `[${args}]` : ""}{${body.trim()}}\n`;
}

/** Why a new command's name, argument count or body cannot be used, or `null`. `taken` is the names already in use. */
export function commandProblem(name: string, args: string, body: string, taken: (name: string) => boolean): string | null {
  if (!/^[A-Za-z]+$/.test(name)) return "A command name has letters only, such as vect.";
  if (taken(name)) return `\\${name} already exists.`;
  if (!/^[0-9]$/.test(args)) return "Arguments are a number from 0 to 9.";
  if (!body.trim()) return "Write what the command does.";
  const used = [...body.matchAll(/#(\d)/g)].map(match => Number(match[1]));
  if (used.some(number => number < 1 || number > Number(args))) return `The body uses #${Math.max(...used)} but the command has ${args} ${args === "1" ? "argument" : "arguments"}.`;
  let depth = 0;
  for (const char of body.replace(/\\./g, "")) { depth += char === "{" ? 1 : char === "}" ? -1 : 0; if (depth < 0) break; }
  if (depth !== 0) return "The braces in the body do not match.";
  return null;
}
