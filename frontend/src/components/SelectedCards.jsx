import React from "react";
import { useCardIcons } from "../themes/cardIcons";
import { useI18n } from "../i18n/I18nProvider";
import { useGameLabels } from "../i18n/gameLabels";

// The raised cards remain in the hand. Compact removable tokens avoid a
// second fan of miniature artwork, while keeping the same space when empty.
export function SelectedCards({ hand, selected, count, onRemove }) {
  const { t } = useI18n();
  const { suits, specials } = useGameLabels();
  const icons = useCardIcons();
  return <div className="selected-cards" data-testid="selected-card-preview" aria-label={t("game.selectedCards")}>
    <span className="selected-cards-label">{t("game.selectionCount", { selected: selected.length, count })}</span>
    <div className="selected-cards-row">
      {Array.from({ length: count }, (_, index) => {
        const card = hand.find(c => c.id === selected[index]);
        const Icon = icons.suits[card?.suit] || icons.runner;
        const label = card && `${suits[card.suit]?.people || t("cards.runner.label")} ${card.value}${card.special ? ` · ${specials[card.special]?.label}` : ""}`;
        return <span className="selected-card-token-slot" key={index}>
          {card ? <button type="button" className="selected-card-token" data-suit={card.suit || "NEUTRAL"}
            data-testid={`selected-card-${card.id}`} title={label} aria-label={t("table.removeSelection", { card: label })}
            onClick={() => onRemove(card.id)}><Icon size={11} aria-hidden="true" /><b>{card.value}</b></button> :
            <span className="selected-card-token-empty" aria-hidden="true">·</span>}
        </span>;
      })}
    </div>
  </div>;
}
