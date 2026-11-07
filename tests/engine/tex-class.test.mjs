// Licensed under the GNU General Public License v2 or later. See LICENSE.
// Builds the specimen documents in tests/tex with assets/framework/labforge.cls, the way a project builds
// without the app: the class next to the document and a plain latexmk run.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";

const texbin = ["/Library/TeX/texbin", "/opt/homebrew/bin", "/usr/local/bin"].find(dir => existsSync(join(dir, "latexmk")));
const env = { ...process.env, ...(texbin ? { PATH: `${texbin}${delimiter}${process.env.PATH ?? ""}` } : {}) };
const installed = !spawnSync("latexmk", ["-v"], { env }).error && !spawnSync("xelatex", ["--version"], { env }).error;

function build(name) {
  const folder = mkdtempSync(join(tmpdir(), "labforge-class-"));
  cpSync("tests/tex", folder, { recursive: true });
  cpSync("assets/framework/labforge.cls", join(folder, ".labforge.cls"));
  cpSync("assets/templates/report/settings.tex", join(folder, ".settings.tex"));
  const run = spawnSync("latexmk", ["-xelatex", "-interaction=nonstopmode", "-halt-on-error", `${name}.tex`],
    { cwd: folder, env, encoding: "utf8", timeout: 240_000 });
  return { status: run.status, log: readFileSync(join(folder, `${name}.log`), "utf8"), pdf: join(folder, `${name}.pdf`) };
}

// Font substitution notes from fontspec are expected; anything else is a defect in the class.
function problems(log) {
  return log.split(/\r?\n/).filter(line => /^!|Warning|Overfull|Underfull|undefined|multiply defined|^(?:LaTeX|Package|Class) .*Warning:/.test(line))
    .filter(line => !/Font shape|fontspec/.test(line));
}

for (const name of ["report-two-column", "thesis-one-column", "caption-keys"]) {
  test(`${name} builds without errors, warnings or overfull lines`, { timeout: 300_000 }, t => {
    if (!installed) return t.skip("XeLaTeX and latexmk are not installed");
    const result = build(name);
    assert.equal(result.status, 0, problems(result.log).join("\n"));
    assert.deepEqual(problems(result.log), []);
    assert.ok(existsSync(result.pdf));
  });
}

test("individual margins and scientific number defaults work in a report", { timeout: 120_000 }, t => {
  if (!installed) return t.skip("XeLaTeX and latexmk are not installed");
  const folder = mkdtempSync(join(tmpdir(), "labforge-units-margins-"));
  cpSync("assets/framework/labforge.cls", join(folder, ".labforge.cls"));
  writeFileSync(join(folder, "main.tex"), String.raw`\documentclass[language=english]{.labforge}
\labforgesetup{margin=1in, margin-left=2in, margin-right=0.7in, margin-top=1.2in, margin-bottom=1.4in}
\begin{document}
\typeout{LF-LEFT:\the\dimexpr1in+\oddsidemargin\relax}
\num{12345} \qty{1}{\atm} \qty{2}{\mmHg} \qty{3}{\torr}.
\end{document}
`);
  const run = spawnSync("latexmk", ["-xelatex", "-interaction=nonstopmode", "-halt-on-error", "main.tex"], { cwd: folder, env, encoding: "utf8", timeout: 120_000 });
  assert.equal(run.status, 0, run.stdout.slice(-1500));
  assert.match(readFileSync(join(folder, "main.log"), "utf8"), /LF-LEFT:144\.54pt/);
  if (!spawnSync("pdftotext", ["-v"]).error) {
    const pdfText = spawnSync("pdftotext", [join(folder, "main.pdf"), "-"], { encoding: "utf8" }).stdout;
    assert.match(pdfText, /12345 1 atm 2 mmHg 3 Torr/);
  }
});

