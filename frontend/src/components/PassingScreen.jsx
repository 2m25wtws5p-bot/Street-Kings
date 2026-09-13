import React, { useState } from "react";
import { CardView } from "./CardView";
import { Avatar } from "./Avatar";
import { targetSeat } from "../game/engine";
import { ArrowRight, Sparkles } from "lucide-react";
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
    <div className="min-h-screen coven-bg flex flex-col px-3 py-5">
      <div className="text-center mb-4 rise-in">
        <div className="flex items-center justify-center gap-3 mb-2">
          <Avatar avatar={me.avatar} size={38} />
          <ArrowRight className="text-amber-400" />
          <Avatar avatar={target.avatar} size={38} />
        </div>
        <h2 className="font-display text-2xl gold-text">The Coven Trade</h2>
        <p className="font-serif-fancy text-purple-200/80 text-base" data-testid="passing-phase-instructions">
          <span className="text-amber-200 font-semibold">{me.name}</span>, choose{" "}
          <b className="text-amber-300">{passCount}</b> card{passCount > 1 ? "s" : ""} to pass to{" "}
          <span className="text-amber-200 font-semibold">{target.name}</span>
        </p>
      </div>

      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-wrap justify-center gap-2 max-w-4xl">
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
          {selected.length} / {passCount} selected
        </div>
        <button
          disabled={!done}
          onClick={() => {
            sfx.playCard();
            onConfirm(selected);
            setSelected([]);
          }}
          data-testid="btn-confirm-card-pass"
          className={`rounded-xl px-8 py-3.5 font-display text-lg font-bold flex items-center gap-2 transition-all ${
            done
              ? "text-purple-950 bg-gradient-to-r from-amber-300 to-amber-500 glow-ring"
              : "text-purple-300/40 bg-black/30 border border-purple-500/20 cursor-not-allowed"
          }`}
        >
          <Sparkles size={18} /> Seal & Pass
        </button>
      </div>
    </div>
  );
}
