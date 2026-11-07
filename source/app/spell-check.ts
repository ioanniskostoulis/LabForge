// Licensed under the GNU General Public License v2 or later. See LICENSE.
// Find prose words in LaTeX source. The desktop spellchecker decides which are misspelled.
import { readSource, type SourceRegion } from "./source-reader";

export type SpellWord = { from: number; to: number; word: string };

const wordPattern = /[\p{L}]+(?:['’][\p{L}]+)*/uy;

/** Source offsets of prose words; comments, commands, keys, references, paths and math are excluded.
 * `cached` is the editor's reading of the same text; it is used when one of its steps starts where the document body does. */
export function proseWords(text: string, cached?: readonly SourceRegion[]): SpellWord[] {
  const words: SpellWord[] = [];
  const document = /\\begin\{document\}/.exec(text);
  const body = document ? document.index + document[0].length : 0;
  const first = cached?.findIndex(region => region.from >= body) ?? -1;
  const step = first >= 0 && cached![first].from === body && cached![first].kind !== "argument" && cached![first].kind !== "math" && cached![first].kind !== "verbatim";
  const regions = step ? cached!.slice(first) : readSource(text, body).regions;
  for (let index = 0; index < regions.length; index++) {
    const region = regions[index];
    if (region.kind === "command" && region.name === "end" && text.startsWith("{document}", region.to)) break;
    if (region.kind !== "prose") continue;
    for (let i = region.from; i < region.to;) {
      wordPattern.lastIndex = i;
      const word = wordPattern.exec(text);
      if (!word) { i++; continue; }
      const from = i; i += word[0].length;
      let start = from, stop = i;
      while (start > 0 && !/[\s{}]/.test(text[start - 1])) start--;
      while (stop < text.length && !/[\s{}]/.test(text[stop])) stop++;
      const segment = text.slice(start, stop).replace(/^[([{"“]+/, "").replace(/[.,;:!?)}\]"”]+$/, "");
      if (/[\\/:@]|\.[A-Za-z0-9]{1,5}(?:\W|$)/.test(segment)) continue;
      words.push({ from, to: i, word: word[0] });
    }
  }
  return words;
}
