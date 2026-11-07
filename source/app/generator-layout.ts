// Licensed under the GNU General Public License v2 or later. See LICENSE.
// The Plots and Tables layout: the options on the left take at least a third of the pane, so the
// Code and Preview tiles together take at most two thirds; the tiles share that room. Both panes
// use the same shares, remembered as app preferences.

/** The options panel as a share of the pane: a third to a half, never under 280 px. */
export const optionsShare = { min: 1 / 3, max: 1 / 2, initial: 1 / 3, minPx: 280 } as const;
/** The Code tile's share of the tiles; the Preview tile has the rest. */
export const codeShare = { min: 0.25, max: 0.75, initial: 0.5 } as const;
/** Each tile keeps at least this much; a narrower pane scrolls sideways. */
export const tileMinimum = 220;
const splitter = 1;

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

/** The options width in px for a pane `total` px wide. */
export function fitOptions(total: number, share: number): number {
  const min = Math.max(optionsShare.minPx, total * optionsShare.min);
  const max = Math.max(min, total * optionsShare.max);
  return Math.round(clamp(total * share, min, max));
}

/** The share a dragged options width stands for, kept within its limits. */
export function optionsShareOf(total: number, width: number): number {
  return total > 0 ? clamp(width / total, optionsShare.min, optionsShare.max) : optionsShare.initial;
}

/** The Code tile's width in px when the tiles have `room` px between them. */
export function fitCode(room: number, share: number): number {
  const width = room - splitter;
  return Math.round(clamp(width * clamp(share, codeShare.min, codeShare.max), tileMinimum, Math.max(tileMinimum, width - tileMinimum)));
}

/** A saved share, or the default when it is missing or out of range. */
export function restoreShare(stored: unknown, limits: { min: number; max: number; initial: number }): number {
  return typeof stored === "number" && Number.isFinite(stored) && stored >= limits.min && stored <= limits.max ? stored : limits.initial;
}
