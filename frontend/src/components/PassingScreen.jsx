import React, { useState } from "react";
import { CardView } from "./CardView";
import { SelectedCards } from "./SelectedCards";
import { PassingProgress } from "./PassingProgress";
import { Avatar } from "./Avatar";
import { targetSeat, dealCount } from "../game/engine";
import { useHandLayout } from "../game/useHandLayout";
import { ArrowRight, Handshake } from "lucide-react";
import { sfx } from "../game/sound";

export function PassingScreen({ state, onConfirm }) {
  const { passSeat, passCount, passDir, players, hands, n } = state;
  const me = players[passSeat];
  const target = players[targetSeat(passSeat, passDir, n)];
  const hand = hands[passSeat];
  const [selected, setSelected] = useState([]);
  const handLayout = useHandLayout(dealCount(n));

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
        <h2 className="font-display text-2xl gold-text">Der Deal <span className="text-sm ml-2" data-testid="passing-phase-selected-count">{selected.length}/{passCount}</span></h2>
        <p className="font-serif-fancy text-slate-300/80 text-base" data-testid="passing-phase-instructions">
          <span className="text-amber-200 font-semibold">{me.name}</span>, wähle{" "}
          <b className="text-amber-300">{passCount}</b> Karte{passCount > 1 ? "n" : ""} zum Weitergeben an{" "}
          <span className="text-amber-200 font-semibold">{target.name}</span>
        </p>
      </div>

      <PassingProgress players={players} passedSeats={players.map((_, seat) => Boolean(state.pendingSelections?.[seat]?.length))} yourSeat={passSeat} />

      <div className="game-hand-section flex-1 flex items-center justify-center">
        <div ref={handLayout.ref} style={handLayout.style} className="turn-hand-grid compact-hand flex flex-wrap justify-center gap-2 max-w-4xl" data-testid="own-hand-grid" data-initial-count={dealCount(n)}>
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

      <div className="game-hand-actions flex flex-col items-center">
        <SelectedCards hand={hand} selected={selected} count={passCount} onRemove={toggle} />
        <button
          disabled={!done}
          onClick={() => {
            sfx.playCard();
            onConfirm(selected);
            setSelected([]);
          }}
          data-testid="btn-confirm-card-pass"
          className="game-action-button"
        >
          <Handshake size={18} /> Deal besiegeln
        </button>
      </div>
    </div>
  );
}