test("a style added in settings.tex applies its values without changing the class", { timeout: 300_000 }, t => {
  if (!installed) return t.skip("XeLaTeX and latexmk are not installed");
  const folder = mkdtempSync(join(tmpdir(), "labforge-custom-style-"));
  cpSync("assets/framework/labforge.cls", join(folder, ".labforge.cls"));
  writeFileSync(join(folder, ".settings.tex"), `${readFileSync("assets/templates/report/settings.tex", "utf8")}\n\\labforgepreset{poster}{line-spread=2.0}\n`);
  writeFileSync(join(folder, "main.tex"), "\\documentclass[preset=poster,language=english]{.labforge}\n\\ExplSyntaxOn\\typeout{LABFORGE-SPREAD:\\tl_use:N \\l_lf_spread_tl}\\ExplSyntaxOff\n\\begin{document}Hello.\\end{document}\n");
  const run = spawnSync("latexmk", ["-xelatex", "-interaction=nonstopmode", "-halt-on-error", "main.tex"], { cwd: folder, env, encoding: "utf8", timeout: 120_000 });
  assert.equal(run.status, 0, run.stdout.slice(-1500));
  assert.match(readFileSync(join(folder, "main.log"), "utf8"), /LABFORGE-SPREAD:2\.0/);
  writeFileSync(join(folder, "main.tex"), "\\documentclass[preset=missing,language=english]{.labforge}\n\\begin{document}Hello.\\end{document}\n");
  const missing = spawnSync("xelatex", ["-interaction=nonstopmode", "-halt-on-error", "main.tex"], { cwd: folder, env, encoding: "utf8", timeout: 120_000 });
  assert.notEqual(missing.status, 0);
  assert.match(missing.stdout, /Unknown preset/);
});

test("references name their kind in the language and case, and long tables repeat their header", { timeout: 300_000 }, t => {
  if (!installed) return t.skip("XeLaTeX and latexmk are not installed");
  if (spawnSync("pdftotext", ["-v"]).error) return t.skip("pdftotext is not installed");
  // Page-number footers are dropped, so a phrase that runs onto the next page is still found.
  const text = pdf => spawnSync("pdftotext", ["-raw", pdf, "-"], { encoding: "utf8" }).stdout.replace(/\n\d+\n?\f/g, "\n").replace(/\s+/g, " ");
  const greek = text(build("report-two-column").pdf);
  for (const text of ["Σχήμα 1.1", "Σχήματα 1.1 και 1.2", "Αντίδραση R1.1", "Σχέση 1.1", "στον Πίνακα 1.1", "Ο Πίνακας 1.1", "του Πίνακα 2.1", "Ενότητα II", "Ενότητες I και I.I", "Πίνακα 1.1 και Αντίδραση R1.1", "Πίνακας 1.1 και Αντίδραση R1.1"])
    assert.ok(greek.includes(text), text);
  // The 45-row table continues in another column with its header repeated.
  assert.ok(greek.split("Sample Mass (g) Time (min) Yield (%)").length > 2, "repeated table header");
  const english = text(build("thesis-one-column").pdf);
  for (const text of ["Figure 1", "Reaction R1", "Equations 1 and 2", "Table 1 and Figure 1", "Table 1 and Reaction R1", "Equation 1 and Reaction R1", "Section I"])
    assert.ok(english.includes(text), text);
});

test("formula rows number independently and base references list the group", { timeout: 300_000 }, t => {
  if (!installed) return t.skip("XeLaTeX and latexmk are not installed");
  if (spawnSync("pdftotext", ["-v"]).error) return t.skip("pdftotext is not installed");
  const englishBuild = build("formula-groups");
  assert.equal(englishBuild.status, 0, problems(englishBuild.log).join("\n"));
  assert.deepEqual(problems(englishBuild.log), []);
  const english = spawnSync("pdftotext", ["-raw", englishBuild.pdf, "-"], { encoding: "utf8" }).stdout.replace(/\s+/g, " ");
  for (const text of ["Equations 1 and 2", "Equation 2", "The selected numbers are 1 and 2", "Equations 3 and 4", "Equation 5"])
    assert.ok(english.includes(text), text);
  const greekBuild = build("formula-groups-greek");
  assert.equal(greekBuild.status, 0, problems(greekBuild.log).join("\n"));
  assert.deepEqual(problems(greekBuild.log), []);
  const greek = spawnSync("pdftotext", ["-raw", greekBuild.pdf, "-"], { encoding: "utf8" }).stdout.replace(/\s+/g, " ");
  for (const text of ["Σχέσεις 1, 2 και 3", "Σχέση 2", "Οι αριθμοί είναι 1, 2 και 3", "Σχέσεις 4 και 5"])
    assert.ok(greek.includes(text), text);
});

