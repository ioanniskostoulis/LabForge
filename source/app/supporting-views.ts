// Licensed under the GNU General Public License v2 or later. See LICENSE.
// Report-local text views beside main.tex. The PDF is another movable view in the same stack.
import { Compartment, EditorState, type Extension } from "@codemirror/state";
import { EditorView, keymap, lineNumbers } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { bracketMatching, syntaxHighlighting } from "@codemirror/language";
import { createViewHeader } from "forge-shell/app/view-header";
import { UI_ICONS } from "forge-shell/app/tool-icons";
import { editorOptionExtensions, latexHighlight, latexLanguage, spellingContextMenu } from "./latex-editor";
import type { EditorSettings } from "./editor-settings";
import { FindController, createFindBar } from "forge-shell/app/find-bar";
import { supportingFileEditable } from "./supporting-file-rules";
import { moveSupportingView } from "./supporting-view-order";

export type SupportingView = {
  projectId: string; path: string; root: HTMLElement; head: HTMLElement; view: EditorView;
  diskText: string; dirty: boolean; editable: boolean; asking: boolean; finder: FindController;
  compartments: Record<keyof ReturnType<typeof editorOptionExtensions>, Compartment>;
};

export class SupportingViews {
  private readonly stack: HTMLElement;
  private readonly column: HTMLElement;
  private readonly divider: HTMLElement;
  private readonly pdf: HTMLElement;
  private readonly views = new Map<string, SupportingView[]>();
  private readonly orders = new Map<string, string[]>();
  private projectId: string | null = null;
  private pdfOpen = false;
  private settings: EditorSettings;
  private fontSize: number;
  private language = "el";

  constructor(settings: EditorSettings, fontSize: number,
    private readonly changed: (file: SupportingView) => void,
    private readonly closeRequested: (file: SupportingView) => void,
    private readonly revealRequested: (file: SupportingView) => void = () => {}) {
    this.stack = document.getElementById("side-stack")!;
    this.column = document.getElementById("pdf-side")!;
    this.divider = document.getElementById("pdf-split")!;
    this.pdf = document.getElementById("pdf-tile")!;
    this.settings = settings;
    this.fontSize = fontSize;
    this.makeDraggable(this.pdf, "pdf");
  }

  files(projectId: string): SupportingView[] { return this.views.get(projectId) ?? []; }
  hasDirty(projectId: string): boolean { return this.files(projectId).some(file => file.dirty); }
  find(projectId: string, path: string): SupportingView | undefined { return this.files(projectId).find(file => file.path === path); }
  focused(): SupportingView | undefined { return this.projectId ? this.files(this.projectId).find(file => file.view.hasFocus) : undefined; }

  showProject(projectId: string | null, pdfOpen: boolean, language: string): void {
    this.projectId = projectId; this.pdfOpen = pdfOpen; this.language = language;
    for (const group of this.views.values()) for (const file of group) file.root.hidden = file.projectId !== projectId;
    this.render();
    this.setLanguage(language);
  }
  setPdfOpen(open: boolean): void { this.pdfOpen = open; this.render(); }
  setLanguage(language: string): void {
    this.language = language;
    for (const file of this.projectId ? this.files(this.projectId) : []) file.view.contentDOM.lang = language;
  }
  configure(settings: EditorSettings, fontSize: number): void {
    this.settings = settings; this.fontSize = fontSize;
    for (const group of this.views.values()) for (const file of group) {
      const content = editorOptionExtensions(settings, fontSize);
      file.view.dispatch({ effects: (Object.keys(content) as (keyof typeof content)[]).map(key => file.compartments[key].reconfigure(content[key])) });
    }
  }

