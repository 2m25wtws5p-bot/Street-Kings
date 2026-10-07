import React from "react";
import { useI18n } from "../i18n/I18nProvider";

// The status, confirmation and reminder share reserved space above the hand.
export function TurnStatus({ state, title, subtitle, reminderCount = 0, confirming = false, children }) {
  const { t } = useI18n();
  const remind = state === "active" && reminderCount > 0;
  return (
    <div className="turn-status-card" data-testid="turn-status" data-state={state} data-reminder={reminderCount}>
      {remind && <span key={reminderCount} className="turn-reminder-pulse" data-testid="turn-reminder-pulse" aria-hidden="true" />}
      <div className="turn-status-title font-display">{title}</div>
      <div className="turn-status-subtitle">{subtitle}</div>
      <div className="turn-status-details">
        {remind && !confirming && <span className="turn-reminder-message">{t("game.reminder")}</span>}
        {children}
      </div>
      <div className="turn-reminder-announcement" role="status" aria-live="polite" aria-atomic="true">
        {remind && <span key={reminderCount}>{t("game.reminderAnnouncement")}</span>}
      </div>
    </div>
  );
}