test("side-by-side figures take subcaptions only when given, and their parts are referenced by letter", { timeout: 300_000 }, t => {
  if (!installed) return t.skip("XeLaTeX and latexmk are not installed");
  if (spawnSync("pdftotext", ["-v"]).error) return t.skip("pdftotext is not installed");
  const result = build("side-figures");
  assert.equal(result.status, 0, problems(result.log).join("\n"));
  assert.deepEqual(problems(result.log), []);
  const text = spawnSync("pdftotext", ["-raw", result.pdf, "-"], { encoding: "utf8" }).stdout.replace(/\s+/g, " ");
  for (const part of ["in Figure 1.1;", "Figure 1.1b,", "Figures 1.1a and 1.1b", "bare number is 1.1a.", "Figure 1.3b", "Figure 1.4a",
    "(a) Before (b) After, cleaned", "(a) Only the first (b)", "(a) Raw", "(b) Fitted", "Figure 1.4: The same plot twice."])
    assert.ok(text.includes(part), part);
  assert.doesNotMatch(text.split("Figure 1.1: ")[1].split("Figure 1.2: ")[0], /\(a\)/, "no letters without subcaption");
});

test("side-by-side figures in Greek use Latin letters, work in and across columns, and warn about keys they cannot use", { timeout: 120_000 }, t => {
  if (!installed) return t.skip("XeLaTeX and latexmk are not installed");
  const folder = mkdtempSync(join(tmpdir(), "labforge-side-"));
  cpSync("assets/framework/labforge.cls", join(folder, ".labforge.cls"));
  writeFileSync(join(folder, "main.tex"), String.raw`\documentclass[language=greek]{.labforge}
\begin{document}
Βλέπε \myref{fig:pair[2]} και \myref{fig:pair[1], fig:pair[2]}.
\myfigure[label=fig:pair, caption=Δύο., subcaption={α, β, γ}]{example-image-a.png, example-image-b.png}
\myfigure[subcaption=Μία.]{example-image-a.png}
\myfigure[width=0.7]{example-image-a.png, example-image-b.png}
\myfigure[place=wrap]{example-image-a.png, example-image-b.png}
\begin{multicols}{2}
Στη στήλη: \myref{fig:views[2]}. Σε όλο το πλάτος: \myref{fig:three}.
\myfigure[label=fig:views, caption=Δύο όψεις., subcaption={Πάνω, Πλάγια}]{example-image-b.png, example-image-c.png}
\myfigure[label=fig:three, place=span, caption=Τρεις.]{example-image-a.png, example-image-b.png, example-image-c.png}
Κείμενο μετά.
\end{multicols}
\end{document}
`);
  const run = spawnSync("latexmk", ["-xelatex", "-interaction=nonstopmode", "-halt-on-error", "main.tex"], { cwd: folder, env, encoding: "utf8", timeout: 120_000 });
  assert.equal(run.status, 0, run.stdout.slice(-1500));
  const log = readFileSync(join(folder, "main.log"), "utf8").replace(/\n\(labforge\)\s+/g, " ");
  assert.match(log, /\\myfigure has 3 subcaptions for 2 files; the extra ones are ignored\./);
  assert.match(log, /\\myfigure shows one file, so subcaption is ignored\./);
  assert.match(log, /The 2 images in this row are wider than the line together, so they are scaled to fit\./);
  assert.match(log, /place=wrap works for one figure or plot; this row is placed here\./);
  if (!spawnSync("pdftotext", ["-v"]).error) {
    const text = spawnSync("pdftotext", ["-raw", join(folder, "main.pdf"), "-"], { encoding: "utf8" }).stdout.replace(/\s+/g, " ");
    assert.match(text, /Βλέπε Σχήμα 1b και Σχήματα 1a και 1b\./);
    assert.match(text, /Στη στήλη: Σχήμα 2b\. Σε όλο το πλάτος: Σχήμα 3\./);
  }
});

