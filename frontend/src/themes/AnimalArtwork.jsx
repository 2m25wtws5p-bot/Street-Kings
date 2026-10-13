import React from "react";
import { PawPrint } from "lucide-react";
import cards from "../assets/animal-crews/cards-friendly.webp";
import { ANIMAL_CARD_CELLS, atlasPosition } from "./presentation";
import "./AnimalTheme.css";

export function AnimalCardArt({ card }) {
  const key = Object.hasOwn(ANIMAL_CARD_CELLS, card.special) ? card.special : card.suit;
  if (!Object.hasOwn(ANIMAL_CARD_CELLS, key)) return null;
  return <span className="card-art animal-card-art" aria-hidden="true" data-animal-art={key}
    style={{ backgroundImage: `url(${cards})`, backgroundSize: "500% 200%", backgroundPosition: atlasPosition(ANIMAL_CARD_CELLS[key], 5, 2) }} />;
}

export function AnimalBackMark() {
  return <span className="animal-back-mark" aria-hidden="true"><PawPrint size={28} strokeWidth={1.8} /><span>AC</span></span>;
}
