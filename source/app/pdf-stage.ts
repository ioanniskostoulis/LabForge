// Adapted from NodeForge. Copyright (C) Ioannis Kostoulis. Licensed under the GNU General Public License v2 or later.
// Licensed under the GNU General Public License v2 or later. See LICENSE.
// One PDF view for the report preview and the Plots and Tables previews. Pan and zoom follow NodeForge's scopes without the box
// zoom: two-finger scroll or drag moves, pinch, ⌘-scroll or the mouse wheel zooms at the pointer, double-click or Space fits.
// The pages are stacked in points inside one transformed layer and drawn only near the view, so a long report stays light.
import { getDocument, GlobalWorkerOptions, TextLayer, type PDFDocumentLoadingTask, type PDFDocumentProxy, type RenderTask } from "pdfjs-dist";
import { wheelIntent } from "forge-shell/app/wheel";

GlobalWorkerOptions.workerSrc = new URL("./pdf.worker.min.mjs", import.meta.url).href;

/** Page points to stage pixels: pixel = point × scale + origin. Fit follows the stage's size and each new document until the view is zoomed. */
export type PdfView = { scale: number; ox: number; oy: number; fitting: boolean };
/** "contain" shows the whole content (a plot); "width" fits the width and scrolls down (a table, a report). */
export type FitMode = "contain" | "width";

export interface PdfStageOptions {
  mode(): FitMode;
  /** The view, the pages or the document changed: refresh readouts. */
  changed(): void;
  /** The view changed, by the user or by a fit: remember it. */
  viewChanged?(view: PdfView): void;
  /** A page could not be drawn. */
  failed?(error: unknown): void;
  /** Draw each page's text over it, so a drag across text selects it; a drag elsewhere still moves the view. */
  selectable?: boolean;
  /** ⌘-click (Ctrl-click on Windows) at (x, y) points from the top-left of `page`, which is 1-based. */
  sourceClick?(page: number, x: number, y: number): void;
}

const minScale = 0.1, maxScale = 12, margin = 16, gap = 16;
/** Never more than about 16 million pixels a page. */
const pixelBudget = 16_000_000;
const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));

export class PdfStage {
  view: PdfView = { scale: 1, ox: 0, oy: 0, fitting: true };
  private readonly layer: HTMLElement;
  private task: PDFDocumentLoadingTask | null = null;
  private doc: PDFDocumentProxy | null = null;
  private sizes: { width: number; height: number }[] = [];
  private tops: number[] = [];
  private sheets: HTMLElement[] = [];
  /** The scale each page was drawn or is being drawn at; 0 when it has no drawing. */
  private planned: number[] = [];
  private renders = new Map<number, RenderTask>();
  private texts = new Map<number, TextLayer>();
  private generation = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private reported = false;
  private restored = false;

  constructor(readonly stage: HTMLElement, private readonly options: PdfStageOptions) {
    this.layer = document.createElement("div");
    this.layer.className = "pdf-sheets";
    stage.append(this.layer);
    stage.tabIndex = 0;
    new ResizeObserver(() => { if (this.view.fitting) this.fit(); else this.place(); }).observe(stage);
    this.navigation();
  }

  get loaded(): boolean { return this.doc !== null; }
  get pageCount(): number { return this.sizes.length; }
  get percent(): number { return Math.round(this.view.scale / (96 / 72) * 100); }

  /** The page under the middle of the stage. */
  get currentPage(): number {
    if (!this.tops.length) return 0;
    const middle = (this.stage.clientHeight / 2 - this.view.oy) / this.view.scale;
    let page = 1;
    this.tops.forEach((top, index) => { if (top <= middle) page = index + 1; });
    return page;
  }

  /** Show a saved view for the next document. */
  restore(view: PdfView): void { this.view = { ...view }; this.restored = true; }

  clear(): void {
    this.generation++;
    this.cancelRenders();
    if (this.timer) clearTimeout(this.timer);
    void this.task?.destroy();
    this.task = null; this.doc = null;
    this.sizes = []; this.tops = []; this.sheets = []; this.planned = [];
    this.layer.replaceChildren();
    this.layer.style.transform = "";
    this.view = { scale: 1, ox: 0, oy: 0, fitting: true };
    this.restored = false;
    this.options.changed();
  }

