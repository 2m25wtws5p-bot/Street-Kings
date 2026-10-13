import React from "react";
import { Orbit } from "lucide-react";
import cards from "../assets/space-smugglers/cards-atlas.webp";
import { SPACE_CARD_CELLS, atlasPosition } from "./presentation";
import "./SpaceTheme.css";

export function SpaceCardArt({ card }) {
  const key = Object.hasOwn(SPACE_CARD_CELLS, card.special) ? card.special : card.suit;
  if (!Object.hasOwn(SPACE_CARD_CELLS, key)) return null;
  return <span className="card-art space-card-art" aria-hidden="true" data-space-art={key}
    style={{ backgroundImage: `url(${cards})`, backgroundSize: "500% 200%", backgroundPosition: atlasPosition(SPACE_CARD_CELLS[key], 5, 2) }} />;
}

export function SpaceBackMark() {
  return <span className="space-back-mark" aria-hidden="true"><Orbit size={30} /><span>SS</span></span>;
}
