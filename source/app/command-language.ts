// Licensed under the GNU General Public License v2 or later. See LICENSE.
// One physical LaTeX command temporarily uses the English keyboard source.
export class CommandLanguageSession {
  private active = false;

  constructor(private readonly changeSource: (action: "begin" | "restore") => boolean) {}

  /** Follow text actually inserted by typing, including Option-key combinations. */
  typed(text: string): void {
    for (const character of text) {
      if (this.active) {
        // A second backslash is the one-character \\ command, not a new word.
        if (!/[a-zA-Z@*]/.test(character)) this.stop();
      } else if (character === "\\" && text.length === 1) {
        this.active = this.changeSource("begin");
      }
    }
  }

  stop(): void {
    if (!this.active) return;
    this.active = false;
    this.changeSource("restore");
  }
}
