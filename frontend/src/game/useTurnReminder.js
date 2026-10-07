import { useEffect, useRef, useState } from "react";
import { createTurnReminderScheduler } from "./turnReminder";
import { sfx } from "./sound";

// turnKey identifies the round/trick/seat, never a poll version or selection.
// enabled is true only while this human can play. The count lets the table
// replay its visual pulse for each reminder without starting audio on render.
export function useTurnReminder({ enabled, turnKey }) {
  const active = Boolean(enabled);
  const currentSession = useRef(null);
  if (!currentSession.current || currentSession.current.enabled !== active || !Object.is(currentSession.current.turnKey, turnKey)) {
    currentSession.current = { enabled: active, turnKey, disposed: false };
  }
  const session = currentSession.current;
  const [reminder, setReminder] = useState({ session: null, count: 0 });

  useEffect(() => {
    session.disposed = false;
    // Checking render-time identity also blocks callbacks between a new turn's
    // render and the old effect's cleanup, including a changed player access.
    const current = () => currentSession.current === session && !session.disposed;
    const scheduler = createTurnReminderScheduler({
      onReset() {
        if (current()) setReminder({ session, count: 0 });
      },
      onReminder(count) {
        if (!current() || !session.enabled) return;
        setReminder({ session, count });
        sfx.turnReminder();
      },
    });
    scheduler.update({ enabled: session.enabled, turnKey: session.turnKey });
    return () => {
      session.disposed = true;
      scheduler.dispose();
    };
  }, [session]);

  return active && reminder.session === session ? reminder.count : 0;
}
