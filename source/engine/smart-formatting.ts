// Licensed under the GNU General Public License v2 or later. See LICENSE.
// Smart formatting of table cells: chemical formulas as mhchem, units as siunitx macros (`\per` for a
// division), scientific notation and uncertainties as `\num`, and symbols with subscripts as math.
// It works word by word, so nothing is replaced inside a word, and only converts what it is sure of:
// a word that could be text (CO, Na, K1, a lone A) stays text unless its column says otherwise.
// A helper only: the table's code is the user's to edit. No Node imports, so the renderer can bundle it.

const ELEMENTS = new Set("H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca Sc Ti V Cr Mn Fe Co Ni Cu Zn Ga Ge As Se Br Kr Rb Sr Y Zr Nb Mo Tc Ru Rh Pd Ag Cd In Sn Sb Te I Xe Cs Ba La Ce Pr Nd Pm Sm Eu Gd Tb Dy Ho Er Tm Yb Lu Hf Ta W Re Os Ir Pt Au Hg Tl Pb Bi Po At Rn Fr Ra Ac Th Pa U Np Pu Am Cm Bk Cf Es Fm Md No Lr Rf Db Sg Bh Hs Mt Ds Rg Cn Nh Fl Mc Lv Ts Og".split(" "));
/** Elements that exist as molecules: the only element-and-count words read as formulas (K1 and B12 are names). */
const MOLECULES = new Set("H2 N2 O2 O3 F2 Cl2 Br2 I2 P4 S8".split(" "));
const UNITS: Record<string, string> = {
  g: "\\gram", m: "\\metre", s: "\\second", mol: "\\mole", A: "\\ampere", K: "\\kelvin", cd: "\\candela", L: "\\litre", l: "\\litre", N: "\\newton", Pa: "\\pascal",
  J: "\\joule", W: "\\watt", C: "\\coulomb", V: "\\volt", F: "\\farad", S: "\\siemens", "Ω": "\\ohm", T: "\\tesla", H: "\\henry", Hz: "\\hertz", Bq: "\\becquerel",
  Gy: "\\gray", Sv: "\\sievert", lm: "\\lumen", lx: "\\lux", Wb: "\\weber", kat: "\\katal", rad: "\\radian", sr: "\\steradian", eV: "\\electronvolt", bar: "\\bar",
  min: "\\minute", h: "\\hour", d: "\\day", Da: "\\dalton", M: "\\molar", atm: "\\atm", mmHg: "\\mmHg", Torr: "\\torr", "°C": "\\degreeCelsius", "℃": "\\degreeCelsius", "°": "\\degree", "%": "\\percent",
};
/** Units that take no prefix here: `min` is minutes, not milli-inches; `cd`, `Pa` and `Torr` stay whole. */
const WHOLE = new Set(["min", "h", "d", "°C", "℃", "°", "%", "atm", "mmHg", "Torr", "rad", "sr", "kat"]);
const PREFIXES: Record<string, string> = { T: "\\tera", G: "\\giga", M: "\\mega", k: "\\kilo", h: "\\hecto", da: "\\deca", d: "\\deci", c: "\\centi", m: "\\milli", "µ": "\\micro", "μ": "\\micro", u: "\\micro", n: "\\nano", p: "\\pico", f: "\\femto" };
const GREEK = "alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu nu xi pi rho sigma tau upsilon phi chi psi omega".split(" ");
const SUPERSCRIPTS: Record<string, string> = { "⁻": "-", "⁺": "+", "⁰": "0", "¹": "1", "²": "2", "³": "3", "⁴": "4", "⁵": "5", "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9" };
const ESCAPE: Record<string, string> = { "&": "\\&", "%": "\\%", "$": "\\$", "#": "\\#", "_": "\\_", "{": "\\{", "}": "\\}", "~": "\\textasciitilde{}", "^": "\\textasciicircum{}", "\\": "\\textbackslash{}" };
export function escapeTex(value: string): string { return [...value].map(ch => ESCAPE[ch] ?? ch).join(""); }

/** The table's smart formatting setting: `true`, or the older `{ chemistry, units, general }` flags, any of which turns it on. */
export type SmartSetting = boolean | { general?: boolean; chemistry?: boolean; units?: boolean };
export function smartOn(setting: SmartSetting | undefined): boolean {
  return typeof setting === "object" && setting ? Object.values(setting).some(Boolean) : !!setting;
}

