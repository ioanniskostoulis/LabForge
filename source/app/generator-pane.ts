// Adapted from NodeForge. Copyright (C) Ioannis Kostoulis. Licensed under the GNU General Public License v2 or later.
// Licensed under the GNU General Public License v2 or later. See LICENSE.
// The Plots and Tables panes: one layout for both. On the left the options, rows of a label and an
// inspector-style control; on the right two tiles side by side, as NodeForge's
// scopes: Code (editable, with the editor's text size and options, and Save) and Preview
// (the code built with the report class, panned and zoomed like a scope). Each report keeps its own
// options, code and undo history for the session.
import { Compartment, EditorState, RangeSet, StateField, type Extension } from "@codemirror/state";
import { Decoration, EditorView, drawSelection, keymap, type DecorationSet } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { FindController, createFindBar } from "forge-shell/app/find-bar";
import { syntaxHighlighting } from "@codemirror/language";
import { PdfStage } from "./pdf-stage";
import { setTip } from "forge-shell/app/tips";
import { createSelectControl } from "forge-shell/app/select-control";
import { editorOptionExtensions, latexHighlight, latexLanguage } from "./latex-editor";
import type { EditorSettings } from "./editor-settings";
import { reindent, writePlot, type GeneratorSettings, type PlotSettings } from "../engine/generators";
import { PreviewScheduler, type PreviewResult } from "./generator-preview";
import { codeShare, fitCode, fitOptions, optionsShare, optionsShareOf } from "./generator-layout";
import { customFunction, customPoints, formSettings, needsData, partsFor, plotFormDefaults, sizeKeys, tableFormDefaults, type GeneratorKind, type PlotForm, type TableForm } from "./generator-form";
import { patchCode, type CodePart } from "./generator-patch";
import { changedOptions, readCode } from "./generator-read";

export type { GeneratorKind } from "./generator-form";
type Form = PlotForm | TableForm;

export interface GeneratorHost {
  /** The desktop app builds previews and reads data files; the browser preview does neither. */
  readonly desktop: boolean;
  /** Spreadsheets beside the report file, by name, and those older reports keep in data/. */
  dataFiles(): string[];
  /** Asks for any spreadsheet; the name relative to the report file's folder, or null when cancelled. */
  pickSource(): Promise<string | null>;
  sheets(source: string): Promise<string[]>;
  code(settings: GeneratorSettings): Promise<string>;
  build(kind: GeneratorKind, code: string, keys: string): Promise<PreviewResult>;
  /** `keys` are the width and height for the line to write in main.tex. */
  save(kind: GeneratorKind, code: string, source: string | undefined, keys: string): Promise<void>;
  problem(text: string): void;
  /** The options' share of the pane and the Code tile's share of the tiles, remembered as app preferences. */
  optionsShare(): number;
  saveOptionsShare(share: number): void;
  codeShare(): number;
  saveCodeShare(share: number): void;
  /** The center editor's options and text size, which the Code tile follows. */
  editorSettings(): EditorSettings;
  editorFontSize(): number;
}

/** `snapshot` is what the code said about the options when the options last wrote it, to tell a hand edit from the options' own writing. */
type ProjectState = { form: Form; editor: EditorState | null; sheets: string[]; parts: Set<CodePart>; snapshot: ReturnType<typeof readCode> | null; picked: string[] };
/** The Source choice that opens the file dialog. */
const otherFile = "other:file";
/** Said in the Code and Preview tiles alike while no data file (or custom source) is chosen. */
const noDataText = "No spreadsheets. Save the report beside one, or choose another file.";

const settingsLine = /^% labforge (?:plot|table) \{.*\}$/;