  /** Read a document, draw the pages near the view, then swap it for the one shown. The shown one stays until then; a failure leaves it. */
  async load(bytes: Uint8Array): Promise<void> {
    const generation = ++this.generation;
    this.reported = false;
    // pdf.js may take over the bytes it is given, so it gets a copy and the caller's stay whole.
    const task = getDocument({ data: bytes.slice() });
    let doc: PDFDocumentProxy;
    const sizes: { width: number; height: number }[] = [];
    try {
      doc = await task.promise;
      for (let number = 1; number <= doc.numPages; number++) {
        const viewport = (await doc.getPage(number)).getViewport({ scale: 1 });
        sizes.push({ width: viewport.width, height: viewport.height });
      }
    } catch (error) {
      void task.destroy();
      if (generation === this.generation) throw error;
      return;
    }
    if (generation !== this.generation) { void task.destroy(); return; }
    // A new document starts at the top, unless a saved view says where the reader was.
    const first = !this.doc && !this.restored;
    this.restored = false;
    this.cancelRenders();
    void this.task?.destroy();
    this.task = task; this.doc = doc;
    this.sizes = sizes;
    let top = 0;
    this.tops = sizes.map(size => { const at = top; top += size.height + gap; return at; });
    this.sheets = sizes.map(size => {
      const sheet = document.createElement("div"); sheet.className = "pdf-page";
      sheet.style.width = `${size.width}px`; sheet.style.height = `${size.height}px`;
      return sheet;
    });
    this.planned = sizes.map(() => 0);
    if (this.view.fitting) this.fit(first); else this.applyTransform();
    try { await this.refresh(); } catch (error) { this.fail(error); }
    if (generation !== this.generation) return;
    this.layer.replaceChildren(...this.sheets);
    // The stage may have been laid out while the pages were drawn.
    if (this.view.fitting) this.fit(); else this.place();
  }

  private content(): { width: number; height: number } {
    return { width: Math.max(0, ...this.sizes.map(size => size.width)), height: this.sizes.length ? this.tops[this.tops.length - 1] + this.sizes[this.sizes.length - 1].height : 0 };
  }

  /** In width mode with Fit on, the top and bottom of the content stop at the stage's edges. */
  private clampY(oy: number, scale: number): number {
    const height = this.stage.clientHeight, tall = this.content().height * scale;
    return clamp(oy, Math.min(margin, height - tall - margin), margin);
  }

  /** Fit the content: a plot whole in the stage, a table or report to its width. `top` starts at the top; otherwise the point at the top of the view stays there. */
  fit(top = false): void {
    const content = this.content();
    const width = this.stage.clientWidth, height = this.stage.clientHeight;
    // Not laid out yet (the pane is hidden): the resize observer fits it once it has a size.
    if (!content.width || width <= 0 || height <= 0) { this.view.fitting = true; this.place(); return; }
    const contain = this.options.mode() === "contain";
    const across = (width - 2 * margin) / content.width;
    const scale = clamp(contain ? Math.min(across, (height - 2 * margin) / content.height) : across, minScale, maxScale);
    let oy: number;
    if (contain) oy = (height - content.height * scale) / 2;
    else {
      const old = this.view;
      oy = this.clampY(top ? margin : margin - ((margin - old.oy) / old.scale) * scale, scale);
    }
    this.view = { scale, ox: (width - content.width * scale) / 2, oy, fitting: true };
    this.place();
  }

  /** Move so page `number` starts at the top of the stage. */
  goToPage(number: number): void {
    if (!this.tops.length) return;
    const index = clamp(number, 1, this.tops.length) - 1;
    const oy = margin - this.tops[index] * this.view.scale;
    this.view.oy = this.view.fitting && this.options.mode() === "width" ? this.clampY(oy, this.view.scale) : oy;
    this.place();
  }

  /** Zoom by `factor`, keeping the point under (x, y) in place. */
  zoom(factor: number, x: number, y: number): void {
    const { scale, ox, oy } = this.view;
    const next = clamp(scale * factor, minScale, maxScale);
    this.view = { scale: next, ox: x - (x - ox) * (next / scale), oy: y - (y - oy) * (next / scale), fitting: false };
    this.place();
  }

  /** Move the content by (dx, dy) pixels. A width fit only moves up and down, and stays fitted. */
  private move(dx: number, dy: number): void {
    if (this.view.fitting && this.options.mode() === "width") this.view.oy = this.clampY(this.view.oy + dy, this.view.scale);
    else { this.view.ox += dx; this.view.oy += dy; this.view.fitting = false; }
    this.place();
  }

