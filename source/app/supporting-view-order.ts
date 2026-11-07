// Licensed under the GNU General Public License v2 or later. See LICENSE.
/** Move one right-hand view to the edge indicated during a header drag. */
export function moveSupportingView(order: readonly string[], source: string, target: string, edge: "above" | "below"): string[] | null {
  if (source === target || !order.includes(source) || !order.includes(target)) return null;
  const next = order.filter(item => item !== source);
  next.splice(next.indexOf(target) + Number(edge === "below"), 0, source);
  return next.every((item, index) => item === order[index]) ? null : next;
}