  open(projectId: string, path: string, text: string): SupportingView {
    const existing = this.find(projectId, path);
    if (existing) { existing.view.focus(); return existing; }
    const editable = supportingFileEditable(path);
    const root = document.createElement("section"); root.className = "side-view supporting-view";
    // The shell's view header; its unsaved dot follows the file below. The header is also the handle that drags the view.
    let file: SupportingView | null = null;
    const manager = navigator.platform.includes("Mac") ? "Finder" : "File Explorer";
    const head = createViewHeader({ title: path, closeLabel: `Close ${path}`,
      actions: [{ icon: UI_ICONS.reveal, label: `Show in ${manager}`, run: () => { if (file) this.revealRequested(file); } }],
      onClose: () => { if (file) this.closeRequested(file); } });
    head.classList.add("side-view-head");
    const dirty = head.querySelector<HTMLElement>(".view-dirty")!;
    const surface = document.createElement("div"); surface.className = "supporting-editor-surface"; root.append(head, surface);
    const compartments = Object.fromEntries(Object.keys(editorOptionExtensions(this.settings, this.fontSize)).map(key => [key, new Compartment()])) as SupportingView["compartments"];
    const optionContent = editorOptionExtensions(this.settings, this.fontSize);
    const finder = new FindController(() => view, createFindBar(path));
    const extensions: Extension[] = [lineNumbers(), history(), bracketMatching(), ...finder.extensions(),
      ...(path.endsWith(".tex") || path.endsWith(".cls") || path.endsWith(".sty") ? [latexLanguage, syntaxHighlighting(latexHighlight)] : []),
      keymap.of([...defaultKeymap, ...historyKeymap]),
      ...((Object.keys(optionContent) as (keyof typeof optionContent)[]).map(key => compartments[key].of(optionContent[key]))),
      EditorState.readOnly.of(!editable), EditorView.editable.of(editable),
      EditorView.contentAttributes.of({ "aria-label": `${path} editor`, autocapitalize: "off", autocorrect: "off" }),
      EditorView.domEventHandlers({
        contextmenu: (event, view) => spellingContextMenu(view, event, this.settings.spellcheck),
        keydown: (event, view) => event.shiftKey && event.key === "F10" && spellingContextMenu(view, event, this.settings.spellcheck),
      }),
      EditorView.updateListener.of(update => {
        if (!update.docChanged) return;
        if (!file) return;
        file.dirty = update.state.doc.toString() !== file.diskText;
        dirty.classList.toggle("on", file.dirty);
        this.changed(file);
      }),
    ];
    const view = new EditorView({ parent: surface, state: EditorState.create({ doc: text, extensions }) });
    view.contentDOM.lang = this.language;
    file = { projectId, path, root, head, view, diskText: text, dirty: false, editable, asking: false, finder, compartments };
    this.makeDraggable(root, path);
    const group = this.files(projectId);
    if (!this.views.has(projectId)) this.views.set(projectId, group);
    group.push(file);
    const order = this.orders.get(projectId) ?? ["pdf"];
    if (!this.orders.has(projectId)) this.orders.set(projectId, order);
    order.push(path);
    this.render();
    view.focus();
    return file;
  }

  remove(file: SupportingView): void {
    const group = this.files(file.projectId);
    this.views.set(file.projectId, group.filter(item => item !== file));
    this.orders.set(file.projectId, (this.orders.get(file.projectId) ?? []).filter(path => path !== file.path));
    file.view.destroy(); file.root.remove(); this.render();
  }
  forget(projectId: string): void { for (const file of [...this.files(projectId)]) this.remove(file); this.views.delete(projectId); this.orders.delete(projectId); }