  private navigation(): void {
    const stage = this.stage;
    stage.addEventListener("wheel", event => {
      if (!this.doc) return;
      event.preventDefault();
      const intent = wheelIntent(event, false);
      const box = stage.getBoundingClientRect();
      if (intent.kind === "zoom") this.zoom(intent.factor, event.clientX - box.left, event.clientY - box.top);
      else this.move(-intent.dx, -intent.dy);
    }, { passive: false });
    stage.addEventListener("pointerdown", event => {
      if (!this.doc || (event.button !== 0 && event.button !== 1)) return;
      if (event.button === 0 && (event.metaKey || event.ctrlKey) && this.options.sourceClick) {
        const point = this.pointAt(event.clientX, event.clientY);
        if (point) { event.preventDefault(); this.options.sourceClick(point.page, point.x, point.y); return; }
      }
      // A drag that starts on text selects it, as in any reader; one that starts anywhere else moves the view.
      if (event.button === 0 && this.onText(event)) { stage.focus({ preventScroll: true }); return; }
      event.preventDefault();
      stage.focus({ preventScroll: true });
      try { stage.setPointerCapture(event.pointerId); } catch { /* synthetic events */ }
      stage.classList.add("panning");
      let x = event.clientX, y = event.clientY;
      const drag = (next: PointerEvent) => { this.move(next.clientX - x, next.clientY - y); x = next.clientX; y = next.clientY; };
      const stop = () => {
        stage.classList.remove("panning");
        stage.removeEventListener("pointermove", drag); stage.removeEventListener("pointerup", stop); stage.removeEventListener("pointercancel", stop);
      };
      stage.addEventListener("pointermove", drag); stage.addEventListener("pointerup", stop); stage.addEventListener("pointercancel", stop);
    });
    stage.addEventListener("auxclick", event => { if (event.button === 1) event.preventDefault(); });
    stage.addEventListener("dblclick", event => { if (this.doc && !this.onText(event)) this.fit(); });
    stage.addEventListener("keydown", event => {
      if (!this.doc || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === " ") this.fit();
      else if (event.key === "PageDown") this.goToPage(this.currentPage + 1);
      else if (event.key === "PageUp") this.goToPage(this.currentPage - 1);
      else if (event.key === "Home") this.goToPage(1);
      else if (event.key === "End") this.goToPage(this.pageCount);
      else if (event.key === "+" || event.key === "=") this.zoom(1.2, this.stage.clientWidth / 2, this.stage.clientHeight / 2);
      else if (event.key === "-") this.zoom(1 / 1.2, this.stage.clientWidth / 2, this.stage.clientHeight / 2);
      else return;
      event.preventDefault();
    });
  }

  /** The page and point (in points from its top-left) under a pointer position, or null between pages. */
  private pointAt(clientX: number, clientY: number): { page: number; x: number; y: number } | null {
    const box = this.stage.getBoundingClientRect();
    const x = (clientX - box.left - this.view.ox) / this.view.scale, y = (clientY - box.top - this.view.oy) / this.view.scale;
    const index = this.tops.findIndex((top, at) => y >= top && y <= top + this.sizes[at].height);
    if (index < 0 || x < 0 || x > this.sizes[index].width) return null;
    return { page: index + 1, x, y: y - this.tops[index] };
  }

  /**
   * Bring a box on a page (in points from its top-left) to the middle of the view and outline it for a moment.
   * `follow` only moves the view when the box is out of sight, and draws no outline.
   */
  reveal(page: number, left: number, top: number, width: number, height: number, follow = false): void {
    const index = page - 1;
    if (!this.doc || index < 0 || index >= this.tops.length) return;
    if (follow) {
      const shownTop = this.view.oy + (this.tops[index] + top) * this.view.scale, shownBottom = shownTop + height * this.view.scale;
      if (shownTop >= 0 && shownBottom <= this.stage.clientHeight) return;
    }
    const middle = this.tops[index] + top + height / 2;
    const oy = this.stage.clientHeight / 2 - middle * this.view.scale;
    this.view.oy = this.view.fitting && this.options.mode() === "width" ? this.clampY(oy, this.view.scale) : oy;
    this.place();
    if (follow) return;
    this.layer.querySelector(".pdf-sync-mark")?.remove();
    const mark = document.createElement("div");
    mark.className = "pdf-sync-mark";
    // In points inside the scaled layer, so it stays on the text as the view zooms.
    mark.style.left = `${left - 2}px`; mark.style.top = `${this.tops[index] + top - 2}px`;
    mark.style.width = `${width + 4}px`; mark.style.height = `${height + 4}px`;
    this.layer.append(mark);
    setTimeout(() => mark.classList.add("fading"), 1200);
    setTimeout(() => mark.remove(), 1600);
  }