// Numbers. A plain number is never changed: 3,4 could be 3.4 or 34, and the data file's own format is kept.
const NUMBER = String.raw`[-+−]?(?:\d+(?:\.\d+)?|\.\d+)`;
const plainNumber = new RegExp(`^${NUMBER}$`);
const minus = (text: string) => text.replace(/−/g, "-");
/** Scientific notation as `\num` input, such as 1.2e-3 for 1.2E-3 or 1.2×10^-3; otherwise undefined. */
function scientific(text: string): string | undefined {
  const m = new RegExp(`^(${NUMBER})(?:[eE]([-+−]?\\d+)|\\s*[×x*·]\\s*10(?:\\^\\{?([-+−]?\\d+)\\}?|([⁻⁺]?[⁰¹²³⁴⁵⁶⁷⁸⁹]+)))$`).exec(text);
  if (!m) return;
  const power = m[2] ?? m[3] ?? [...m[4]].map(ch => SUPERSCRIPTS[ch]).join("");
  return `${minus(m[1])}e${minus(power).replace(/^\+/, "")}`;
}
/** A value as `\num` input when it is a number, scientific notation or `a ± b`. */
function value(text: string): { tex: string; plain: boolean } | undefined {
  const t = text.trim();
  if (plainNumber.test(t)) return { tex: minus(t), plain: true };
  const sci = scientific(t);
  if (sci) return { tex: sci, plain: false };
  const pm = new RegExp(`^\\(?(${NUMBER})\\s*(?:±|\\+/?-)\\s*(${NUMBER})\\)?$`).exec(t);
  if (pm) return { tex: `${minus(pm[1])} \\pm ${minus(pm[2])}`, plain: false };
}

// Units, written as siunitx macros: g/mol is \gram\per\mole, kg m^-2 is \kilo\gram\per\square\metre.
function unitWord(word: string): { macro: string; power: number; letter: boolean } | undefined {
  const m = /^(°C|℃|[^\d^+\-−]+?)\^?\{?([-+−]?\d)?\}?$/.exec(word);
  if (!m) return;
  const base = m[1];
  let macro = UNITS[base];
  if (!macro) for (const [prefix, name] of Object.entries(PREFIXES)) {
    const rest = base.slice(prefix.length);
    if (base.startsWith(prefix) && rest && UNITS[rest] && !WHOLE.has(rest)) { macro = name + UNITS[rest]; break; }
  }
  return macro ? { macro, power: m[2] ? Number(minus(m[2])) : 1, letter: base.length === 1 && /[A-Z]/.test(base) } : undefined;
}
const POWERS: Record<number, string> = { 2: "\\square", 3: "\\cubic" };
/** A unit expression as siunitx macros, or undefined when any part is not a unit. `letter` is true when every part is one capital letter (A, N/A, S/N), which is more often a name or an abbreviation. */
export function unitMacros(text: string): { tex: string; letter: boolean } | undefined {
  const t = text.trim().replace(/[⁻⁺⁰¹²³⁴⁵⁶⁷⁸⁹]+/g, sup => `^${[...sup].map(ch => SUPERSCRIPTS[ch]).join("")}`)
    .replace(/[·⋅*]/g, " ").replace(/\s*\/\s*/g, " / ").replace(/[()]/g, " ").trim();
  if (!t || t.split("/").length > 2) return;
  let per = false;
  const out: string[] = [];
  let letter = false;
  for (const word of t.split(/\s+/)) {
    if (word === "/") { per = true; continue; }
    const unit = unitWord(word.replace(/^([^\d^]+?)([-−]?\d)$/, "$1^$2"));
    if (!unit) return;
    letter = (out.length ? letter : true) && unit.letter;
    const power = per ? -unit.power : unit.power;
    const size = Math.abs(power);
    if (!size) return;
    out.push(`${power < 0 ? "\\per" : ""}${size === 1 ? "" : POWERS[size] ?? ""}${unit.macro}${size > 3 ? `\\tothe{${size}}` : ""}`);
  }
  if (!out.length || per && out.every(part => part.startsWith("\\per"))) return;
  return { tex: out.join(""), letter };
}