test("a heading after a figure or formula has the same space before it as after text", { timeout: 120_000 }, t => {
  if (!installed) return t.skip("XeLaTeX and latexmk are not installed");
  if (spawnSync("pdftotext", ["-v"]).error) return t.skip("pdftotext is not installed");
  const folder = mkdtempSync(join(tmpdir(), "labforge-heading-gap-"));
  cpSync("assets/framework/labforge.cls", join(folder, ".labforge.cls"));
  cpSync("tests/tex/tables", join(folder, "tables"), { recursive: true });
  writeFileSync(join(folder, "main.tex"), String.raw`\documentclass[language=english]{.labforge}
\begin{document}
Textlineabove.
\mysubsection{Afterext}
\myfigure[caption=Captionlast., width=0.2]{example-image-a.png}
\mysubsection{Afterfigure}
\myformula{x = y}
\mysubsection{Afterformula}
\end{document}
`);
  const run = spawnSync("latexmk", ["-xelatex", "-interaction=nonstopmode", "-halt-on-error", "main.tex"], { cwd: folder, env, encoding: "utf8", timeout: 120_000 });
  assert.equal(run.status, 0, run.stdout.slice(-1500));
  const html = spawnSync("pdftotext", ["-bbox", join(folder, "main.pdf"), "-"], { encoding: "utf8" }).stdout;
  const bottom = word => Number(new RegExp(`yMax="([\\d.]+)"[^>]*>${word}<`).exec(html)?.[1]);
  const textGap = bottom("Afterext") - bottom("Textlineabove.");
  assert.ok(Math.abs(bottom("Afterfigure") - bottom("Captionlast.") - textGap) < 1, `figure ${bottom("Afterfigure") - bottom("Captionlast.")} vs text ${textGap}`);
  const formula = /yMax="([\d.]+)"[^>]*>\(1\)</.exec(html)?.[1];
  assert.ok(bottom("Afterformula") - Number(formula) <= textGap + 1, `formula ${bottom("Afterformula") - Number(formula)} vs text ${textGap}`);
});

test("captions align by kind and their line spacing follows the line spread", { timeout: 120_000 }, t => {
  if (!installed) return t.skip("XeLaTeX and latexmk are not installed");
  if (spawnSync("pdftotext", ["-v"]).error) return t.skip("pdftotext is not installed");
  const folder = mkdtempSync(join(tmpdir(), "labforge-caption-kinds-"));
  cpSync("assets/framework/labforge.cls", join(folder, ".labforge.cls"));
  cpSync("tests/tex/tables", join(folder, "tables"), { recursive: true });
  writeFileSync(join(folder, "main.tex"), String.raw`\documentclass[language=english]{.labforge}
\labforgesetup{line-spread=1.6, figure-caption-align=center, table-caption-align=right}
\begin{document}
Bodyone. Bodyfill text runs on long enough to fill the whole first line of this paragraph and continue onto the next one here.
Bodytwo.
\myfigure[caption=Shortcap., width=0.9]{example-image-a.png}
\myfigure[caption=Leftcap., caption-align=left, width=0.9]{example-image-a.png}
\myfigure[caption=Firstline words that are long enough to run onto a second caption line under this wide figure here. Secondline., width=0.9]{example-image-b.png}
\mytable[caption=Tablecap.]{yields.tex}
\end{document}
`);
  const run = spawnSync("latexmk", ["-xelatex", "-interaction=nonstopmode", "-halt-on-error", "main.tex"], { cwd: folder, env, encoding: "utf8", timeout: 120_000 });
  assert.equal(run.status, 0, run.stdout.slice(-1500));
  const html = spawnSync("pdftotext", ["-bbox", join(folder, "main.pdf"), "-"], { encoding: "utf8" }).stdout;
  const box = word => { const m = new RegExp(`xMin="([\\d.]+)" yMin="([\\d.]+)" xMax="([\\d.]+)" yMax="([\\d.]+)">${word}<`).exec(html); return m && m.slice(1).map(Number); };
  const left = Math.min(...[...html.matchAll(/xMin="([\d.]+)"/g)].map(m => Number(m[1]))), right = Math.max(...[...html.matchAll(/xMax="([\d.]+)"/g)].map(m => Number(m[1])));
  const centre = (left + right) / 2, short = box("Shortcap."), figure = box("Figure");
  assert.ok(Math.abs((figure[0] + short[2]) / 2 - centre) < 2, "a figure caption is centred by figure-caption-align");
  assert.ok(box("Leftcap.")[0] < centre - 40, "the block's caption-align wins over figure-caption-align");
  assert.ok(Math.abs(box("Tablecap.")[2] - right) < 2, "a table caption is right-aligned by table-caption-align");
  const body = box("Bodytwo.")[3] - box("Bodyone.")[3], caption = box("Secondline.")[3] - box("Firstline")[3];
  assert.ok(Math.abs(caption / body - 0.75) < 0.02, `caption lines are 0.75 of body lines (${caption} / ${body})`);
});

