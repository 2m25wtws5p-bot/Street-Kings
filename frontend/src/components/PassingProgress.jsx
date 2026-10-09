import React from "react";
import { Check, Clock3 } from "lucide-react";
import { useI18n } from "../i18n/I18nProvider";
import "./TableImprovements.css";

export function PassingProgress({ players, passedSeats = [], yourSeat }) {
  const { t } = useI18n();
  const ready = players.filter((player, index) => !!passedSeats[player.seat ?? index]).length;
  return <div className="passing-progress" data-testid="passing-progress" aria-label={t("game.passingReadyLabel", { ready, total: players.length })}>
    <span className="passing-progress-summary">{t("game.passingReadySummary", { ready, total: players.length })}</span>
    <div className="passing-progress-players">
      {players.map((player, index) => {
        const seat = player.seat ?? index;
        const passed = !!passedSeats[seat];
        return <span key={seat} className={`passing-player-status ${passed ? "is-ready" : "is-waiting"}`} data-testid={`passing-status-${seat}`}>
          {passed ? <Check size={12} aria-hidden="true" /> : <Clock3 size={12} aria-hidden="true" />}
          <span className="passing-player-name" title={player.name}>{player.name}{seat === yourSeat ? t("game.youSuffix") : ""}</span>
          <span>{passed ? t("game.ready") : t("improvements.passing")}</span>
        </span>;
      })}
    </div>
  </div>;
}