// Formulas. "strong" is a formula even in a sentence (H2O, NaCl, Fe3+, CuSO4·5H2O); "weak" only in a
// column of formulas (CO, NO, Na, I); "none" is a name (K1, B12).
/** Words that read as formulas but are not. */
const NAMES = new Set(["NaN", "HeLa"]);
type Formula = { tex: string; strength: "strong" | "weak" | "none" };
function formula(word: string): Formula | undefined {
  if (NAMES.has(word)) return;
  let rest = word;
  const state = /\((aq|s|l|g)\)$/.exec(rest);
  if (state) rest = rest.slice(0, -state[0].length);
  // A charge: ^2-, ^+, 3+ or - at the end; on a group ending in two digits (SO42-) the last digit is the charge.
  let charge = "";
  const sign = /(\^\{?(\d*)([+-])\}?|(\d*)([+-]))$/.exec(rest);
  if (sign && sign.index > 0) {
    const digits = sign[2] ?? sign[4] ?? "";
    rest = rest.slice(0, sign.index);
    if (sign[1].startsWith("^") || !digits) charge = `${digits}${sign[3] ?? sign[5]}`;
    else {
      // Fe3+, Ca2+ and [Cu(NH3)4]2+: the digits are the charge. NO3- (a group): they are a count, unless two or more (SO42-).
      const single = /^[A-Z][a-z]?$|\]$/.test(rest);
      if (single) charge = `${digits}${sign[5]}`;
      else if (digits.length > 1) { rest += digits.slice(0, -1); charge = `${digits.slice(-1)}${sign[5]}`; }
      else { rest += digits; charge = sign[5]; }
    }
  }
  const parts = rest.split(/[·⋅*•.]/);
  const elements: string[] = [];
  let counted = false;
  for (const [index, part] of parts.entries()) {
    const body = index ? part.replace(/^\d+/, "") : part;
    if (!body) return;
    const tokens = /([A-Z][a-z]?)(\d*)|([(\[])|([)\]])(\d*)/gy;
    let depth = 0, at = 0, m: RegExpExecArray | null;
    while (at < body.length && (m = tokens.exec(body))) {
      at = tokens.lastIndex;
      if (m[1]) { if (!ELEMENTS.has(m[1]) || m[2] === "1" || m[2]?.startsWith("0")) return; elements.push(m[1]); if (m[2]) counted = true; }
      else if (m[3]) depth++;
      else { if (--depth < 0) return; if (m[5]) counted = true; }
    }
    if (at !== body.length || depth) return;
  }
  if (!elements.length) return;
  let strength: Formula["strength"];
  // A capital letter with a sign alone (B+, C-, F-) is as often a grade or a name; H+ is not.
  if (charge || state || parts.length > 1) strength = elements.length === 1 && counted ? "none" : /^[A-Z]$/.test(rest) && rest !== "H" && charge.length === 1 && !state ? "weak" : "strong";
  else if (elements.length === 1) strength = counted ? (MOLECULES.has(rest) ? "strong" : "none") : "weak";
  else if (counted) strength = "strong";
  else strength = /[a-z]/.test(rest) && new Set(elements).size > 1 ? "strong" : "weak";
  return { strength, tex: `\\ce{${rest.replace(/[·⋅•.]/g, "*")}${charge ? `^${charge}` : ""}${state ? state[0] : ""}}` };
}
/** A reaction, such as 2 H2 + O2 -> 2 H2O: every term a formula, joined by + and one arrow. */
function reaction(text: string): string | undefined {
  const arrow = /\s*(->|→|<=>|⇌|<->|↔)\s*/;
  const sides = text.split(arrow).filter((_, index) => index % 2 === 0);
  if (sides.length !== 2) return;
  const terms = sides.flatMap(side => side.split(/\s+\+\s+/));
  if (!terms.every(term => { const m = /^(\d+\s*)?(\S+)$/.exec(term.trim()); const f = m && formula(m[2]); return f && f.strength !== "none"; })) return;
  return `\\ce{${text.trim().replace(/→/g, "->").replace(/⇌|<->|↔/g, "<=>").replace(/\s+/g, " ")}}`;
}

// Symbols: T_max, x_1, T_(liquidus)_exp, delta_H, x^2. A subscript of more than one letter is upright.
function symbolHead(head: string): string {
  const greek = GREEK.indexOf(head.toLowerCase());
  if (greek >= 0) return `\\${head[0] === head[0].toUpperCase() ? head[0] + head.slice(1).toLowerCase() : head.toLowerCase()}`;
  return head.length === 1 || /^[\p{Script=Greek}][A-Za-z]$/u.test(head) ? head : `\\mathrm{${head}}`;
}
function symbol(word: string): string | undefined {
  const m = /^([A-Za-z\p{Script=Greek}]+)((?:[_^](?:\([^()]+\)|\{[^{}]+\}|[A-Za-z0-9]+(?:,[A-Za-z0-9]+)*|[+-]?\d+))+)$/u.exec(word);
  if (!m) return;
  const subs: string[] = [], sups: string[] = [];
  for (const [, op, raw] of m[2].matchAll(/([_^])(\([^()]+\)|\{[^{}]+\}|[A-Za-z0-9]+(?:,[A-Za-z0-9]+)*|[+-]?\d+)/g)) (op === "_" ? subs : sups).push(raw.replace(/^[({]|[)}]$/g, ""));
  const script = (list: string[]) => {
    const text = list.join(",");
    return /^[+-]?\d+$/.test(text) || /^[A-Za-z]$/.test(text) ? text : `\\mathrm{${text.replace(/,\s*/g, ",\\,").replace(/ /g, "\\ ")}}`;
  };
  return `$${symbolHead(m[1])}${subs.length ? `_{${script(subs)}}` : ""}${sups.length ? `^{${script(sups)}}` : ""}$`;
}