test("a one-line formula or reaction takes one line of the grid", { timeout: 120_000 }, t => {
  if (!installed) return t.skip("XeLaTeX and latexmk are not installed");
  if (spawnSync("pdftotext", ["-v"]).error) return t.skip("pdftotext is not installed");
  const folder = mkdtempSync(join(tmpdir(), "labforge-math-lines-"));
  cpSync("assets/framework/labforge.cls", join(folder, ".labforge.cls"));
  writeFileSync(join(folder, "main.tex"), String.raw`\documentclass[language=english]{.labforge}
\begin{document}
Lineone fills the first line of this paragraph with enough words to wrap onto a second line of text here.
Linetwo.

\myformula{x = y}

Linethree.

\myreaction{N2 + O2 -> 2NO}

Linefour.
\end{document}
`);
  const run = spawnSync("latexmk", ["-xelatex", "-interaction=nonstopmode", "-halt-on-error", "main.tex"], { cwd: folder, env, encoding: "utf8", timeout: 120_000 });
  assert.equal(run.status, 0, run.stdout.slice(-1500));
  const html = spawnSync("pdftotext", ["-bbox", join(folder, "main.pdf"), "-"], { encoding: "utf8" }).stdout;
  const base = word => Number(new RegExp(`yMax="([\\d.]+)"[^>]*>${word}<`).exec(html)[1]);
  const line = base("Linetwo.") - base("Lineone");
  assert.ok(Math.abs(base("Linethree.") - base("Linetwo.") - 2 * line) < 0.5, "a formula takes one line");
  assert.ok(Math.abs(base("Linefour.") - base("Linethree.") - 2 * line) < 0.5, "a reaction takes one line");
});

test("block-snap off gives figures and plots of any height the same space around them, and line keeps the grid", { timeout: 300_000 }, t => {
  if (!installed) return t.skip("XeLaTeX and latexmk are not installed");
  if (spawnSync("pdftotext", ["-v"]).error) return t.skip("pdftotext is not installed");
  const gaps = snap => {
    const folder = mkdtempSync(join(tmpdir(), "labforge-fit-"));
    cpSync("assets/framework/labforge.cls", join(folder, ".labforge.cls"));
    cpSync("tests/tex/plots", join(folder, "plots"), { recursive: true });
    const blocks = [0.31, 0.37, 0.43, 0.49].map((width, index) => String.raw`Beforetext${index}.

\myfigure[caption=Capfig${index}., width=${width}]{example-image-a.png}

Aftertext${index}.

`).join("\n") + String.raw`Beforetext4.

\myplot[caption=Capfig4., width=0.5]{absorbance.tex}

Aftertext4.

`;
    writeFileSync(join(folder, "main.tex"), String.raw`\documentclass[language=english]{.labforge}
\labforgesetup{block-snap=${snap}}
\begin{document}
${blocks}\end{document}
`);
    const run = spawnSync("latexmk", ["-xelatex", "-interaction=nonstopmode", "-halt-on-error", "main.tex"], { cwd: folder, env, encoding: "utf8", timeout: 240_000 });
    assert.equal(run.status, 0, run.stdout.slice(-1500));
    const html = spawnSync("pdftotext", ["-bbox", join(folder, "main.pdf"), "-"], { encoding: "utf8" }).stdout;
    const pages = html.split("<page ");
    const at = word => { const page = pages.findIndex(text => text.includes(`>${word}<`)); return [page, Number(new RegExp(`yMax="([\\d.]+)"[^>]*>${word}<`).exec(pages[page])[1])]; };
    return [0, 1, 2, 3, 4].map(index => { const [page, caption] = at(`Capfig${index}.`), [next, after] = at(`Aftertext${index}.`); return page === next ? after - caption : null; }).filter(gap => gap !== null);
  };
  const exact = gaps("off"), snapped = gaps("line");
  assert.ok(exact.length >= 3, "at least three blocks share a page with the text after them");
  assert.ok(Math.max(...exact) - Math.min(...exact) < 0.3, `gaps with block-snap off: ${exact.join(", ")}`);
  assert.ok(Math.max(...snapped) - Math.min(...snapped) > 2, `snapped to the grid the gaps vary: ${snapped.join(", ")}`);
});

