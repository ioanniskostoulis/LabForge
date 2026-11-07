export type NamedRange = { range: string; name: string };

export function safeName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_\-Ͱ-Ͽ]/g, "") || "table";
}

export function parseRange(value: string): { r1: number; c1: number; r2: number; c2: number } {
  const match = /^([A-Za-z]+)(\d+):([A-Za-z]+)(\d+)$/.exec(value.trim());
  if (!match) throw new Error(`"${value}" is not a valid range (use A1:D10).`);
  const col = (letters: string) => [...letters.toUpperCase()].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;
  const [, a, b, c, d] = match;
  const out = { r1: Number(b) - 1, c1: col(a), r2: Number(d) - 1, c2: col(c) };
  if (out.r1 < 0 || out.c1 < 0 || out.r2 < out.r1 || out.c2 < out.c1) throw new Error(`"${value}" start must come before its end.`);
  return out;
}

export function resolveRanges(text: string, fileStem: string, start = 1): NamedRange[] {
  const entries = text.replace(/,/g, "\n").split(/\r?\n/).map(s => s.trim()).filter(s => !!s && !s.startsWith("#"));
  if (!entries.length) throw new Error("No ranges given.");
  let unnamed = 0;
  const prelim = entries.map(entry => {
    const divider = entry.indexOf("|") >= 0 ? entry.indexOf("|") : entry.indexOf("/");
    const rawRange = divider < 0 ? entry : entry.slice(0, divider).trim();
    const given = divider < 0 ? "" : entry.slice(divider + 1).trim();
    parseRange(rawRange);
    const normalized = `${rawRange.split(":")[0].toUpperCase()}:${rawRange.split(":")[1].toUpperCase()}`;
    return { range: normalized, name: given ? safeName(given) : `${safeName(fileStem)}_table_${start + unnamed++}` };
  });
  const counts = new Map<string, number>();
  prelim.forEach(({ name }) => counts.set(name, (counts.get(name) ?? 0) + 1));
  const seen = new Map<string, number>();
  return prelim.map(({ range, name }) => {
    if ((counts.get(name) ?? 0) > 1) {
      const n = (seen.get(name) ?? 0) + 1;
      seen.set(name, n);
      return { range, name: `${name}_${n}` };
    }
    return { range, name };
  });
}