export type ColumnKind = "label" | "chemistry" | "units" | "auto";
const label = /^[\p{L}]{1,3}[ _-]?\d{1,3}[a-z]?$/u;
/** What a column holds, from its body cells: labels (K1, K2, K3), formulas, units or anything. */
export function columnKind(values: string[]): ColumnKind {
  const cells = values.map(text => text.trim()).filter(text => text && !/^[—–-]+$/.test(text));
  if (!cells.length) return "auto";
  const labels = cells.filter(text => label.test(text) && !MOLECULES.has(text));
  if (labels.length >= 2 && new Set(labels.map(text => /^\D+/.exec(text)![0].replace(/[ _-]$/, ""))).size === 1) return "label";
  const formulas = cells.map(formula).filter((f): f is Formula => !!f && f.strength !== "none");
  if (cells.length >= 2 && formulas.length / cells.length >= 0.75 && formulas.some(f => f.strength === "strong")) return "chemistry";
  const units = cells.filter(text => unitMacros(text));
  if (units.length / cells.length >= 0.75 && units.some(text => text.trim().length > 1)) return "units";
  return "auto";
}

type Context = { kind?: ColumnKind; header?: boolean };
const trailing = /[.,;:!?)\]"”'»]+$/, leading = /^[("“'«\[]+/;
const count = (text: string, pattern: RegExp) => text.match(pattern)?.length ?? 0;

/** Words of a cell or sentence, each converted when the detector is sure. */
function words(text: string, context: Context): string {
  const tokens = text.split(/(\s+)/);
  const out: string[] = [];
  const peel = (token: string) => {
    // Brackets that belong to the word stay: (NH4)2SO4, [Cu(NH3)4]2+, Ca(OH)2, NaOH(aq), m(Sn), T_(liquidus).
    let lead = leading.exec(token)?.[0] ?? "";
    while (lead && /[(\[]/.test(lead.slice(-1)) && count(token.slice(lead.length), /[)\]]/g) > count(token.slice(lead.length), /[(\[]/g)) lead = lead.slice(0, -1);
    let core = token.slice(lead.length);
    let trail = trailing.exec(core)?.[0] ?? "";
    while (trail && /[)\]]/.test(trail[0]) && count(core.slice(0, -trail.length), /[(\[]/g) > count(core.slice(0, -trail.length), /[)\]]/g)) trail = trail.slice(1);
    core = core.slice(0, core.length - trail.length);
    return { lead, core, trail };
  };
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (!token.trim()) { out.push(token); continue; }
    let { lead, core, trail } = peel(token);
    const done = (tex: string, skip = 0, after = trail) => { out.push(escapeTex(lead) + tex + escapeTex(after)); i += skip; };
    // A value, alone or with ± and a unit after it: 12.5 g, (12.5 ± 0.3) mL, 1.2e-3.
    let number = value(core);
    let skip = 0;
    if (number && !trail && tokens[i + 2] && /^(?:±|\+\/?-)$/.test(tokens[i + 2]) && tokens[i + 4]) {
      const error = peel(tokens[i + 4]);
      if (plainNumber.test(error.core)) {
        number = { tex: `${number.tex} \\pm ${minus(error.core)}`, plain: false }; skip = 4; trail = error.trail;
        if (lead.endsWith("(") && trail.startsWith(")")) { lead = lead.slice(0, -1); trail = trail.slice(1); }
      }
    }
    if (number && !/,/.test(core)) {
      const next = tokens[i + skip + 2];
      const unitPart = next ? peel(next) : undefined;
      const unit = unitPart && !trail && !unitPart.lead ? unitMacros(unitPart.core) : undefined;
      // One capital letter after a whole number in a sentence is more often a name: Sample 3 A, Figure 2 C.
      const sentence = tokens.filter(part => part.trim()).length > 2;
      if (unit && unit.tex !== "\\percent" && !(unit.letter && sentence && !/\./.test(number.tex))) { done(`\\qty{${number.tex}}{${unit.tex}}`, skip + 2, unitPart!.trail); continue; }
      if (!number.plain) { done(`\\num{${number.tex}}`, skip); continue; }
      out.push(token); continue;
    }
    // Headers name a quantity: m(Sn), Ar, T, ΔH.
    if (context.header) {
      const element = /^([A-Za-z])\(([A-Z][a-z]?)\)$/.exec(core);
      if (element && ELEMENTS.has(element[2])) { done(`$${element[1]}(\\ce{${element[2]}})$`); continue; }
      if (/^[AM]r$/.test(core)) { done(`$${core[0]}_\\mathrm{r}$`); continue; }
    }
    // A formula; CO2-free and H2O-soluble keep their ending as text.
    const compound = /^(.+?)(-[\p{Ll}]{3,}.*)$/u.exec(core);
    const found = formula(compound ? compound[1] : core);
    if (found && (found.strength === "strong" || found.strength === "weak" && context.kind === "chemistry" && tokens.length === 1)) {
      // A formula followed by its state: H2SO4 (aq).
      const state = !compound && !trail && tokens[i + 2]?.match(/^\((aq|s|l|g)\)([.,;:]?)$/);
      if (state) { done(found.tex.replace(/\}$/, ` (${state[1]})}`), 2, state[2]); continue; }
      done(found.tex + escapeTex(compound?.[2] ?? "")); continue;
    }
    const sym = symbol(core);
    if (sym) { done(sym); continue; }
    if (tokens.length === 1 && GREEK.includes(core.toLowerCase()) && context.header) { done(`$${symbolHead(core)}$`); continue; }
    out.push(escapeTex(token));
  }
  return out.join("");
}

