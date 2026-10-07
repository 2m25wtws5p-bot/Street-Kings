import React from "react";
import { Flame, Layers } from "lucide-react";
import { useI18n } from "../i18n/I18nProvider";

// Shared paper-label treatment for local and online crews.
export function PlayerIdentity({ name, heat, cards, children }) {
  const { t } = useI18n();
  return <div className="crew-identity">
    <div className="crew-name" title={name}><span>{name}</span>{children}</div>
    <div className="crew-stats">
      <span className="crew-heat" data-heat={heat >= 50 ? "high" : heat >= 25 ? "warm" : "low"} aria-label={t("game.heatCount", { count: heat })}>
        <Flame size={11} fill="currentColor" strokeWidth={1.4} aria-hidden="true"/><b>{heat}</b><span>{t("game.heat")}</span>
      </span>
      <span className="crew-card-count" aria-label={t("game.cardCount", { count: cards })}><Layers size={10} aria-hidden="true"/>{cards}</span>
    </div>
  </div>;
}
