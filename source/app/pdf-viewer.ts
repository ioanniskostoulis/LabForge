// Licensed under the GNU General Public License v2 or later. See LICENSE.
import { PdfStage, type PdfView } from "./pdf-stage";

/** The report's PDF in the right tile, navigated like a plot preview; the view is kept per report by the caller. */
export class PdfViewer {
  private onChange: ((view: PdfView) => void) | null = null;
  /** ⌘-click on the PDF: find the source of that spot. */
  onSource: ((page: number, x: number, y: number) => void) | null = null;
  private readonly stage: PdfStage;
  private readonly element: HTMLElement;
  private readonly empty: HTMLElement;
  private readonly readout: HTMLElement;
  private readonly previous: HTMLButtonElement;
  private readonly next: HTMLButtonElement;
  private readonly fit: HTMLButtonElement;

  constructor() {
    const find = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
    this.element = find("pdf-stage");
    this.empty = find("pdf-empty");
    this.readout = find("pdf-readout");
    this.previous = find("pdf-prev");
    this.next = find("pdf-next");
    this.fit = find("pdf-fit");
    this.stage = new PdfStage(this.element, {
      mode: () => "width",
      selectable: true,
      sourceClick: (page, x, y) => this.onSource?.(page, x, y),
      changed: () => this.updateControls(),
      viewChanged: view => this.onChange?.(view),
      failed: error => { this.empty.textContent = `Could not display PDF: ${String(error)}`; this.empty.hidden = false; },
    });
    this.previous.addEventListener("click", () => this.stage.goToPage(this.stage.currentPage - 1));
    this.next.addEventListener("click", () => this.stage.goToPage(this.stage.currentPage + 1));
    this.fit.addEventListener("click", () => this.stage.fit());
  }

  /** Scroll to a box of a page, in points, and outline it for a moment. */
  reveal(page: number, left: number, top: number, width: number, height: number): void { this.stage.reveal(page, left, top, width, height); }
  /** Keep a box in view, moving only when it is out of sight. */
  follow(page: number, left: number, top: number, width: number, height: number): void { this.stage.reveal(page, left, top, width, height, true); }

  close(): void {
    this.onChange = null;
    this.stage.clear();
    this.element.hidden = true;
    this.empty.textContent = "No PDF in this report yet. Build to preview it.";
    this.empty.hidden = false;
    this.updateControls();
  }

  async open(data: Uint8Array, view: PdfView | null, onChange: (view: PdfView) => void): Promise<void> {
    this.close();
    if (view) this.stage.restore(view);
    this.element.hidden = false;
    this.empty.hidden = true;
    try {
      await this.stage.load(data);
      // Only now report view changes, so restoring and the first fit do not overwrite the saved view.
      this.onChange = onChange;
    } catch (error) {
      this.element.hidden = true;
      this.empty.textContent = `Could not display PDF: ${String(error)}`;
      this.empty.hidden = false;
      this.updateControls();
      throw error;
    }
  }

  private updateControls(): void {
    const count = this.stage.pageCount, page = this.stage.currentPage;
    this.readout.textContent = count ? `${page} / ${count}  ${this.stage.percent}%` : "";
    this.previous.disabled = !count || page <= 1;
    this.next.disabled = !count || page >= count;
    this.fit.disabled = !count;
    this.fit.setAttribute("aria-pressed", String(!!count && this.stage.view.fitting));
  }
}
