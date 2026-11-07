// Licensed under the GNU General Public License v2 or later. See LICENSE.
// Debounced previews for the Plots and Tables panes: one build at a time, the newest code wins,
// and a build error is reported once until the preview builds again.

export type PreviewResult = { pdf: Uint8Array | null; cached: boolean; error: string | null; diagnostics: string[] };
export type PreviewHandlers = {
  build(code: string): Promise<PreviewResult>;
  /** A newer preview is ready. */
  show(pdf: Uint8Array): void;
  /** The build is waiting or running (true), or has finished (false). */
  busy(running: boolean): void;
  /** A build failed with a problem different from the last one reported. */
  problem(text: string): void;
};

export class PreviewScheduler {
  private timer: ReturnType<typeof setTimeout> | undefined;
  private running = false;
  private pending: string | null = null;
  private lastProblem: string | null = null;

  constructor(private readonly handlers: PreviewHandlers, private readonly delay = 600) {}

  /** Asks for a preview of `code` once typing pauses; the desktop side answers repeated code from its cache. */
  request(code: string): void {
    if (this.timer) clearTimeout(this.timer);
    this.handlers.busy(true);
    this.timer = setTimeout(() => { this.timer = undefined; this.pending = code; void this.next(); }, this.delay);
  }

  /** Stops waiting builds; a running build finishes but its result is dropped. */
  cancel(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
    this.pending = null;
    if (!this.running) this.handlers.busy(false);
  }

  private async next(): Promise<void> {
    if (this.running) return;
    const code = this.pending;
    this.pending = null;
    if (code === null) { this.handlers.busy(!!this.timer); return; }
    this.running = true;
    let result: PreviewResult;
    try { result = await this.handlers.build(code); }
    catch (error) { result = { pdf: null, cached: false, error: String(error).replace(/^Error: (?:Error invoking remote method '[^']+': )?(?:Error: )?/, ""), diagnostics: [] }; }
    this.running = false;
    // Newer code arrived while this one built: show nothing from the old build.
    if (this.pending === null && !this.timer) {
      if (result.pdf) { this.lastProblem = null; this.handlers.show(result.pdf); }
      else if (result.error && result.error !== this.lastProblem) { this.lastProblem = result.error; this.handlers.problem(result.error); }
    }
    if (this.pending !== null) void this.next();
    else this.handlers.busy(!!this.timer);
  }
}