/** A header with its unit: Time (s), c / mol L-1, Voltage [V]. The quantity is set as above and the unit as `\unit`. */
function headerCell(text: string): string | undefined {
  let quantity = "", inside = "", close = text.slice(-1);
  if (close === ")" || close === "]") {
    // The last bracket group, matched from the end so that m(Sn) (g) gives m(Sn) and g.
    const open = close === ")" ? "(" : "[";
    let depth = 0, at = text.length - 1;
    for (; at >= 0; at--) { if (text[at] === close) depth++; else if (text[at] === open && !--depth) break; }
    if (at <= 0) return;
    quantity = text.slice(0, at).trim(); inside = text.slice(at + 1, -1);
  } else {
    // Time / s: the slash needs a space on each side, or J/(mol K) would read as a quantity J.
    const slash = / \/ /.exec(text);
    if (!slash) return;
    quantity = text.slice(0, slash.index).trim(); inside = text.slice(slash.index + 3);
  }
  if (!quantity || /\/$/.test(quantity)) return;
  const unit = unitMacros(inside);
  if (!unit) return;
  const name = /^(?:[A-Za-z]|[\p{Script=Greek}][A-Za-z]?)$/u.test(quantity) ? `$${quantity}$` : words(quantity, { header: true });
  const tex = `\\unit{${unit.tex}}`;
  return `${name} ${close === ")" ? `(${tex})` : close === "]" ? `[${tex}]` : `/ ${tex}`}`;
}

/** One cell as TeX. With smart formatting off, only TeX's special characters are escaped. */
export function formatCell(raw: string, smart: boolean, context: Context = {}): string {
  const text = raw.trim();
  if (!smart || !text) return escapeTex(text);
  if (context.kind === "label" && !context.header) return escapeTex(text);
  // A cell that is only a unit: mol/L, kg m^-2, cm², °C. Without a slash, power or degree sign (m, mL, pH, K1) only in a column of units;
  // T (°C) is a quantity and its unit.
  const unit = unitMacros(text);
  if (unit && unit.tex !== "\\percent" && !/\s[(\[]/.test(text) && (context.kind === "units" || /[/^\s°℃⁻⁰¹²³⁴⁵⁶⁷⁸⁹]/.test(text) && !unit.letter)) return `\\unit{${unit.tex}}`;
  if (context.header) { const header = headerCell(text); if (header) return header; }
  const number = value(text);
  if (number && !number.plain) return `\\num{${number.tex}}`;
  const equation = reaction(text);
  if (equation) return equation;
  return words(text, context);
}

/** A table's cells as TeX; the column kinds come from the body rows, below the header when there is one. */
export function formatCells(grid: string[][], smart: boolean, header: boolean): string[][] {
  if (!smart) return grid.map(row => row.map(cell => escapeTex(cell.trim())));
  const body = header ? grid.slice(1) : grid;
  const kinds = (grid[0] ?? []).map((_, col) => columnKind(body.map(row => row[col] ?? "")));
  return grid.map((row, index) => row.map((cell, col) => formatCell(cell, true, { kind: kinds[col], header: header && index === 0 })));
}
