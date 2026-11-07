// Licensed under the GNU General Public License v2 or later. See LICENSE.
// Smart formatting of table cells: formulas, units with \per, numbers and symbols, and what is left alone.
import test from "node:test";
import assert from "node:assert/strict";
import { columnKind, formatCell, formatCells, smartOn } from "../../source/engine/smart-formatting";

const check = (cases: [string, string][], context = {}) => { for (const [raw, tex] of cases) assert.equal(formatCell(raw, true, context), tex, raw); };

test("formulas, ions, hydrates, states and reactions are written with mhchem", () => {
  check([
    ["H2O", "\\ce{H2O}"], ["NaCl", "\\ce{NaCl}"], ["Ca(OH)2", "\\ce{Ca(OH)2}"], ["(NH4)2SO4", "\\ce{(NH4)2SO4}"], ["O2", "\\ce{O2}"],
    ["Fe3+", "\\ce{Fe^3+}"], ["SO4^2-", "\\ce{SO4^2-}"], ["SO42-", "\\ce{SO4^2-}"], ["NO3-", "\\ce{NO3^-}"], ["OH-", "\\ce{OH^-}"], ["H+", "\\ce{H^+}"],
    ["[Cu(NH3)4]2+", "\\ce{[Cu(NH3)4]^2+}"], ["CuSO4·5H2O", "\\ce{CuSO4*5H2O}"], ["CuSO4.5H2O", "\\ce{CuSO4*5H2O}"],
    ["NaOH(aq)", "\\ce{NaOH(aq)}"], ["H2SO4 (aq)", "\\ce{H2SO4 (aq)}"],
    ["2 H2 + O2 -> 2 H2O", "\\ce{2 H2 + O2 -> 2 H2O}"], ["CH4 + 2 O2 → CO2 + 2 H2O", "\\ce{CH4 + 2 O2 -> CO2 + 2 H2O}"], ["N2 + 3 H2 <=> 2 NH3", "\\ce{N2 + 3 H2 <=> 2 NH3}"],
  ]);
});

test("words that only look like formulas stay text", () => {
  check([["K1", "K1"], ["B12", "B12"], ["CO", "CO"], ["NO", "NO"], ["Na", "Na"], ["I", "I"], ["NaN", "NaN"], ["B+", "B+"], ["NONE", "NONE"], ["Sample", "Sample"], ["Total", "Total"], ["A + B -> C", "A + B -> C"], ["pH", "pH"]]);
  // In a column of formulas, the unclear ones are formulas too.
  check([["CO", "\\ce{CO}"], ["Na", "\\ce{Na}"], ["K1", "K1"]], { kind: "chemistry" });
});

test("units are siunitx macros with \\per, alone, after a value and in a header", () => {
  check([["g/mol", "\\unit{\\gram\\per\\mole}"], ["mol L^-1", "\\unit{\\mole\\per\\litre}"], ["J/(mol K)", "\\unit{\\joule\\per\\mole\\per\\kelvin}"],
    ["kg m^-2", "\\unit{\\kilo\\gram\\per\\square\\metre}"], ["cm²", "\\unit{\\square\\centi\\metre}"], ["°C", "\\unit{\\degreeCelsius}"],
    ["3.2 mL", "\\qty{3.2}{\\milli\\litre}"], ["2 M", "\\qty{2}{\\molar}"], ["(12.5 ± 0.3) g", "\\qty{12.5 \\pm 0.3}{\\gram}"],
    ["m", "m"], ["A", "A"], ["N/A", "N/A"], ["mL", "mL"]]);
  check([["m", "\\unit{\\metre}"], ["mL", "\\unit{\\milli\\litre}"]], { kind: "units" });
  check([["Time (s)", "Time (\\unit{\\second})"], ["c / mol L-1", "$c$ / \\unit{\\mole\\per\\litre}"], ["Voltage [V]", "Voltage [\\unit{\\volt}]"],
    ["T (°C)", "$T$ (\\unit{\\degreeCelsius})"], ["ΔH (kJ/mol)", "$ΔH$ (\\unit{\\kilo\\joule\\per\\mole})"], ["Rate (mol L⁻¹ s⁻¹)", "Rate (\\unit{\\mole\\per\\litre\\per\\second})"],
    ["Energy (J/(mol K))", "Energy (\\unit{\\joule\\per\\mole\\per\\kelvin})"], ["Yield (%)", "Yield (\\unit{\\percent})"], ["Time/s", "Time/s"]], { header: true });
});

