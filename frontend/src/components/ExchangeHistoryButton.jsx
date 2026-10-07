import React, { useEffect, useRef, useState } from "react";
import { ArrowLeftRight } from "lucide-react";
import { CardView } from "./CardView";
import { exchangeHistoryAvailable } from "../game/exchangeHistory";
import { useI18n } from "../i18n/I18nProvider";

export function ExchangeHistoryButton({ exchange, phase, trickNumber, scopeKey }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const dialog = useRef(null);
  const available = exchangeHistoryAvailable(phase, trickNumber, exchange);

  // Close even an already-open deal when trick four begins or the device changes hands.
  useEffect(() => { setOpen(false); }, [available, scopeKey]);
  useEffect(() => {
    const element = dialog.current;
    if (open && available && element && !element.open) element.showModal();
    if ((!open || !available) && element?.open) element.close();
  }, [open, available, scopeKey]);

  if (!available) return null;
  return <>
    <button type="button" className="exchange-history-button" onClick={() => setOpen(true)} data-testid="btn-exchange-history" aria-haspopup="dialog" aria-expanded={open} title={t("game.exchangeHint")}>
      <ArrowLeftRight size={16} /> {t("game.exchange")}
    </button>
    <dialog ref={dialog} className="last-trick-dialog exchange-history-dialog" aria-labelledby="exchange-history-title" onCancel={() => setOpen(false)} onClose={() => setOpen(false)} onClick={(event) => { if (event.target === dialog.current) setOpen(false); }}>
      <div className="exchange-history-heading flex items-center justify-between gap-3 mb-4">
        <h2 id="exchange-history-title" className="font-display text-lg text-amber-200">{t("game.yourExchange")}</h2>
        <button type="button" autoFocus onClick={() => setOpen(false)} aria-label={t("game.closeExchange")} className="rounded border border-white/20 px-3 py-1">{t("game.close")}</button>
      </div>
      <p className="exchange-history-note text-sm mb-4">{t("game.exchangeWindow")}</p>
      <ExchangeCards cards={exchange.sent || []} heading={t("game.sent")} player={exchange.sentTo} direction={t("game.to")} testId="exchange-sent-cards" />
      <ExchangeCards cards={exchange.received || []} heading={t("game.received")} player={exchange.receivedFrom} direction={t("game.from")} testId="exchange-received-cards" />
    </dialog>
  </>;
}

function ExchangeCards({ cards, heading, player, direction, testId }) {
  const { t } = useI18n();
  return <section className="exchange-history-section" data-testid={testId}>
    <h3 className="font-display text-base mb-2">{heading} <span className="exchange-history-player">{direction} {player || t("game.teammate")}</span></h3>
    <div className="exchange-cards exchange-history-cards flex flex-wrap justify-center gap-3">
      {cards.map((card) => <CardView key={card.id} card={card} size="sm" testId={`${testId}-${card.id}`} />)}
      {!cards.length && <p className="text-sm">{t("game.noExchange")}</p>}
    </div>
  </section>;
}
