import React from "react";
import { ArrowRight, CornerDownLeft } from "lucide-react";
import { useI18n } from "../i18n/I18nProvider";
import "./PlayOrder.css";

export function PlayOrder({ players = [], currentSeat }) {
  const { t } = useI18n();
  if (!players.length) return null;
  const current = players.find((player, index) => (player.seat ?? index) === currentSeat);
  return <section className="play-order" data-testid="play-order" style={{ "--play-order-count": players.length }} aria-label={t("improvements.order.title")}>
    <div className="play-order-heading">
      <span className="font-display">{t("improvements.order.title")} <span aria-hidden="true">↻</span></span>
      <span className="play-order-current" title={current ? t("improvements.order.current", { name: current.name }) : undefined} aria-live="polite">{current ? t("improvements.order.current", { name: current.name }) : " "}</span>
    </div>
    <p className="sr-only">{t("improvements.order.direction")}</p>
    <ol className="play-order-list">
      {players.map((player, index) => {
        const seat = player.seat ?? index;
        const active = seat === currentSeat;
        const Arrow = index === players.length - 1 ? CornerDownLeft : ArrowRight;
        return <li key={seat} className="play-order-step" data-order-seat={seat} data-current={active ? "true" : undefined} aria-current={active ? "step" : undefined} aria-label={`${t("improvements.order.seat", { seat: seat + 1, name: player.name })}${active ? ` · ${t("improvements.order.current", { name: player.name })}` : ""}`}>
          <span className="play-order-chip" title={player.name}><span className="play-order-number">{seat + 1}</span><span className="play-order-name">{player.name}</span></span>
          <Arrow className="play-order-arrow" size={12} aria-hidden="true" />
        </li>;
      })}
    </ol>
  </section>;
}