test("a heading stays on the page of a block that follows within its first lines", { timeout: 300_000 }, t => {
  if (!installed) return t.skip("XeLaTeX and latexmk are not installed");
  if (spawnSync("pdftotext", ["-v"]).error) return t.skip("pdftotext is not installed");
  const folder = mkdtempSync(join(tmpdir(), "labforge-keep-heading-"));
  cpSync("assets/framework/labforge.cls", join(folder, ".labforge.cls"));
  const filler = "Filler words fill the line of this paragraph so that each one takes several lines of the page and moves what follows down. ";
  const groups = Array.from({ length: 10 }, (_, index) => String.raw`${filler.repeat(3 + index)}

\mysubsection{Keephead${index}}
One line after the heading.

\myfigure[caption=Keepcap${index}., height=6cm]{example-image-a.png}
`).join("\n");
  writeFileSync(join(folder, "main.tex"), String.raw`\documentclass[language=english]{.labforge}
\begin{document}
${groups}
\end{document}
`);
  const run = spawnSync("latexmk", ["-xelatex", "-interaction=nonstopmode", "-halt-on-error", "main.tex"], { cwd: folder, env, encoding: "utf8", timeout: 240_000 });
  assert.equal(run.status, 0, run.stdout.slice(-1500));
  const pages = spawnSync("pdftotext", [join(folder, "main.pdf"), "-"], { encoding: "utf8" }).stdout.split("\f");
  const page = word => pages.findIndex(text => text.includes(word));
  for (let index = 0; index < 10; index++)
    assert.equal(page(`Keephead${index}`), page(`Keepcap${index}.`), `heading ${index} and its figure share a page`);
});

test("back-to-back blocks add no blank line, and a table keeps its space under it", { timeout: 120_000 }, t => {
  if (!installed) return t.skip("XeLaTeX and latexmk are not installed");
  if (spawnSync("pdftotext", ["-v"]).error) return t.skip("pdftotext is not installed");
  const folder = mkdtempSync(join(tmpdir(), "labforge-block-gap-"));
  cpSync("assets/framework/labforge.cls", join(folder, ".labforge.cls"));
  mkdirSync(join(folder, "tables"));
  writeFileSync(join(folder, "tables", "small.tex"), String.raw`\begin{labtable}{l r}
\tablehead{Name & Value}
Lastrow & 1 \\
\end{labtable}
`);
  writeFileSync(join(folder, "main.tex"), String.raw`\documentclass[language=english]{.labforge}
\begin{document}
Lineone fills the first line of this paragraph with enough words to wrap onto a second line of text here.
Linetwo.

\myformula{a = b}

\myformula{c = d}

\mytable{small.tex}

\myformula{e = f}

Linethree.
\end{document}
`);
  const run = spawnSync("latexmk", ["-xelatex", "-interaction=nonstopmode", "-halt-on-error", "main.tex"], { cwd: folder, env, encoding: "utf8", timeout: 120_000 });
  assert.equal(run.status, 0, run.stdout.slice(-1500));
  const html = spawnSync("pdftotext", ["-bbox", join(folder, "main.pdf"), "-"], { encoding: "utf8" }).stdout;
  const base = word => Number(new RegExp(`yMax="([\\d.]+)"[^>]*>${word.replace(/[()]/g, "\\$&")}<`).exec(html)[1]);
  const line = base("Linetwo.") - base("Lineone");
  assert.ok(Math.abs(base("(2)") - base("(1)") - line) < 0.5, "two formulas in a row are one line apart");
  assert.ok(base("(3)") - base("Lastrow") > 1.7 * line, "a formula after a table keeps the table's space");
});

