import React, { useState } from "react";
import { CardView } from "./CardView";
import { Avatar } from "./Avatar";
import { targetSeat } from "../game/engine";
import { ArrowRight, Handshake } from "lucide-react";
import { sfx } from "../game/sound";

export function PassingScreen({ state, onConfirm }) {
  const { passSeat, passCount, passDir, players, hands, n } = state;
  const me = players[passSeat];
  const target = players[targetSeat(passSeat, passDir, n)];
  const hand = hands[passSeat];
  const [selected, setSelected] = useState([]);

  const toggle = (id) => {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= passCount) return prev;
      sfx.select();
      return [...prev, id];
    });
  };

  const done = selected.length === passCount;

  return (
    <div className="game-passing min-h-screen coven-bg flex flex-col px-3 py-5">
      <div className="text-center mb-4 rise-in">
        <div className="flex items-center justify-center gap-3 mb-2">
          <Avatar avatar={me.avatar} size={38} />
          <ArrowRight className="text-amber-400" />
          <Avatar avatar={target.avatar} size={38} />
        </div>
        <h2 className="font-display text-2xl gold-text">Der Deal</h2>
        <p className="font-serif-fancy text-slate-300/80 text-base" data-testid="passing-phase-instructions">
          <span className="text-amber-200 font-semibold">{me.name}</span>, wähle{" "}
          <b className="text-amber-300">{passCount}</b> Karte{passCount > 1 ? "n" : ""} zum Weitergeben an{" "}
          <span className="text-amber-200 font-semibold">{target.name}</span>
        </p>
      </div>

      <div className="flex-1 flex items-center justify-center">
        <div className="compact-hand flex flex-wrap justify-center gap-2 max-w-4xl">
          {hand.map((card) => (
            <CardView
              key={card.id}
              card={card}
              size="md"
              selected={selected.includes(card.id)}
              onClick={() => toggle(card.id)}
              testId={`pass-card-item-${card.id}`}
            />
          ))}
        </div>
      </div>

      <div className="flex flex-col items-center gap-3 mt-4">
        <div className="font-mono-stat text-sm text-amber-300" data-testid="passing-phase-selected-count">
          {selected.length} / {passCount} gewählt
        </div>
        <button
          disabled={!done}
          onClick={() => {
            sfx.playCard();
            onConfirm(selected);
            setSelected([]);
          }}
          data-testid="btn-confirm-card-pass"
          className={`rounded-md px-8 py-3.5 font-display text-lg font-bold flex items-center gap-2 transition-all ${
            done
              ? "text-black bg-gradient-to-r from-yellow-300 to-amber-400 glow-ring"
              : "text-slate-400/40 bg-black/30 border border-white/10 cursor-not-allowed"
          }`}
        >
          <Handshake size={18} /> Deal besiegeln
        </button>
      </div>
    </div>
  );
}

