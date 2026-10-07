import React from "react";
import { SUIT_ICON } from "./CardView";
import { SUITS } from "../game/constants";

const SUIT_INK = { RED: "#a3232c", YELLOW: "#704600", BLUE: "#1655a6", GREEN: "#146543" };

// A printed table marker uses the same suit colors and ink as the cards.
export function LeadSuitIndicator({ suit }) {
  const definition = SUITS[suit];
  if (!definition) return null;
  const Icon = SUIT_ICON[suit];
  return (
    <div
      className="lead-suit-indicator"
      style={{ "--lead-color": definition.primary, "--lead-ink": SUIT_INK[suit] }}
      data-suit={suit}
      data-testid="active-lead-suit-indicator"
      aria-label={`Angespielt: ${definition.people}`}
    >
      <Icon className="lead-suit-icon" size={15} aria-hidden="true" />
      <span className="lead-suit-label">Angespielt:</span>
      <span className="lead-suit-name">{definition.people}</span>
    </div>
  );
}