test("a tall formula gets math-gap below, and above only after a line that runs over it", { timeout: 120_000 }, t => {
  if (!installed) return t.skip("XeLaTeX and latexmk are not installed");
  if (spawnSync("pdftotext", ["-v"]).error) return t.skip("pdftotext is not installed");
  const folder = mkdtempSync(join(tmpdir(), "labforge-math-gap-"));
  cpSync("assets/framework/labforge.cls", join(folder, ".labforge.cls"));
  writeFileSync(join(folder, "main.tex"), String.raw`\documentclass[language=english]{.labforge}
\begin{document}
Lineone starts a paragraph.\\
Fullline\hspace*{\fill}

\myformula{a = \frac{b}{c}}

Shortline.

\myformula{d = \frac{e}{f}}

Flatline.

\myformula{x = y}

Endline.
\end{document}
`);
  const run = spawnSync("latexmk", ["-xelatex", "-interaction=nonstopmode", "-halt-on-error", "main.tex"], { cwd: folder, env, encoding: "utf8", timeout: 120_000 });
  assert.equal(run.status, 0, run.stdout.slice(-1500));
  const html = spawnSync("pdftotext", ["-bbox", join(folder, "main.pdf"), "-"], { encoding: "utf8" }).stdout;
  const base = word => Number(new RegExp(`yMax="([\\d.]+)"[^>]*>${word.replace(/[()]/g, "\\$&")}<`).exec(html)[1]);
  const line = base("Fullline") - base("Lineone"), gap = 0.25 * line;
  const near = (value, expected, message) => assert.ok(Math.abs(value - expected) < 0.5, `${message}: ${value} vs ${expected}`);
  near(base("(1)") - base("Fullline"), line + gap, "after a full line the space above stays");
  near(base("Shortline.") - base("(1)"), line + gap, "the space below a tall formula");
  near(base("(2)") - base("Shortline."), line, "after a short line there is no space above");
  near(base("(3)") - base("Flatline."), line, "a flat formula gets nothing above");
  near(base("Endline.") - base("(3)"), line, "a flat formula gets nothing below");
});

