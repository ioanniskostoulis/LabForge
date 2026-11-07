// Licensed under the GNU General Public License v2 or later. See LICENSE.
// Direct package declarations are cheap to read while editing. They describe what the report asks
// TeX to load; only an explicit PDF build can confirm that the installed distribution has them.
import { readClassOptions } from "./document-class";
import { preloadedPackages, type PackageEntry } from "./tex-commands";

export type ReportPackages = { included: PackageEntry[]; added: string[]; names: ReadonlySet<string> };

/** Literal package names declared in source before \begin{document}; comments and macro-built names are skipped. */
export function declaredPackages(text: string): string[] {
  const preamble = text.split(/\\begin\s*\{document\}/, 1)[0];
  const code = preamble.split("\n").map(line => line.replace(/(^|[^\\])%.*$/, "$1")).join("\n");
  const found = new Set<string>();
  for (const match of code.matchAll(/\\(?:usepackage|RequirePackage)\s*(?:\[[^\]\n]*\]\s*)?\{([^}\n]+)\}/g)) {
    for (const raw of match[1].split(",")) {
      const name = raw.trim();
      if (/^[a-zA-Z][a-zA-Z0-9_.-]*$/.test(name)) found.add(name);
    }
  }
  return [...found];
}

/** Packages the current LabForge class selects, then literal additions in main.tex. */
export function reportPackages(mainTex: string): ReportPackages {
  const bibliography = readClassOptions(mainTex)?.bibliography ?? false;
  const included = preloadedPackages.filter(item => item.name !== "biblatex" || bibliography);
  const builtIn = new Set(included.map(item => item.name));
  const added = declaredPackages(mainTex).filter(name => !builtIn.has(name));
  return { included, added, names: new Set([...builtIn, ...added]) };
}
