import React from "react";
import { Flame, Layers } from "lucide-react";

// Shared paper-label treatment for local and online crews.
export function PlayerIdentity({ name, heat, cards, children }) {
  return <div className="crew-identity">
    <div className="crew-name" title={name}><span>{name}</span>{children}</div>
    <div className="crew-stats">
      <span className="crew-heat" data-heat={heat >= 50 ? "high" : heat >= 25 ? "warm" : "low"} aria-label={`${heat} Hitze`}>
        <Flame size={11} aria-hidden="true"/><b>{heat}</b><span>Hitze</span>
      </span>
      <span className="crew-card-count" aria-label={`${cards} Karten`}><Layers size={10} aria-hidden="true"/>{cards}</span>
    </div>
  </div>;
}
