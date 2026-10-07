export const TURN_REMINDER_MS = 10000;

// Keep the clock separate from React and audio so turn timing can be tested
// without waiting or requiring a browser. Repeated updates for one turn do not
// restart its deadline (online views arrive much more often than reminders).
export function createTurnReminderScheduler({
  onReminder = () => {},
  onReset = () => {},
  setTimeout: schedule = (callback, delay) => setTimeout(callback, delay),
  clearTimeout: cancel = (timer) => clearTimeout(timer),
  visibilityTarget = typeof document === "undefined" ? null : document,
} = {}) {
  let enabled = false, turnKey, timer = null, generation = 0, count = 0, disposed = false;
  const isHidden = () => visibilityTarget?.hidden === true || visibilityTarget?.visibilityState === "hidden";
  let hidden = isHidden();

  function clear() {
    generation += 1;
    if (timer !== null) cancel(timer);
    timer = null;
  }

  function arm() {
    if (disposed || !enabled || hidden) return;
    const scheduledGeneration = generation;
    timer = schedule(() => {
      // A cleared timer can already be queued by the browser. It must not
      // touch a replacement timer or signal a previous turn.
      if (disposed || !enabled || scheduledGeneration !== generation) return;
      timer = null;
      if (isHidden()) {
        hidden = true;
        clear();
        count = 0;
        onReset();
        return;
      }
      count += 1;
      onReminder(count);
      if (!disposed && enabled && scheduledGeneration === generation) arm();
    }, TURN_REMINDER_MS);
  }

  function visibilityChanged() {
    if (disposed) return;
    const nextHidden = isHidden();
    if (nextHidden === hidden) return;
    hidden = nextHidden;
    clear();
    count = 0;
    onReset();
    // Resume with a full interval: no catch-up alerts for time spent away.
    arm();
  }
  visibilityTarget?.addEventListener?.("visibilitychange", visibilityChanged);

  return {
    update(next) {
      if (disposed) return;
      const nextEnabled = Boolean(next.enabled);
      if (enabled === nextEnabled && Object.is(turnKey, next.turnKey)) return;
      enabled = nextEnabled;
      turnKey = next.turnKey;
      clear();
      count = 0;
      hidden = isHidden();
      onReset();
      arm();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      clear();
      visibilityTarget?.removeEventListener?.("visibilitychange", visibilityChanged);
    },
  };
}
