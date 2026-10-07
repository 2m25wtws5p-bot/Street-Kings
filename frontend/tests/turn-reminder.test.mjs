import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const moduleUrl = source => `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
const schedulerSource = await readFile(new URL("../src/game/turnReminder.js", import.meta.url), "utf8");
const { createTurnReminderScheduler, TURN_REMINDER_MS } = await import(moduleUrl(schedulerSource));
const hookSource = await readFile(new URL("../src/game/useTurnReminder.js", import.meta.url), "utf8");

class FakeClock {
  now = 0;
  nextId = 0;
  timers = new Map();
  setTimeout = (callback, delay) => {
    const id = ++this.nextId;
    this.timers.set(id, { at: this.now + delay, callback });
    return id;
  };
  clearTimeout = id => this.timers.delete(id);
  advance(ms) {
    const end = this.now + ms;
    while (true) {
      const next = [...this.timers].filter(([, timer]) => timer.at <= end).sort((a, b) => a[1].at - b[1].at || a[0] - b[0])[0];
      if (!next) break;
      this.now = next[1].at;
      this.timers.delete(next[0]);
      next[1].callback();
    }
    this.now = end;
  }
  pendingCallback() { return [...this.timers.values()][0]?.callback; }
}

class FakeVisibility {
  hidden = false;
  listeners = new Set();
  addEventListener(event, listener) { assert.equal(event, "visibilitychange"); this.listeners.add(listener); }
  removeEventListener(event, listener) { assert.equal(event, "visibilitychange"); this.listeners.delete(listener); }
  setHidden(hidden, notify = true) {
    this.hidden = hidden;
    if (notify) for (const listener of [...this.listeners]) listener();
  }
}

function fixture(hidden = false) {
  const clock = new FakeClock(), visibility = new FakeVisibility(), reminders = [], resets = [];
  visibility.hidden = hidden;
  const scheduler = createTurnReminderScheduler({
    setTimeout: clock.setTimeout,
    clearTimeout: clock.clearTimeout,
    visibilityTarget: visibility,
    onReminder: count => reminders.push({ count, at: clock.now }),
    onReset: () => resets.push(clock.now),
  });
  return { clock, visibility, reminders, resets, scheduler };
}
const firstTurn = { enabled: true, turnKey: "round-1:trick-1:seat-0" };

test("own-turn reminders begin at 10 seconds and repeat at 20 and 30 seconds", () => {
  assert.equal(TURN_REMINDER_MS, 10000);
  const { clock, reminders, scheduler } = fixture();
  scheduler.update(firstTurn);
  assert.deepEqual(reminders, []);
  clock.advance(9999);
  assert.deepEqual(reminders, []);
  clock.advance(1);
  clock.advance(10000);
  clock.advance(10000);
  assert.deepEqual(reminders, [{ count: 1, at: 10000 }, { count: 2, at: 20000 }, { count: 3, at: 30000 }]);
  assert.equal(clock.timers.size, 1);
  scheduler.dispose();
});

test("polling and selection updates do not postpone the same turn", () => {
  const { clock, reminders, resets, scheduler } = fixture();
  scheduler.update(firstTurn);
  for (let poll = 1; poll <= 19; poll++) {
    clock.advance(500);
    scheduler.update({ ...firstTurn, pollVersion: poll, selectedCard: `RED-${poll}` });
    assert.equal(clock.timers.size, 1);
  }
  clock.advance(500);
  assert.deepEqual(reminders, [{ count: 1, at: 10000 }]);
  assert.deepEqual(resets, [0]);
  scheduler.dispose();
});

test("a new turn gets a full wait and queued callbacks cannot affect its timer", () => {
  const { clock, reminders, resets, scheduler } = fixture();
  scheduler.update(firstTurn);
  clock.advance(9000);
  const stale = clock.pendingCallback();
  scheduler.update({ enabled: true, turnKey: "round-1:trick-2:seat-0" });
  stale();
  assert.equal(clock.timers.size, 1);
  clock.advance(9999);
  assert.deepEqual(reminders, []);
  clock.advance(1);
  assert.deepEqual(reminders, [{ count: 1, at: 19000 }]);
  assert.deepEqual(resets, [0, 9000]);
  scheduler.dispose();
});

test("disabling stops reminders and re-enabling starts a fresh wait", () => {
  const { clock, reminders, scheduler } = fixture();
  scheduler.update(firstTurn);
  clock.advance(10000);
  const stale = clock.pendingCallback();
  scheduler.update({ ...firstTurn, enabled: false });
  assert.equal(clock.timers.size, 0);
  stale();
  clock.advance(30000);
  assert.equal(reminders.length, 1);
  scheduler.update(firstTurn);
  clock.advance(9999);
  assert.equal(reminders.length, 1);
  clock.advance(1);
  assert.deepEqual(reminders.at(-1), { count: 1, at: 50000 });
  scheduler.dispose();
});

test("dispose removes timers and listeners and remains safe if called twice", () => {
  const { clock, visibility, reminders, scheduler } = fixture();
  scheduler.update(firstTurn);
  const stale = clock.pendingCallback();
  assert.equal(visibility.listeners.size, 1);
  scheduler.dispose();
  scheduler.dispose();
  scheduler.update(firstTurn);
  assert.equal(visibility.listeners.size, 0);
  assert.equal(clock.timers.size, 0);
  stale();
  clock.advance(30000);
  assert.deepEqual(reminders, []);
});

test("hidden tabs suppress reminders and visibility resumes with a fresh 10 seconds", () => {
  const { clock, visibility, reminders, scheduler } = fixture();
  scheduler.update(firstTurn);
  clock.advance(9000);
  const stale = clock.pendingCallback();
  visibility.setHidden(true);
  assert.equal(clock.timers.size, 0);
  stale();
  clock.advance(120000);
  assert.deepEqual(reminders, []);
  visibility.setHidden(false);
  clock.advance(9999);
  assert.deepEqual(reminders, []);
  clock.advance(1);
  assert.deepEqual(reminders, [{ count: 1, at: 139000 }]);
  clock.advance(10000);
  assert.deepEqual(reminders.at(-1), { count: 2, at: 149000 });
  scheduler.dispose();
});

test("starting hidden and a delayed visibility event never produce hidden audio", () => {
  const { clock, visibility, reminders, scheduler } = fixture(true);
  scheduler.update(firstTurn);
  assert.equal(clock.timers.size, 0);
  clock.advance(30000);
  visibility.setHidden(false);
  clock.advance(9000);
  visibility.setHidden(true, false);
  clock.advance(1000);
  assert.deepEqual(reminders, []);
  assert.equal(clock.timers.size, 0);
  visibility.setHidden(false);
  clock.advance(10000);
  assert.deepEqual(reminders, [{ count: 1, at: 50000 }]);
  scheduler.dispose();
});

test("scheduler works without a DOM and callbacks can safely replace the turn", () => {
  const clock = new FakeClock(), counts = [];
  const scheduler = createTurnReminderScheduler({
    setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout, visibilityTarget: null,
    onReminder(count) {
      counts.push(count);
      if (counts.length === 1) scheduler.update({ enabled: true, turnKey: "next" });
      else scheduler.dispose();
    },
  });
  scheduler.update(firstTurn);
  clock.advance(10000);
  assert.equal(clock.timers.size, 1);
  clock.advance(10000);
  assert.deepEqual(counts, [1, 1]);
  assert.equal(clock.timers.size, 0);
});

// Run the real hook with a small React lifecycle harness: renders and effects
// remain separate so a queued callback can be tested before old effect cleanup.
function hookHarness(clock, visibility) {
  const slots = [], pendingEffects = new Map(), sounds = [];
  let cursor = 0;
  const useRef = value => {
    const index = cursor++;
    if (!slots[index]) slots[index] = { current: value };
    return slots[index];
  };
  const useState = value => {
    const index = cursor++;
    if (!slots[index]) slots[index] = { value };
    return [slots[index].value, next => { slots[index].value = next; }];
  };
  const useEffect = (create, deps) => {
    const index = cursor++, previous = slots[index];
    if (!previous || deps.some((dep, i) => !Object.is(dep, previous.deps[i]))) {
      slots[index] = { deps, cleanup: previous?.cleanup };
      pendingEffects.set(index, create);
    }
  };
  const injectedScheduler = options => createTurnReminderScheduler({
    ...options, setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout, visibilityTarget: visibility,
  });
  const useTurnReminder = Function("useEffect", "useRef", "useState", "createTurnReminderScheduler", "sfx",
    `${hookSource.replace(/^import .*;\r?\n/gm, "").replace("export function", "function")}\nreturn useTurnReminder;`
  )(useEffect, useRef, useState, injectedScheduler, { turnReminder: () => sounds.push(clock.now) });
  const flush = () => {
    for (const [index, create] of pendingEffects) {
      slots[index].cleanup?.();
      slots[index].cleanup = create();
    }
    pendingEffects.clear();
  };
  return {
    sounds,
    render(input, flushEffects = true) {
      cursor = 0;
      const count = useTurnReminder(input);
      if (flushEffects) flush();
      return count;
    },
    flush,
    unmount() { for (const slot of slots) slot?.cleanup?.(); },
  };
}

test("hook returns zero on turn start, pulses after 10 seconds and survives polling renders", () => {
  const clock = new FakeClock(), visibility = new FakeVisibility(), hook = hookHarness(clock, visibility);
  assert.equal(hook.render(firstTurn), 0);
  assert.deepEqual(hook.sounds, []);
  clock.advance(9000);
  assert.equal(hook.render({ ...firstTurn, selectedCard: "RED-1" }), 0);
  clock.advance(1000);
  assert.equal(hook.render(firstTurn), 1);
  clock.advance(10000);
  assert.equal(hook.render(firstTurn), 2);
  assert.deepEqual(hook.sounds, [10000, 20000]);
  assert.equal(clock.timers.size, 1);
  visibility.setHidden(true);
  assert.equal(hook.render(firstTurn), 0);
  visibility.setHidden(false);
  clock.advance(10000);
  assert.equal(hook.render(firstTurn), 1);
  hook.unmount();
  assert.equal(clock.timers.size, 0);
  assert.equal(visibility.listeners.size, 0);
});

test("hook guards callbacks between turn render and cleanup and resets on disable", () => {
  const clock = new FakeClock(), hook = hookHarness(clock, new FakeVisibility());
  hook.render(firstTurn);
  clock.advance(10000);
  assert.equal(hook.render(firstTurn), 1);
  const nextTurn = { enabled: true, turnKey: "round-2:trick-1:seat-0" };
  assert.equal(hook.render(nextTurn, false), 0);
  clock.advance(10000); // Old effect is still mounted, but its turn is stale.
  assert.deepEqual(hook.sounds, [10000]);
  hook.flush();
  assert.equal(clock.timers.size, 1);
  clock.advance(10000);
  assert.equal(hook.render(nextTurn), 1);
  assert.equal(hook.render({ ...nextTurn, enabled: false }, false), 0);
  clock.advance(10000);
  assert.deepEqual(hook.sounds, [10000, 30000]);
  hook.flush();
  assert.equal(clock.timers.size, 0);
  assert.equal(hook.render(nextTurn), 0);
  hook.unmount();
});