  /** Whether the pointer is over a word of a page's text layer. */
  private onText(event: Event): boolean {
    return !!this.options.selectable && event.target instanceof Element && !!event.target.closest(".pdf-text-layer span");
  }

  private applyTransform(): void {
    this.layer.style.transform = `translate(${this.view.ox}px, ${this.view.oy}px) scale(${this.view.scale})`;
  }

  /** Move the pages to the view, tell the owner, and draw again what the new view needs. */
  private place(): void {
    this.applyTransform();
    this.options.changed();
    this.options.viewChanged?.({ ...this.view });
    if (!this.doc) return;
    if (this.timer) clearTimeout(this.timer);
    // A failed redraw leaves the earlier drawing, which is still correct, only less sharp.
    this.timer = setTimeout(() => { this.refresh().catch(error => this.fail(error)); }, 120);
  }

  private fail(error: unknown): void {
    if (this.reported) return;
    this.reported = true;
    this.options.failed?.(error);
  }

  /** The pages near the stage: its own height again above and below. */
  private visible(): number[] {
    const height = this.stage.clientHeight;
    if (height <= 0) return this.sheets.length ? [0] : [];
    const { scale, oy } = this.view;
    return this.sizes.flatMap((size, index) => {
      const top = oy + this.tops[index] * scale, bottom = top + size.height * scale;
      return bottom > -height && top < 2 * height ? [index] : [];
    });
  }

  private cancelRenders(): void {
    for (const render of this.renders.values()) render.cancel();
    this.renders.clear();
    for (const text of this.texts.values()) text.cancel();
    this.texts.clear();
  }

  /** Draw the near pages that have no drawing or a blurry or oversized one; free the drawings of far pages. */
  private async refresh(): Promise<void> {
    if (!this.doc) return;
    const generation = this.generation, scale = this.view.scale;
    const near = new Set(this.visible());
    const jobs: Promise<void>[] = [];
    this.sheets.forEach((_, index) => {
      const have = this.planned[index];
      if (near.has(index)) {
        if (!have || scale > have * 1.05 || scale < have / 3) { this.planned[index] = scale; jobs.push(this.draw(index, scale, generation)); }
      } else if (have) {
        this.renders.get(index)?.cancel();
        this.sheets[index].replaceChildren(); this.planned[index] = 0;
      }
    });
    await Promise.all(jobs);
  }

  private async drawText(index: number, page: Awaited<ReturnType<PDFDocumentProxy["getPage"]>>, sheet: HTMLElement, generation: number): Promise<void> {
    const container = document.createElement("div");
    container.className = "pdf-text-layer";
    container.style.setProperty("--total-scale-factor", "1");
    sheet.append(container);
    const layer = new TextLayer({ textContentSource: page.streamTextContent(), container, viewport: page.getViewport({ scale: 1 }) });
    this.texts.set(index, layer);
    try { await layer.render(); }
    catch { container.remove(); }
    finally { if (this.texts.get(index) === layer) this.texts.delete(index); }
    if (generation !== this.generation) container.remove();
  }

  private async draw(index: number, scale: number, generation: number): Promise<void> {
    const sheet = this.sheets[index];
    try {
      const page = await this.doc!.getPage(index + 1);
      if (generation !== this.generation) return;
      const base = page.getViewport({ scale: 1 });
      const sharp = Math.min(scale * (window.devicePixelRatio || 1), Math.sqrt(pixelBudget / (base.width * base.height)));
      const viewport = page.getViewport({ scale: sharp });
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
      canvas.style.width = `${base.width}px`; canvas.style.height = `${base.height}px`;
      this.renders.get(index)?.cancel();
      const render = page.render({ canvas, canvasContext: canvas.getContext("2d")!, viewport });
      this.renders.set(index, render);
      try { await render.promise; } finally { if (this.renders.get(index) === render) this.renders.delete(index); }
      if (generation !== this.generation) return;
      // A sharper drawing replaces the canvas only; the text layer, drawn once in points, stays.
      const text = sheet.querySelector(".pdf-text-layer");
      sheet.replaceChildren(canvas, ...(text ? [text] : []));
      if (this.options.selectable && !text) await this.drawText(index, page, sheet, generation);
    } catch (error) {
      if (this.planned[index] === scale) this.planned[index] = 0;
      if ((error as { name?: string })?.name === "RenderingCancelledException") return;
      throw error;
    }
  }
}
