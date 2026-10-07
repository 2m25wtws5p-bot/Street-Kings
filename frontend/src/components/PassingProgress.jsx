import React from "react";
import { Check, Clock3 } from "lucide-react";

export function PassingProgress({ players, passedSeats = [], yourSeat }) {
  const ready = players.filter((player, index) => !!passedSeats[player.seat ?? index]).length;
  return <div className="passing-progress" data-testid="passing-progress" aria-label={`Kartentausch: ${ready} von ${players.length} bereit`}>
    <span className="passing-progress-summary">Kartentausch · {ready}/{players.length} bereit</span>
    <div className="passing-progress-players">
      {players.map((player, index) => {
        const seat = player.seat ?? index;
        const passed = !!passedSeats[seat];
        return <span key={seat} className={`passing-player-status ${passed ? "is-ready" : "is-waiting"}`} data-testid={`passing-status-${seat}`}>
          {passed ? <Check size={12} aria-hidden="true" /> : <Clock3 size={12} aria-hidden="true" />}
          <span className="passing-player-name" title={player.name}>{player.name}{seat === yourSeat ? " (du)" : ""}</span>
          <span>{passed ? "Bereit" : "Wartet"}</span>
        </span>;
      })}
    </div>
  </div>;
}
