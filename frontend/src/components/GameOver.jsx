import React, { useEffect } from "react";
import { Avatar } from "./Avatar";
import { lowestSeats } from "../game/engine";
import { Crown, RotateCcw, Users, ScrollText } from "lucide-react";
import { sfx } from "../game/sound";

export function GameOver({ state, onRematch, onNewGame, onStats }) {
  const { players, scores } = state;
  const winners = lowestSeats(scores);
  const order = players.map((_, i) => i).sort((a, b) => scores[a] - scores[b]);

  useEffect(() => {
    sfx.fanfare();
  }, []);

  return (
    <div className="min-h-screen coven-bg px-4 py-10 grid place-items-center">
      <div className="max-w-md w-full text-center">
        <div className="rise-in">
          <div className="inline-flex float-slow mb-3">
            <Crown size={52} className="text-amber-400 candle-flicker" />
          </div>
          <h2 className="font-display text-4xl gold-text mb-1">The Arch-Witch</h2>
          <p className="font-serif-fancy text-purple-200/70 mb-6">Fewest fire points reigns supreme</p>
        </div>

        <div className="flex justify-center gap-4 mb-6">
          {winners.map((i) => (
            <div key={i} className="pop-in flex flex-col items-center">
              <Avatar avatar={players[i].avatar} size={92} active />
              <div className="font-display text-xl text-amber-200 mt-2" data-testid="game-over-winner-name">{players[i].name}</div>
              <div className="font-mono-stat text-sm text-emerald-300">{scores[i]} fire</div>
            </div>
          ))}
        </div>

        <div className="panel rounded-xl p-3 mb-6 text-left">
          {order.map((i, rank) => (
            <div key={i} className="flex items-center justify-between py-1.5 border-b border-purple-500/10 last:border-0">
              <div className="flex items-center gap-2">
                <span className="font-mono-stat text-purple-300/60 w-5">{rank + 1}.</span>
                <Avatar avatar={players[i].avatar} size={26} />
                <span className="font-display text-sm text-purple-100">{players[i].name}</span>
              </div>
              <span className="font-mono-stat text-sm text-red-300">{scores[i]}</span>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button onClick={onRematch} data-testid="btn-play-rematch" className="rounded-xl py-3.5 font-display font-bold text-purple-950 bg-gradient-to-r from-amber-300 to-amber-500 glow-ring flex items-center justify-center gap-2">
            <RotateCcw size={18} /> Rematch
          </button>
          <button onClick={onNewGame} data-testid="btn-new-coven-setup" className="rounded-xl py-3.5 font-display font-bold text-amber-100 bg-black/40 border border-purple-500/30 hover:border-amber-400/50 transition-colors flex items-center justify-center gap-2">
            <Users size={18} /> New Coven
          </button>
        </div>
        <button onClick={onStats} className="mt-3 text-purple-300/70 hover:text-amber-300 text-sm inline-flex items-center gap-1.5 transition-colors">
          <ScrollText size={15} /> View the Grimoire of Records
        </button>
      </div>
    </div>
  );
}