export class GeneratorPane {
  private readonly form: HTMLElement;
  private readonly problemLine: HTMLElement;
  private readonly tiles: HTMLElement;
  private readonly codeHost: HTMLElement;
  private readonly lineCount: HTMLElement;
  private readonly saveButton: HTMLButtonElement;
  private readonly stage: HTMLElement;
  private readonly pdf: PdfStage;
  private readonly status: HTMLElement;
  private readonly fitButton: HTMLButtonElement;
  private readonly note: HTMLElement;
  private readonly view: EditorView;
  /** Find and replace in the code tile. */
  readonly finder: FindController;
  private readonly options = new Compartment();
  private readonly editable = new Compartment();
  private readonly codeNote: HTMLElement;
  /** No source is chosen: the options are greyed out and both tiles say so. */
  private idle = false;
  /** The options are writing the code, so the change is not a hand edit. */
  private writing = false;
  private syncTimer: ReturnType<typeof setTimeout> | undefined;
  private readonly scheduler: PreviewScheduler;
  private readonly states = new Map<string, ProjectState>();
  private project: string | null = null;
  private setting = false;
  private generation = 0;
  private codeTimer: ReturnType<typeof setTimeout> | undefined;
  private problemText = "";
  private building = false;
  /** The data files the Source list was last drawn with. */
  private sourcesShown = "";
  constructor(private readonly root: HTMLElement, private readonly kind: GeneratorKind, private readonly host: GeneratorHost) {
    root.classList.add("generator");
    root.replaceChildren();
    const options = element("div", "generator-options");
    this.form = element("div", "generator-fields");
    this.problemLine = element("div", "generator-problem");
    this.problemLine.setAttribute("role", "status");
    options.append(this.form, this.problemLine);

    this.tiles = element("div", "generator-tiles");
    // Code tile: title, line count, Save
    const codeTile = element("section", "generator-tile");
    codeTile.setAttribute("aria-label", "Code");
    this.lineCount = element("span", "generator-tile-readout");
    this.saveButton = chip("Save", `Save this code as a new file in ${kind}s/.`, () => { void this.save(); });
    this.saveButton.classList.add("primary");
    codeTile.append(tileHead("Code", this.lineCount, [this.saveButton]));
    this.codeHost = element("div", "generator-code-editor");
    this.codeNote = element("div", "generator-preview-note");
    codeTile.append(this.codeHost, this.codeNote);
    codeTile.classList.add("has-note");
    // Preview tile: title, zoom or build state, Fit
    const previewTile = element("section", "generator-tile");
    previewTile.setAttribute("aria-label", "Preview");
    this.status = element("span", "generator-tile-readout");
    this.status.setAttribute("aria-live", "polite");
    this.fitButton = chip("Fit", "Fit the preview to the tile.", () => this.pdf.fit());
    previewTile.append(tileHead("Preview", this.status, [this.fitButton]));
    this.stage = element("div", "pdf-stage");
    this.stage.setAttribute("role", "img");
    this.stage.setAttribute("aria-label", `${kind === "plot" ? "Plot" : "Table"} preview`);
    this.pdf = new PdfStage(this.stage, {
      // A plot fits whole inside the tile; a table fits its width from the top and is scrolled, since it can run long.
      mode: () => kind === "plot" ? "contain" : "width",
      changed: () => this.updateReadout(),
      failed: error => { this.problemText = String(error); this.host.problem(`The ${this.kind} preview could not be shown: ${String(error).replace(/^Error: /, "")}`); },
    });
    this.note = element("div", "generator-preview-note");
    this.stage.append(this.note);
    previewTile.append(this.stage);
    this.tiles.append(codeTile, this.splitter("code"), previewTile);
    root.append(options, this.splitter("options"), this.tiles);
    new ResizeObserver(() => this.applyLayout()).observe(root);

    this.finder = new FindController(() => this.view, createFindBar(`${kind} code`));
    this.view = new EditorView({ parent: this.codeHost, state: this.createState("") });
    this.scheduler = new PreviewScheduler({
      build: code => this.host.build(this.kind, code, this.keys()),
      show: pdf => { this.problemText = ""; this.pdf.load(pdf).catch(error => { this.problemText = String(error); this.host.problem(`The ${this.kind} preview could not be shown: ${String(error).replace(/^Error: /, "")}`); }); },
      busy: running => { this.building = running; this.updateReadout(); },
      problem: text => { this.problemText = text; this.host.problem(`The ${this.kind} preview did not build: ${text}`); this.updateReadout(); },
    });
    this.showProject(null);
  }

