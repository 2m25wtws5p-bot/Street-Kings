import React from "react";
import { useI18n } from "../i18n/I18nProvider";
import "./TableImprovements.css";

export function PassingProgress({ players, passedSeats = [] }) {
  const { t } = useI18n();
  const ready = players.filter((player, index) => !!passedSeats[player.seat ?? index]).length;
  return <div className="passing-progress" data-testid="passing-progress" aria-label={t("game.passingReadyLabel", { ready, total: players.length })}>
    <span className="passing-progress-summary">{t("game.passingReadySummary", { ready, total: players.length })}</span>
  </div>;
}