  private render(): void {
    if (!this.projectId) { this.column.hidden = this.divider.hidden = true; return; }
    const order = this.orders.get(this.projectId) ?? ["pdf"];
    const tiles = order.map(path => path === "pdf" ? this.pdf : this.find(this.projectId!, path)?.root).filter((tile): tile is HTMLElement => !!tile);
    this.stack.replaceChildren(...tiles);
    this.pdf.hidden = !this.pdfOpen;
    for (const file of this.files(this.projectId)) file.root.hidden = false;
    const visible = tiles.filter(tile => !tile.hidden);
    this.column.hidden = this.divider.hidden = !visible.length;
    this.stack.querySelectorAll(".side-view-divider").forEach(node => node.remove());
    for (let i = 1; i < visible.length; i++) {
      const split = document.createElement("div"); split.className = "side-view-divider"; split.setAttribute("role", "separator"); split.setAttribute("aria-label", "Resize adjacent views"); split.tabIndex = 0;
      visible[i].before(split);
      split.addEventListener("pointerdown", event => {
        const upper = visible[i - 1], lower = visible[i];
        const startY = event.clientY, startUpper = upper.getBoundingClientRect().height, startLower = lower.getBoundingClientRect().height;
        split.setPointerCapture(event.pointerId);
        const move = (next: PointerEvent) => { const upperHeight = Math.max(120, Math.min(startUpper + startLower - 120, startUpper + next.clientY - startY)); upper.style.flex = `0 0 ${upperHeight}px`; lower.style.flex = `0 0 ${startUpper + startLower - upperHeight}px`; };
        const stop = () => { split.removeEventListener("pointermove", move); split.removeEventListener("pointerup", stop); };
        split.addEventListener("pointermove", move); split.addEventListener("pointerup", stop);
      });
    }
    for (const file of this.files(this.projectId)) file.view.requestMeasure();
  }

  private makeDraggable(tile: HTMLElement, id: string): void {
    const head = tile.querySelector<HTMLElement>(".side-view-head")!;
    tile.dataset.sideView = id;
    head.addEventListener("pointerdown", event => {
      if (event.button !== 0 || (event.target as Element).closest("button")) return;
      const projectId = this.projectId;
      if (!projectId) return;
      event.preventDefault();
      const originY = event.clientY;
      let target: HTMLElement | null = null;
      let edge: "above" | "below" = "above";
      let moving = false;
      const clear = () => {
        target?.classList.remove("drop-above", "drop-below");
        target = null;
      };
      const move = (next: PointerEvent) => {
        if (next.pointerId !== event.pointerId) return;
        if (!moving && Math.abs(next.clientY - originY) < 5) return;
        moving = true;
        clear();
        const candidate = document.elementFromPoint(next.clientX, next.clientY)?.closest<HTMLElement>(".side-view");
        if (candidate?.parentElement === this.stack && candidate !== tile && !candidate.hidden) {
          const destinationId = candidate.dataset.sideView;
          edge = next.clientY < candidate.getBoundingClientRect().top + candidate.getBoundingClientRect().height / 2 ? "above" : "below";
          if (destinationId && moveSupportingView(this.orders.get(projectId) ?? ["pdf"], id, destinationId, edge)) {
            target = candidate;
            candidate.classList.add(edge === "above" ? "drop-above" : "drop-below");
          }
        }
      };
      const stop = (next: PointerEvent) => {
        if (next.pointerId !== event.pointerId) return;
        move(next);
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", stop);
        window.removeEventListener("pointercancel", cancel);
        document.removeEventListener("keydown", escape);
        const destination = target;
        clear();
        if (!moving || !destination || this.projectId !== projectId) return;
        const destinationId = destination.dataset.sideView;
        if (!destinationId) return;
        const nextOrder = moveSupportingView(this.orders.get(projectId) ?? ["pdf"], id, destinationId, edge);
        if (!nextOrder) return;
        this.orders.set(projectId, nextOrder);
        this.render();
      };
      const cancel = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", stop);
        window.removeEventListener("pointercancel", cancel);
        document.removeEventListener("keydown", escape);
        clear();
      };
      const escape = (next: KeyboardEvent) => {
        if (next.key !== "Escape") return;
        next.preventDefault();
        cancel();
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", stop);
      window.addEventListener("pointercancel", cancel);
      document.addEventListener("keydown", escape);
    });
  }
}