test("undefined named and ordinary references stay visibly unresolved and warn", { timeout: 120_000 }, t => {
  if (!installed) return t.skip("XeLaTeX and latexmk are not installed");
  const result = build("reference-undefined");
  assert.equal(result.status, 0);
  assert.match(result.log, /Reference `absent' on page .* undefined/);
  if (!spawnSync("pdftotext", ["-v"]).error) {
    const text = spawnSync("pdftotext", ["-raw", result.pdf, "-"], { encoding: "utf8" }).stdout.replace(/\s+/g, " ");
    assert.match(text, /unknown named reference is \?\?/);
    assert.match(text, /Reaction R1 and \?\?/);
    assert.match(text, /Plain reference: \?\?/);
  }
});

test("table columns take widths in brackets, wrap on the line grid, and natural gaps shrink to fit", { timeout: 300_000 }, t => {
  if (!installed) return t.skip("XeLaTeX and latexmk are not installed");
  const folder = mkdtempSync(join(tmpdir(), "labforge-table-widths-"));
  cpSync("assets/framework/labforge.cls", join(folder, ".labforge.cls"));
  cpSync("tests/tex/tables", join(folder, "tables"), { recursive: true });
  const head = String.raw`\tablehead{Δείγμα & $m(\ce{Sn})$ (\unit{\gram}) & $m(\ce{Bi})$ (\unit{\gram}) & wt\% Sn & wt\% Bi & at\% Sn & at\% Bi & $T_{\mathrm{liq}}$ & $T_{\mathrm{sol}}$ & $T_{\mathrm{solv}}$}`;
  const row = String.raw`K2 & 8.972 & 2.974 & 75.10\% & 24.90\% & 84.15\% & 15.85\% & 185.1 & 123.2 & — \\`;
  // Ten columns that ran 44 pt past the margin at 12 pt with fixed 1 em gaps.
  writeFileSync(join(folder, "tables", "natural.tex"), [String.raw`\begin{labtable}{l c c c c c c c c c}`, head.replace(/liq|sol(?!v)|solv/g, m => ({ liq: "liquidus,\\,exact", sol: "solidus,\\,exact", solv: "solvus,\\,exact" })[m]), row, String.raw`\end{labtable}`].join("\n"));
  // Weighted columns: the notes wrap onto two and three lines.
  writeFileSync(join(folder, "tables", "weighted.tex"), [String.raw`\begin{labtable}{l[0.5] r[0.6] l[2]}`, String.raw`\tablehead{Sample & Mass (\unit{\gram}) & Note}`,
    String.raw`A1 & 2.013 & short \\`, String.raw`A2 & 1.950 & a note long enough to need a second line in this column, and perhaps a third one too \\`, String.raw`A3 & 2.101 & short \\`, String.raw`\end{labtable}`].join("\n"));
  writeFileSync(join(folder, "tables", "long.tex"), [String.raw`\begin{labtable}{l[0.5] c r[1.5]}`, String.raw`\tablehead{Sample & Mass & Note}`,
    ...Array.from({ length: 70 }, (_, i) => `B${i + 1} & ${i}.5 & ${i % 7 ? "ok" : "a longer note that wraps onto another line of the grid in this column"} \\\\`), String.raw`\end{labtable}`].join("\n"));
  writeFileSync(join(folder, "tables", "bad.tex"), [String.raw`\begin{labtable}{l c[x]}`, String.raw`a & b \\`, String.raw`\end{labtable}`].join("\n"));
  writeFileSync(join(folder, "main.tex"), String.raw`\documentclass[language=greek, fontsize=12pt]{.labforge}
\labforgesetup{block-snap=line}
\makeatletter
\newcommand\markline[1]{\leavevmode\pdfsavepos\write-1{LF-Y #1 \the\c@page\space\the\pdflastypos}}
\makeatother
\begin{document}
\typeout{LF-LINE \the\baselineskip}
\markline{before}Κείμενο πριν.

\mytable[caption=Natural.]{natural.tex}

\mytable[caption=Weighted.]{weighted.tex}

\markline{after}Κείμενο μετά.

\mytable[caption=Long.]{long.tex}

\markline{end}Τέλος.

\mytable{bad.tex}
\end{document}
`);
  const run = spawnSync("latexmk", ["-xelatex", "-interaction=nonstopmode", "-halt-on-error", "main.tex"], { cwd: folder, env, encoding: "utf8", timeout: 240_000 });
  const log = readFileSync(join(folder, "main.log"), "utf8");
  assert.equal(run.status, 0, problems(log).join("\n"));
  // The only warning is the width that is not a number, set as 1.
  assert.deepEqual(problems(log).filter(line => !/Table column width/.test(line)), [], "no overfull lines or other warnings");
  assert.match(log.replace(/\n\(labforge\)\s*/g, " "), /Table column width "x" is not a positive number/);
  const line = Number(/LF-LINE ([\d.]+)pt/.exec(log)[1]) * 65536;
  const marks = Object.fromEntries([...log.matchAll(/LF-Y (\w+) (\d+) (\d+)/g)].map(m => [m[1], { page: Number(m[2]), y: Number(m[3]) }]));
  assert.equal(marks.before.page, marks.after.page, "the two tables fit on the first page");
  const lines = (marks.before.y - marks.after.y) / line;
  assert.ok(Math.abs(lines - Math.round(lines)) < 0.01, `text after the weighted table is ${lines} lines below, not a whole number`);
  if (!spawnSync("pdftotext", ["-v"]).error) {
    const text = spawnSync("pdftotext", ["-raw", join(folder, "main.pdf"), "-"], { encoding: "utf8" }).stdout.replace(/\s+/g, " ");
    assert.ok(text.split("Sample Mass Note").length > 2, "the long weighted table repeats its header on the next page");
  }
});
