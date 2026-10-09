import React from "react";
import { CardView } from "./CardView";
import { SPECIAL_MAP } from "../game/constants";
import "./SpecialCardReference.css";

// Use the same identity and bundled illustration as the playable deck.
export function SpecialCardReference({ cardKey, suit, value = 1, compact = false }) {
  const identity = cardKey === "wizard" ? { suit: null, value: 0 } : SPECIAL_MAP[cardKey];
  if (!identity && !suit) return null;
  const card = { id: `reference-${cardKey || `${suit}-${value}`}`, ...(identity || { suit, value }), special: cardKey || null };
  return <div className={`special-card-reference${compact ? " special-card-reference-compact" : ""}`} data-reference-card={cardKey || suit}>
    <CardView card={card} size="sm" />
  </div>;
}
