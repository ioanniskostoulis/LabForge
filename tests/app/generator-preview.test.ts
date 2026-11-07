// Licensed under the GNU General Public License v2 or later. See LICENSE.
import test from "node:test";
import assert from "node:assert/strict";
import { PreviewScheduler, type PreviewResult } from "../../source/app/generator-preview";

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
function harness(build: (code: string) => Promise<PreviewResult>) {
  const events: string[] = [];
  const scheduler = new PreviewScheduler({ build, show: pdf => events.push(`show ${new TextDecoder().decode(pdf)}`),
    busy: running => events.push(running ? "busy" : "idle"), problem: text => events.push(`problem ${text}`) }, 20);
  return { scheduler, events };
}
const ok = (code: string): PreviewResult => ({ pdf: new TextEncoder().encode(code), cached: false, error: null, diagnostics: [] });

test("typing is debounced to one build of the newest code", async () => {
  const built: string[] = [];
  const { scheduler, events } = harness(async code => { built.push(code); return ok(code); });
  for (const code of ["a", "ab", "abc"]) scheduler.request(code);
  await wait(60);
  assert.deepEqual(built, ["abc"]);
  assert.deepEqual(events.filter(event => event !== "busy"), ["show abc", "idle"]);
});

test("code that changes during a build replaces the old result", async () => {
  const built: string[] = [];
  const { scheduler, events } = harness(async code => { built.push(code); await wait(40); return ok(code); });
  scheduler.request("first");
  await wait(30);
  scheduler.request("second");
  await wait(120);
  assert.deepEqual(built, ["first", "second"]);
  assert.deepEqual(events.filter(event => event.startsWith("show")), ["show second"]);
  assert.equal(events.at(-1), "idle");
});

test("a repeated problem is reported once, and again after a good build", async () => {
  const { scheduler, events } = harness(async code => code.startsWith("bad") ? { pdf: null, cached: false, error: "line 2: Undefined control sequence.", diagnostics: [] } : ok(code));
  for (const code of ["bad1", "bad2", "good", "bad3"]) { scheduler.request(code); await wait(40); }
  assert.deepEqual(events.filter(event => event.startsWith("problem") || event.startsWith("show")),
    ["problem line 2: Undefined control sequence.", "show good", "problem line 2: Undefined control sequence."]);
});

test("a failed call is a problem, without Electron's prefix, and cancel drops waiting builds", async () => {
  const { scheduler, events } = harness(async () => { throw new Error("Error invoking remote method 'generated:preview': Error: latexmk was not found."); });
  scheduler.request("x");
  await wait(40);
  assert.ok(events.includes("problem latexmk was not found."));
  scheduler.request("y");
  scheduler.cancel();
  await wait(40);
  assert.equal(events.at(-1), "idle");
});
