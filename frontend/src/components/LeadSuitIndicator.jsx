import React from "react";
import { SUIT_ICON } from "./CardView";
import { useI18n } from "../i18n/I18nProvider";
import { useGameLabels } from "../i18n/gameLabels";

const SUIT_INK = { RED: "#a3232c", YELLOW: "#704600", BLUE: "#1655a6", GREEN: "#146543" };

// A printed table marker uses the same suit colors and ink as the cards.
export function LeadSuitIndicator({ suit }) {
  const { t } = useI18n();
  const { suits } = useGameLabels();
  const definition = suits[suit];
  if (!definition) return null;
  const Icon = SUIT_ICON[suit];
  return (
    <div
      className="lead-suit-indicator"
      style={{ "--lead-color": definition.primary, "--lead-ink": SUIT_INK[suit] }}
      data-suit={suit}
      data-testid="active-lead-suit-indicator"
      aria-label={t("game.ledSuit", { suit: definition.people })}
    >
      <Icon className="lead-suit-icon" size={15} aria-hidden="true" />
      <span className="lead-suit-label">{t("game.ledLabel")}</span>
      <span className="lead-suit-name">{definition.people}</span>
    </div>
  );
}