  /** Sets the widths: the options a third to a half of the pane, the tiles sharing the rest. */
  applyLayout(): void {
    const total = this.root.clientWidth;
    if (total <= 0) return;
    const optionsWidth = fitOptions(total, this.host.optionsShare());
    this.root.style.setProperty("--generator-options", `${optionsWidth}px`);
    this.tiles.style.setProperty("--generator-code", `${fitCode(total - optionsWidth - 1, this.host.codeShare())}px`);
  }

  /** The Code tile follows the center editor's options and text size. */
  configureEditor(): void {
    this.root.style.setProperty("--generator-code-size", `${this.codeSize()}px`);
    this.view.dispatch({ effects: this.options.reconfigure(this.optionExtensions()) });
    // A new tab size re-indents plot code (one undoable change), so new and earlier lines match.
    const unit = " ".repeat(this.host.editorSettings().tabSize);
    if (this.view.state.doc.length) this.setCode(reindent(this.view.state.doc.toString(), unit));
  }

  private optionExtensions(): Extension {
    return Object.values(editorOptionExtensions(this.host.editorSettings(), this.codeSize()));
  }

  /** The code's text size: the editor's, scaled so the default 14 px sits at the options' 12 px; ⌘+ and ⌘− still change it. */
  private codeSize(): number { return Math.round(this.host.editorFontSize() * 12 / 14); }

  /** The basic wrappers shown until the options are complete, so the Code tile is never empty. */
  private skeleton(): string {
    const unit = " ".repeat(this.host.editorSettings().tabSize);
    if (this.kind === "table") return `\\begin{labtable}{}\n${unit}\\tablehead{}\n\\end{labtable}\n`;
    return `\\begin{tikzpicture}\n${unit}\\begin{axis}\n${unit}\\end{axis}\n\\end{tikzpicture}\n`;
  }

  /** A problem in the options: shown under them; an empty Code tile gets the basic wrappers. */
  private incomplete(problem: string): void {
    this.formProblem(problem);
    if (!this.view.state.doc.toString().trim()) this.setCode(this.skeleton());
  }

