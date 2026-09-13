import React, { useState, useEffect } from "react";
import { CardView } from "./CardView";
import { Avatar } from "./Avatar";
import { legalCardIds, leadSuit, dealCount } from "../game/engine";
import { SUITS } from "../game/constants";
import { Flame, Sun, MountainSnow, Leaf, Trophy, Sparkles } from "lucide-react";
import { sfx } from "../game/sound";

const SUIT_ICON = { RED: Flame, YELLOW: Sun, BLUE: MountainSnow, GREEN: Leaf };

export function PlayTable({ state, onPlay, onContinueTrick }) {
  const { n, players, hands, scores, trick, trickNumber, currentSeat, phase, lastWinner } = state;
  const [armed, setArmed] = useState(null);
  const totalTricks = dealCount(n);
  const lead = leadSuit(trick);
  const isTrickEnd = phase === "trickEnd";

  useEffect(() => {
    setArmed(null);
  }, [currentSeat, phase]);

  useEffect(() => {
    if (isTrickEnd) sfx.winTrick();
  }, [isTrickEnd]);

  const hand = !isTrickEnd ? hands[currentSeat] : [];
  const legal = !isTrickEnd ? new Set(legalCardIds(hand, trick)) : new Set();
  const active = players[currentSeat];

  const clickCard = (card) => {
    if (!legal.has(card.id)) return;
    if (armed === card.id) {
      if (card.suit === "RED" || card.special) sfx.fireBurst();
      else sfx.playCard();
      onPlay(card.id);
      setArmed(null);
    } else {
      sfx.select();
      setArmed(card.id);
    }
  };

  return (
    <div className="min-h-screen coven-bg flex flex-col">
      {/* header row */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <div className="font-mono-stat text-xs text-purple-200/70">
          Round {state.roundIndex + 1} · Trick {trickNumber}/{totalTricks}
        </div>
        {lead && (
          <div
            className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-display"
            style={{ background: `${SUITS[lead].primary}22`, border: `1px solid ${SUITS[lead].primary}66`, color: SUITS[lead].accent }}
            data-testid="active-lead-suit-indicator"
          >
            {React.createElement(SUIT_ICON[lead], { size: 14 })} Lead: {SUITS[lead].people}
          </div>
        )}
      </div>

      {/* opponents roster */}
      <div className="flex flex-wrap gap-2 justify-center px-3 pb-2">
        {players.map((p, i) => (
          <div
            key={i}
            data-testid={`opponent-seat-player-${i}`}
            className={`flex items-center gap-2 rounded-xl px-2.5 py-1.5 border transition-all ${
              !isTrickEnd && i === currentSeat
                ? "bg-amber-500/15 border-amber-400/70"
                : isTrickEnd && i === lastWinner
                ? "bg-emerald-500/15 border-emerald-400/60"
                : "bg-black/30 border-purple-500/20"
            }`}
          >
            <Avatar avatar={p.avatar} size={30} active={!isTrickEnd && i === currentSeat} />
            <div className="leading-tight">
              <div className="font-display text-xs text-purple-100 max-w-[90px] truncate">{p.name}</div>
              <div className="font-mono-stat text-[10px] text-purple-300/70">
                <span className="text-red-300">{scores[i]} fire</span> · {hands[i].length}c
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* cauldron center */}
      <div className="flex-1 grid place-items-center px-4 py-2">
        <div className="relative w-full max-w-2xl min-h-[220px] rounded-[40%] grid place-items-center"
          style={{ background: "radial-gradient(ellipse at center, rgba(80,40,130,0.35), rgba(11,7,19,0) 70%)" }}
          data-testid="central-trick-cauldron"
        >
          {trick.length === 0 && !isTrickEnd && (
            <p className="font-serif-fancy text-purple-300/50 italic text-lg">The cauldron awaits an offering…</p>
          )}
          <div className="flex flex-wrap gap-3 justify-center items-end">
            {trick.map((t, idx) => (
              <div key={idx} className="flex flex-col items-center gap-1 pop-in" style={{ animationDelay: `${idx * 0.04}s` }}>
                <div className="flex items-center gap-1 rounded-full bg-black/50 px-2 py-0.5 border border-purple-500/20">
                  <Avatar avatar={players[t.seat].avatar} size={16} />
                  <span className="text-[10px] text-purple-200/80 max-w-[70px] truncate">{players[t.seat].name}</span>
                </div>
                <CardView card={t.card} size="md" testId={`played-trick-card-${t.seat}`} className={isTrickEnd && t.seat === lastWinner ? "glow-ring" : ""} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* trick end banner OR active hand */}
      {isTrickEnd ? (
        <div className="px-4 pb-6 text-center rise-in">
          <div className="inline-flex items-center gap-2 font-display text-xl text-emerald-300 mb-3" data-testid="trick-winner-banner">
            <Trophy size={20} /> {players[lastWinner].name} claims the trick!
          </div>
          <div>
            <button
              onClick={onContinueTrick}
              data-testid="btn-continue-trick"
              className="rounded-xl px-8 py-3 font-display font-bold text-purple-950 bg-gradient-to-r from-amber-300 to-amber-500 glow-ring"
            >
              Gather & Continue
            </button>
          </div>
        </div>
      ) : (
        <div className="px-2 pb-4" data-testid="active-player-hand-container">
          <div className="text-center mb-2 font-serif-fancy text-purple-200/80">
            <span className="text-amber-200 font-semibold font-display">{active.name}</span>, cast your card
            {armed && <span className="text-amber-400/80 text-sm"> — tap again to release it into the cauldron</span>}
          </div>
          <div className="flex flex-wrap justify-center gap-1.5 sm:gap-2 max-w-5xl mx-auto">
            {hand.map((card) => (
              <CardView
                key={card.id}
                card={card}
                size="md"
                selected={armed === card.id}
                dim={!legal.has(card.id)}
                onClick={() => clickCard(card)}
                testId={`hand-card-item-${card.id}`}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
