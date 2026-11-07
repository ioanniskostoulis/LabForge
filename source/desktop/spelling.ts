// Licensed under the GNU General Public License v2 or later. See LICENSE.
// Offline English and Greek spelling with the Hunspell dictionaries in assets/spelling, read by nspell.
import { readFileSync } from "node:fs";
import * as path from "node:path";
// @ts-expect-error nspell ships no type declarations.
import nspell from "nspell";

type Dictionary = { correct(word: string): boolean; suggest(word: string): string[] };
export type SpellingLanguage = "en" | "el";

/** Greek letters choose the Greek dictionary; every other word is checked as English. */
export function spellingLanguage(word: string): SpellingLanguage {
  return /[\u0370-\u03ff\u1f00-\u1fff]/u.test(word) ? "el" : "en";
}

/** Edits between two words. Swapped neighbouring letters, the most common slip, cost less than another letter, so `wrod` puts `word` before `prod`. */
function editDistance(left: string, right: string): number {
  const a = Array.from(left.toLocaleLowerCase()), b = Array.from(right.toLocaleLowerCase());
  const rows = Array.from({ length: a.length + 1 }, (_, i) => Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
    rows[i][j] = Math.min(rows[i - 1][j] + 1, rows[i][j - 1] + 1, rows[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) rows[i][j] = Math.min(rows[i][j], rows[i - 2][j - 2] + 0.75);
  }
  return rows[a.length][b.length];
}

/** A dictionary loads the first time a word of its language is checked; the Greek one takes about half a second. */
export function createSpellingEngine(folder: string) {
  const loaded: Partial<Record<SpellingLanguage, Dictionary>> = {};
  const accepted = new Set<string>();
  const dictionary = (word: string): Dictionary => {
    const language = spellingLanguage(word);
    return loaded[language] ??= (nspell as (aff: Buffer, dic: Buffer) => Dictionary)(
      readFileSync(path.join(folder, language, "index.aff")), readFileSync(path.join(folder, language, "index.dic")));
  };
  // Abbreviations such as XRD or ΑΠΘ are left alone, as in most word processors.
  const known = (word: string) => accepted.has(word) || accepted.has(word.toLocaleLowerCase()) || (word.length > 1 && word === word.toLocaleUpperCase());
  return {
    accept(words: string[]): void { for (const word of words) if (word) accepted.add(word); },
    misspelled(words: string[]): string[] { return words.filter(word => !known(word) && !dictionary(word).correct(word)); },
    suggest(word: string): string[] {
      return dictionary(word).suggest(word).map((choice, order) => ({ choice, order, edits: editDistance(word, choice) }))
        .sort((a, b) => a.edits - b.edits || a.order - b.order).slice(0, 8).map(item => item.choice);
    },
  };
}