  /** A splitter after the options or between the tiles: drag, arrow keys, or double-click for the default. */
  private splitter(which: "options" | "code"): HTMLElement {
    const split = element("div", "split vertical generator-split");
    split.setAttribute("role", "separator");
    split.setAttribute("aria-orientation", "vertical");
    split.setAttribute("aria-label", which === "options" ? "Resize the options" : "Resize the code and the preview");
    setTip(split, which === "options" ? "Sets the width of the options; double-click restores the default." : "Sets the widths of the code and the preview; double-click restores the default.");
    split.tabIndex = 0;
    const widths = () => {
      const total = this.root.clientWidth, optionsWidth = fitOptions(total, this.host.optionsShare());
      return { total, optionsWidth, room: total - optionsWidth - 1, codeWidth: fitCode(total - optionsWidth - 1, this.host.codeShare()) };
    };
    const set = (width: number) => {
      const { total, room } = widths();
      if (which === "options") this.host.saveOptionsShare(optionsShareOf(total, width));
      else this.host.saveCodeShare(Math.max(codeShare.min, Math.min(codeShare.max, width / Math.max(1, room - 1))));
      this.applyLayout();
    };
    const current = () => which === "options" ? widths().optionsWidth : widths().codeWidth;
    split.addEventListener("pointerdown", event => {
      try { split.setPointerCapture(event.pointerId); } catch { /* the pointer ended already */ }
      const start = event.clientX, width = current();
      const move = (next: PointerEvent) => set(width + next.clientX - start);
      const stop = () => { split.removeEventListener("pointermove", move); split.removeEventListener("pointerup", stop); split.removeEventListener("pointercancel", stop); };
      split.addEventListener("pointermove", move); split.addEventListener("pointerup", stop); split.addEventListener("pointercancel", stop);
    });
    split.addEventListener("dblclick", () => {
      if (which === "options") this.host.saveOptionsShare(optionsShare.initial); else this.host.saveCodeShare(codeShare.initial);
      this.applyLayout();
    });
    split.addEventListener("keydown", event => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault();
      set(current() + (event.key === "ArrowRight" ? 16 : -16));
    });
    return split;
  }

  /** Shows the options, code and preview of a report, or an empty pane when none is open. */
  showProject(id: string | null): void {
    if (this.project) { const state = this.states.get(this.project); if (state) state.editor = this.view.state; }
    this.project = id;
    this.scheduler.cancel();
    this.clearPreview();
    this.problemText = "";
    if (!id) { this.form.replaceChildren(); this.formProblem(""); this.setCode(""); this.idle = false; this.codeHost.classList.remove("idle"); this.updateReadout(); this.updateButtons(); return; }
    let state = this.states.get(id);
    if (!state) { state = { form: { ...(this.kind === "plot" ? { ...plotFormDefaults, source: "" } : tableFormDefaults) }, editor: null, sheets: [], parts: new Set(), snapshot: null, picked: [] }; this.states.set(id, state); }
    if (!this.validSource(state.form)) state.form.source = this.defaultSource();
    this.sourcesShown = this.host.dataFiles().join("\n");
    this.renderForm();
    if (!state.sheets.length && state.form.source && !state.form.source.startsWith("custom:")) void this.loadSheets();
    this.setting = true;
    this.view.setState(state.editor ?? this.createState(""));
    this.view.dispatch({ effects: this.editable.reconfigure(EditorView.editable.of(!this.idle)) });
    this.setting = false;
    // A kept state carries the editor options it was made with.
    this.configureEditor();
    if (state.editor) this.requestPreview(); else this.regenerate();
    this.updateReadout();
    this.updateButtons();
  }

  /** The report's files changed. The form is drawn again only when the data files changed, so typing in it is not interrupted; when the chosen data file is gone, Source falls back and the code is written again. */
  refreshSources(): void {
    const state = this.current();
    if (!state) return;
    const files = this.host.dataFiles().join("\n");
    if (files === this.sourcesShown) return;
    this.sourcesShown = files;
    if (!this.validSource(state.form)) {
      state.form = { ...state.form, source: this.defaultSource(), sheet: "" };
      state.sheets = [];
      state.parts.add("settings");
      for (const part of partsFor(this.kind, "source")) state.parts.add(part);
      this.scheduleCode();
      void this.loadSheets();
    }
    this.renderForm();
  }

  /** Forgets a closed report. */
  forget(id: string): void { this.states.delete(id); if (this.project === id) this.showProject(null); }

  /** Width and height for the preview and the line to write in main.tex; empty while they are not valid. */
  private keys(): string {
    const state = this.current();
    const keys = state ? sizeKeys(this.kind, state.form) : "";
    return typeof keys === "string" ? keys : "";
  }

  /** True when the node is inside this pane's code tile. */
  ownsCode(node: Node | null): boolean { return !!node && this.codeHost.contains(node); }
  private current(): ProjectState | undefined { return this.project ? this.states.get(this.project) : undefined; }
  /** The spreadsheets Source offers: those beside the report file, then any chosen from elsewhere. */
  private knownSources(): string[] {
    const files = this.host.dataFiles();
    return [...files, ...(this.current()?.picked ?? []).filter(file => !files.includes(file))];
  }
  private validSource(form: Form): boolean {
    const files = this.knownSources();
    return (this.kind === "plot" && (form.source === customFunction || form.source === customPoints)) || (!!form.source && files.includes(form.source)) || (!form.source && !files.length);
  }
  /** Both start on the first spreadsheet, or on no data files when there is none. */
  private defaultSource(): string { return this.host.dataFiles()[0] ?? ""; }

  private createState(text: string): EditorState {
    return EditorState.create({ doc: text, extensions: [
      history(), drawSelection(), settingsHidden, latexLanguage, syntaxHighlighting(latexHighlight), ...this.finder.extensions(),
      this.options.of(this.optionExtensions()),
      keymap.of([...defaultKeymap, ...historyKeymap]),
      // Copying leaves out the settings line, so the code pastes cleanly into main.tex or another file.
      EditorView.clipboardOutputFilter.of(text => text.split("\n").filter(line => !settingsLine.test(line)).join("\n")),
      EditorView.contentAttributes.of({ "aria-label": `${this.kind === "plot" ? "Plot" : "Table"} code`, autocapitalize: "off", autocorrect: "off" }),
      this.editable.of(EditorView.editable.of(!this.idle)),
      EditorView.updateListener.of(update => {
        if (!update.docChanged) return;
        this.updateButtons();
        if (this.setting) return;
        this.requestPreview();
        // A hand edit moves the options that the code states plainly.
        if (!this.writing) this.scheduleSync();
      }),
    ] });
  }

  /** Replaces the code as one undoable change, so Undo in the Code tile brings back hand edits. */
  private setCode(text: string): void {
    if (this.view.state.doc.toString() === text) return;
    this.writing = true;
    try { this.view.dispatch({ changes: { from: 0, to: this.view.state.doc.length, insert: text } }); } finally { this.writing = false; }
  }

  private scheduleSync(): void {
    if (this.syncTimer) clearTimeout(this.syncTimer);
    this.syncTimer = setTimeout(() => this.syncOptions(), 300);
  }

  /** Moves the options to what the code now says, for the fields the user changed by hand; then the settings line is written again to match. */
  private syncOptions(): void {
    const state = this.current();
    const code = this.view.state.doc.toString();
    if (!state || this.idle || !code.trim()) return;
    const now = readCode(this.kind, code);
    const before = state.snapshot;
    state.snapshot = now;
    if (!before) return;
    const patch: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(changedOptions(now, before))) if (value !== undefined && (state.form as Record<string, unknown>)[key] !== value) patch[key] = value;
    // A data file the report does not have cannot be chosen.
    if ("source" in patch && !this.validSource({ ...state.form, source: patch.source as string })) { delete patch.source; delete patch.sheet; delete patch.range; }
    if (!Object.keys(patch).length) return;
    Object.assign(state.form, patch);
    state.parts.add("settings");
    if ("source" in patch) { state.sheets = []; void this.loadSheets(); }
    this.renderForm();
    this.scheduleCode();
  }

  private renderForm(): void {
    const state = this.current();
    if (!state) return;
    const form = state.form;
    const groups: HTMLElement[] = [];
    // Each change rewrites the settings line and the parts its fields own; the rest of the code stays as the user left it.
    const change = (patch: Partial<PlotForm & TableForm>, rebuild = false) => {
      Object.assign(form, patch);
      state.parts.add("settings");
      for (const name of Object.keys(patch)) for (const part of partsFor(this.kind, name)) state.parts.add(part);
      if (rebuild) this.renderForm();
      this.scheduleCode();
    };
    // A spreadsheet lists Source, Sheet, Range, then Size and Format; a plot's custom function or points replace Sheet and Range.
    // Every empty field says what it does when empty, in one word: Auto for what the class or the data decides, None for nothing.
    const sources = this.knownSources();
    const sourceOptions: [string, string][] = sources.map(file => [file, file]);
    if (!sources.length) sourceOptions.unshift(["", "No spreadsheets"]);
    if (this.host.desktop) sourceOptions.push([otherFile, "Other file…"]);
    if (this.kind === "plot") sourceOptions.push([rule, ""], [customFunction, "Function"], [customPoints, "Points"]);
    const sourceSelect = select(sourceOptions, form.source, value => {
      if (value !== otherFile) { change({ source: value, sheet: "" }, true); void this.loadSheets(); return; }
      void this.host.pickSource().then(file => {
        if (!file) { this.renderForm(); return; }
        if (!state.picked.includes(file)) state.picked.push(file);
        change({ source: file, sheet: "" }, true); void this.loadSheets();
      }, error => { this.host.problem(error instanceof Error ? error.message : String(error)); this.renderForm(); });
    }, this.kind === "plot" ? "The data to plot: a spreadsheet beside the report file or another one you choose, or a function or points typed here." : "The spreadsheet to read: one beside the report file, or another you choose.");
    const sheetSelect = select([["", "Auto"], ...state.sheets.map(name => [name, name] as [string, string])], form.sheet, value => change({ sheet: value }), "The sheet to read; Auto is the first sheet.");
    sheetSelect.disabled = !state.sheets.length;
    const rangeField = (title: string) => field("Range", text((form as PlotForm | TableForm).range, value => change({ range: value }), title));
    const width = field("Width", text(form.width, value => change({ width: value }), "A fraction of the column, such as 0.8, or a length such as 8cm; Auto is the full column.", "Auto"));
    if (this.kind === "plot") {
      const plot = form as PlotForm;
      const data: HTMLElement[] = [field("Source", sourceSelect)];
      if (plot.source === customFunction) data.push(
        field("Expression", text(plot.expression, value => change({ expression: value }), "A pgfplots expression in x, such as 0.2*x^2 or sin(deg(x)).")),
        field("Domain", text(plot.domain, value => change({ domain: value }), "From and to, such as 0:10.")));
      else if (plot.source === customPoints) {
        const area = document.createElement("textarea");
        area.className = "generator-input"; area.value = plot.points; area.rows = 3; area.spellcheck = false;
        setTip(area, "Points as x,y separated by spaces, such as 0,0 1,2.");
        area.addEventListener("input", () => change({ points: area.value }));
        data.push(field("Points", area));
      } else data.push(field("Sheet", sheetSelect), rangeField("The cells to read, with x in the first column and a series in each further one, such as A1:C20."));
      const spreadsheet = plot.source !== customFunction && plot.source !== customPoints;
      groups.push(group("Data", data),
        group("Size", [width, field("Height", text(plot.height, value => change({ height: value }), "A length, such as 6cm; Auto keeps the class's proportion.", "Auto"))]),
        group("Format", [
          field("Legend", text(plot.legend, value => change({ legend: value }), spreadsheet ? "Series names separated by commas; Auto uses the header row." : "The legend entry; None leaves it out.", spreadsheet ? "Auto" : "None")),
          field("X label", text(plot.xlabel, value => change({ xlabel: value }), "The x axis label, with its unit, such as Time (s).", "None")),
          field("Y label", text(plot.ylabel, value => change({ ylabel: value }), "The y axis label, with its unit, such as Voltage (V).", "None")),
          checks([["Grid", plot.grid, value => change({ grid: value }), "Lines at the major ticks; writes grid=major."],
            ["Log x", plot.xlog, value => change({ xlog: value }), "A logarithmic x axis; writes xmode=log."],
            ["Log y", plot.ylog, value => change({ ylog: value }), "A logarithmic y axis; writes ymode=log."]])]));
    } else {
      groups.push(group("Data", [field("Source", sourceSelect), field("Sheet", sheetSelect), rangeField("The cells to read, such as A1:C10.")]),
        group("Size", [width, field("Row height", text((form as TableForm).spread, value => change({ spread: value }), "The line spread of the rows, such as 1.2; Auto follows the report.", "Auto"))]),
        group("Format", [
          field("Alignment", text((form as TableForm).align, value => change({ align: value }), "One letter per column, l, c or r, each with an optional width such as c[2]; Auto follows the data file.", "Auto")),
          checks([["Header row", (form as TableForm).header, value => change({ header: value }), "The first row of the range is the table header."],
            ["Smart formatting", (form as TableForm).smart, value => change({ smart: value }), "Writes formulas, units and symbols as TeX, such as H2O as \\ce{H2O}."]])]));
    }
    // With no source chosen, everything but Source is greyed out; the tiles say why.
    const idle = !form.source;
    if (idle) for (const control of groups.flatMap(box => [...box.querySelectorAll<HTMLElement>("input, select, textarea, button")])) if (control !== sourceSelect) {
      if (control instanceof HTMLButtonElement || control instanceof HTMLInputElement || control instanceof HTMLSelectElement || control instanceof HTMLTextAreaElement) control.disabled = true;
    }
    for (const box of groups) box.classList.toggle("idle", idle);
    this.setIdle(idle);
    this.form.replaceChildren(...groups);
  }

  /** Greys the Code tile and shows its note, or restores them. */
  private setIdle(idle: boolean): void {
    if (idle === this.idle) return;
    this.idle = idle;
    // An empty editor still draws its current-line band, so it is hidden while the note shows.
    this.codeHost.classList.toggle("idle", idle);
    this.view.dispatch({ effects: this.editable.reconfigure(EditorView.editable.of(!idle)) });
    this.updateReadout();
  }

  private async loadSheets(): Promise<void> {
    const state = this.current();
    if (!state) return;
    const project = this.project;
    // Function and Points have no sheets.
    const file = state.form.source && !state.form.source.startsWith("custom:") ? state.form.source : "";
    state.sheets = file && this.host.desktop ? await this.host.sheets(file).catch(() => []) : [];
    if (this.project === project) this.renderForm();
  }

  private scheduleCode(): void {
    if (this.codeTimer) clearTimeout(this.codeTimer);
    this.codeTimer = setTimeout(() => this.regenerate(), 250);
  }

  /** Writes the code from the options. A problem in the options is shown under them, and the code is left as it is. */
  private regenerate(): void {
    const state = this.current();
    if (!state) return;
    const generation = ++this.generation;
    if (!state.form.source) {
      // Nothing to read: the tiles are empty and say so.
      state.parts.clear(); state.snapshot = null;
      this.formProblem(""); this.setCode(""); this.scheduler.cancel(); this.pdf.clear(); this.building = false;
      this.updateButtons(); this.updateReadout();
      return;
    }
    const settings = formSettings(this.kind, state.form);
    if (typeof settings === "string") { this.incomplete(settings); return; }
    if (needsData(settings) && !this.host.desktop) { this.incomplete("Data files are read in the LabForge desktop app."); return; }
    const code = needsData(settings) ? this.host.code(settings) : Promise.resolve(writePlot(settings as PlotSettings));
    code.then(text => {
      if (generation !== this.generation) return;
      this.formProblem("");
      // Code is indented in the editor's tab size.
      const fresh = reindent(text, " ".repeat(this.host.editorSettings().tabSize));
      // The wrappers alone hold nothing to keep, so the full code replaces them.
      const current = this.view.state.doc.toString();
      this.setCode(current === this.skeleton() ? fresh : patchCode(current, fresh, state.parts));
      state.parts.clear();
      state.snapshot = readCode(this.kind, this.view.state.doc.toString());
      this.requestPreview();
    })
      .catch(error => { if (generation === this.generation) this.incomplete(String(error).replace(/^Error: (?:Error invoking remote method '[^']+': )?(?:Error: )?/, "")); });
  }

  private formProblem(text: string): void {
    this.problemLine.textContent = text;
    this.problemLine.hidden = !text;
  }

  private requestPreview(): void {
    const code = this.view.state.doc.toString();
    // The wrappers alone draw nothing worth building.
    if (!this.host.desktop || !this.project || !code.trim() || code === this.skeleton()) { this.scheduler.cancel(); return; }
    this.scheduler.request(code);
  }

  private updateButtons(): void {
    const code = this.view.state.doc.toString();
    const empty = !this.project || !code.trim();
    this.saveButton.disabled = empty || code === this.skeleton() || !this.host.desktop;
    if (!this.host.desktop) setTip(this.saveButton, "Saving needs the LabForge desktop app.");
    const lines = this.view.state.doc.lines - (hasSettingsLine(this.view.state) ? 1 : 0);
    this.lineCount.textContent = empty ? "" : `${lines} ${lines === 1 ? "line" : "lines"}`;
  }

  /** The Preview tile's readout: the build state, else the zoom; and its note. */
  private updateReadout(): void {
    this.status.textContent = this.building ? "Building…" : this.problemText ? "Failed" : this.pdf.loaded ? `${this.pdf.percent}%` : "";
    // The shell's tile rule: work in progress reads in the accent, a failure in the error colour, the reason is in Messages.
    this.status.classList.toggle("busy", this.building);
    this.status.classList.toggle("failed", !!this.problemText && !this.building);
    this.fitButton.setAttribute("aria-pressed", String(this.pdf.view.fitting));
    this.fitButton.disabled = !this.pdf.loaded;
    const text = this.idle ? noDataText : !this.host.desktop ? "Previews are built in the LabForge desktop app." : this.pdf.loaded ? "" : "The preview appears here once the code builds.";
    this.note.textContent = text;
    this.note.hidden = !text;
    this.codeNote.textContent = noDataText;
    this.codeNote.hidden = !this.idle;
  }

  // MARK: preview navigation

  private clearPreview(): void {
    this.pdf.clear();
    this.building = false;
  }

  private async save(): Promise<void> {
    const state = this.current();
    const code = this.view.state.doc.toString();
    if (!state || !code.trim()) return;
    const settings = formSettings(this.kind, state.form);
    const source = typeof settings === "string" ? undefined : settings.kind === "table" ? settings.source : settings.series.find(series => series.type === "data" || series.type === "range")?.source;
    await this.host.save(this.kind, code, source, this.keys());
  }
}

function element(tag: string, className: string): HTMLElement { const node = document.createElement(tag); node.className = className; return node; }

function hasSettingsLine(state: EditorState): boolean { return state.doc.lines > 1 && settingsLine.test(state.doc.line(1).text); }
/** The settings line is long JSON for LabForge to read back; the Code tile hides it. The text stays in the file. */
function settingsDecorations(state: EditorState): DecorationSet {
  return hasSettingsLine(state) ? RangeSet.of([Decoration.replace({ block: true }).range(0, state.doc.line(2).from)]) : Decoration.none;
}
const settingsHidden = StateField.define<DecorationSet>({
  create: settingsDecorations,
  update: (value, transaction) => transaction.docChanged ? settingsDecorations(transaction.state) : value,
  provide: field => [EditorView.decorations.from(field), EditorView.atomicRanges.of(view => view.state.field(field))],
});

/** A tile's header, as on NodeForge's scopes: the title, a quiet readout, then its buttons at the right. */
function tileHead(title: string, readout: HTMLElement, buttons: HTMLElement[]): HTMLElement {
  const head = element("div", "generator-tile-head");
  const name = element("h3", "generator-tile-title");
  name.textContent = title;
  const spacer = element("span", "generator-tile-space");
  head.append(name, spacer, readout, ...buttons);
  return head;
}
/** A small header button: outlined, filled with the accent when on (`aria-pressed`) or primary. */
function chip(label: string, title: string, onClick: () => void): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button"; button.className = "generator-chip"; button.textContent = label; setTip(button, title);
  button.addEventListener("click", onClick);
  return button;
}
/** A titled group of options, headed like an inspector section. */
function group(title: string, children: HTMLElement[]): HTMLElement {
  const box = element("section", "generator-group");
  const heading = element("h3", "generator-group-title t-section");
  heading.textContent = title;
  box.setAttribute("aria-label", title);
  box.append(heading, ...children);
  return box;
}
/** A row: the label, then a control filling the rest; the label sits on the control's first line. */
function field(label: string, control: HTMLElement): HTMLElement {
  const box = element("label", "generator-field");
  const caption = element("span", "generator-label");
  caption.textContent = label;
  box.append(caption, control);
  return box;
}
/** On-off options as checkboxes, box first, side by side in one row. */
function checks(items: [string, boolean, (value: boolean) => void, string][]): HTMLElement {
  const row = element("div", "generator-checks");
  for (const [label, checked, onChange, title] of items) {
    const box = element("label", "generator-check");
    setTip(box, title);
    const input = document.createElement("input");
    input.type = "checkbox"; input.checked = checked;
    input.addEventListener("change", () => onChange(input.checked));
    const caption = element("span", "generator-label");
    caption.textContent = label;
    box.append(input, caption);
    row.append(box);
  }
  return row;
}
function text(value: string, onInput: (value: string) => void, title: string, hint = ""): HTMLInputElement {
  const input = document.createElement("input");
  input.className = "generator-input";
  input.type = "text"; input.value = value; setTip(input, title); input.spellcheck = false; input.placeholder = hint;
  input.addEventListener("input", () => onInput(input.value));
  return input;
}
/** In a list of options, a line between two groups. */
const rule = "---";
function select(options: [string, string][], value: string, onChange: (value: string) => void, title: string): HTMLButtonElement {
  const control = createSelectControl({ className: "generator-input select-control", label: title, title,
    choices: options.filter(([optionValue]) => optionValue !== rule).map(([optionValue, label]) => ({ value: optionValue, label })), value, onChange });
  return control;
}