test("plain numbers keep their format; scientific notation and uncertainties use \\num", () => {
  check([["10.814", "10.814"], ["90.11%", "90.11\\%"], ["3,4", "3,4"], ["1,234.50", "1,234.50"], ["—", "—"],
    ["1.2e-3", "\\num{1.2e-3}"], ["1.2E5", "\\num{1.2e5}"], ["6.02×10^23", "\\num{6.02e23}"], ["6.02 × 10²³", "\\num{6.02e23}"], ["12.5 ± 0.3", "\\num{12.5 \\pm 0.3}"]]);
});

test("symbols with subscripts are math, with upright words", () => {
  check([["x_1", "$x_{1}$"], ["T_max", "$T_{\\mathrm{max}}$"], ["T_(liquidus)_exp", "$T_{\\mathrm{liquidus,\\,exp}}$"], ["delta_H", "$\\delta_{H}$"], ["x^2", "$x^{2}$"], ["c_a_new", "$c_{\\mathrm{a,\\,new}}$"]]);
});

test("in a sentence only what is sure changes, and never inside a word", () => {
  check([
    ["Dissolve 12.5 g NaCl in 250 mL H2O.", "Dissolve \\qty{12.5}{\\gram} \\ce{NaCl} in \\qty{250}{\\milli\\litre} \\ce{H2O}."],
    ["The CO2 yield was 85%.", "The \\ce{CO2} yield was 85\\%."], ["CO2-free water", "\\ce{CO2}-free water"],
    ["No precipitate formed.", "No precipitate formed."], ["In the second run, I added 3.2 mL HCl.", "In the second run, I added \\qty{3.2}{\\milli\\litre} \\ce{HCl}."],
    ["Samples K1 and K2 were heated to 250 °C.", "Samples K1 and K2 were heated to \\qty{250}{\\degreeCelsius}."],
    ["Sample 3 A", "Sample 3 A"], ["See Figure 2 C", "See Figure 2 C"], ["Vitamin B12 tablet", "Vitamin B12 tablet"], ["PIN code CO NO HI", "PIN code CO NO HI"],
    ["Το δείγμα K3 περιέχει 54.48% Sn", "Το δείγμα K3 περιέχει 54.48\\% Sn"], ["Cost $5 & more", "Cost \\$5 \\& more"],
  ]);
});

test("a sheet of samples: a label column stays text and headers are typeset", () => {
  const grid = [["Δείγμα", "m(Sn) (g)", "wt% Sn", "T_(liquidus)_exp", "Ar (g/mol)"], ["Sn", "—", "100.00%", "212.6", "118.71"], ["K1", "10.814", "90.11%", "219.3", ""], ["K2", "8.972", "75.10%", "185.1", ""], ["Bi", "0.000", "0.00%", "254.7", "208.98"]];
  assert.equal(columnKind(grid.slice(1).map(row => row[0])), "label");
  assert.deepEqual(formatCells(grid, true, true), [
    ["Δείγμα", "$m(\\ce{Sn})$ (\\unit{\\gram})", "wt\\% Sn", "$T_{\\mathrm{liquidus,\\,exp}}$", "$A_\\mathrm{r}$ (\\unit{\\gram\\per\\mole})"],
    ["Sn", "—", "100.00\\%", "212.6", "118.71"], ["K1", "10.814", "90.11\\%", "219.3", ""], ["K2", "8.972", "75.10\\%", "185.1", ""], ["Bi", "0.000", "0.00\\%", "254.7", "208.98"]]);
});

test("off escapes only; older settings with any flag are on", () => {
  assert.deepEqual(formatCells([["H2O", "x_1 & 5%"]], false, false), [["H2O", "x\\_1 \\& 5\\%"]]);
  assert.equal(smartOn(true), true); assert.equal(smartOn(undefined), false); assert.equal(smartOn({}), false); assert.equal(smartOn({ chemistry: true }), true); assert.equal(smartOn({ units: false, general: true }), true);
});
