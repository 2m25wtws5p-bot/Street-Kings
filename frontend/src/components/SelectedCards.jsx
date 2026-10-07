import React from "react";
import { CardView } from "./CardView";
import { useI18n } from "../i18n/I18nProvider";

// Reserve the same preview space before and after selecting exchange cards.
export function SelectedCards({ hand, selected, count, onRemove }) {
  const { t } = useI18n();
  return <div className="selected-cards" data-testid="selected-card-preview" aria-label={t("game.selectedCards")}>
    <span className="selected-cards-label">{t("game.selectionCount", { selected: selected.length, count })}</span>
    <div className="selected-cards-row">
      {Array.from({ length: count }, (_, index) => {
        const id = selected[index];
        return <div className="selected-card-slot" key={index}>
          {id ? <CardView card={hand.find((c) => c.id === id)} size="xs" onClick={() => onRemove(id)} testId={`selected-card-${id}`} /> : <span className="selected-card-placeholder" aria-hidden="true" />}
        </div>;
      })}
    </div>
  </div>;
}
