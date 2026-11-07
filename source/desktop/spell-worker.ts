// Licensed under the GNU General Public License v2 or later. See LICENSE.
// A utility process holds the dictionaries, so loading the large Greek one never pauses the window.
import { createSpellingEngine } from "./spelling";

export type SpellRequest = { id: number } & ({ kind: "check"; words: string[] } | { kind: "suggest"; word: string } | { kind: "accept"; words: string[] });
type Port = { on(event: "message", listener: (message: { data: SpellRequest }) => void): void; postMessage(message: unknown): void };

const port = (process as unknown as { parentPort: Port }).parentPort;
const engine = createSpellingEngine(process.argv[2]);
port.on("message", ({ data: request }) => {
  try {
    const result = request.kind === "check" ? engine.misspelled(request.words) : request.kind === "suggest" ? engine.suggest(request.word) : (engine.accept(request.words), []);
    port.postMessage({ id: request.id, result });
  } catch (error) {
    port.postMessage({ id: request.id, error: error instanceof Error ? error.message : String(error) });
  }
});
