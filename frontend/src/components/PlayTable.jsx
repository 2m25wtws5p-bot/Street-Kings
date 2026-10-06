import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { CardView, SUIT_ICON } from "./CardView";
import { Avatar } from "./Avatar";
import { LastTrickButton } from "./LastTrickButton";
import { legalCardIds, leadSuit, dealCount } from "../game/engine";
import { SUITS } from "../game/constants";
import { Trophy } from "lucide-react";
import { sfx } from "../game/sound";

export function PlayTable({ state, onPlay, onContinueTrick, hideHand = false }) {
  const { n, players, hands, scores, trick, trickNumber, currentSeat, phase, lastWinner } = state;
  const [armed, setArmed] = useState(null);
  const [sweeping, setSweeping] = useState(false);
  const totalTricks = dealCount(n);
  const lead = leadSuit(trick);
  const isTrickEnd = phase === "trickEnd";

  useEffect(() => {
    setArmed(null);
    setSweeping(false);
  }, [currentSeat, phase]);

  useEffect(() => {
    if (isTrickEnd) sfx.winTrick();
  }, [isTrickEnd]);

  const hand = !isTrickEnd ? hands[currentSeat] : [];
  const legal = !isTrickEnd ? new Set(legalCardIds(hand, trick)) : new Set();
  const active = players[currentSeat];
  const sweepX = ((lastWinner ?? 0) - (n - 1) / 2) * 130;

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

  const handleContinue = () => {
    setSweeping(true);
    sfx.reveal();
    setTimeout(() => onContinueTrick(), 520);
  };

  return (
    <div className="game-table min-h-screen coven-bg flex flex-col">
      {/* header row */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <div className="font-mono-stat text-xs text-slate-300/70">
          Runde {state.roundIndex + 1} · Stich {trickNumber}/{totalTricks}
        </div>
        <LastTrickButton trick={state.lastTrick} players={players} winner={lastWinner} />
          {lead && (
          <div
            className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-display"
            style={{ background: `${SUITS[lead].primary}22`, border: `1px solid ${SUITS[lead].primary}66`, color: SUITS[lead].accent }}
            data-testid="active-lead-suit-indicator"
          >
            {React.createElement(SUIT_ICON[lead], { size: 14 })} Angespielt: {SUITS[lead].people}
          </div>
        )}
      </div>

      {/* opponents roster */}
      <div className="game-roster flex flex-wrap gap-2 justify-center px-3 pb-2">
        {players.map((p, i) => (
          <div
            key={i}
            data-testid={`opponent-seat-player-${i}`}
            className={`flex items-center gap-2 rounded-md px-2.5 py-1.5 border transition-all ${
              !isTrickEnd && i === currentSeat
                ? "bg-amber-500/15 border-amber-400/70"
                : isTrickEnd && i === lastWinner
                ? "bg-emerald-500/15 border-emerald-400/60"
                : "bg-black/30 border-white/10"
            }`}
          >
            <Avatar avatar={p.avatar} size={30} active={!isTrickEnd && i === currentSeat} />
            <div className="leading-tight">
              <div className="font-display text-xs text-slate-100 max-w-[90px] truncate">{p.name}</div>
              <div className="font-mono-stat text-[10px] text-slate-400/70">
                <span className="text-red-300">{scores[i]} Hitze</span> · {hands[i].length}K
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* table center */}
      <div className="game-center flex-1 grid place-items-center px-4 py-2">
        <div
          className="relative w-full max-w-2xl min-h-[220px] rounded-[40%] grid place-items-center"
          style={{ background: "radial-gradient(ellipse at center, rgba(239,68,68,0.10), rgba(13,15,19,0) 70%)" }}
          data-testid="central-trick-cauldron"
        >
          {trick.length === 0 && !isTrickEnd && (
            <p className="font-serif-fancy text-slate-400/50 italic text-lg">Die Straße wartet auf den ersten Zug…</p>
          )}
          <div className="flex flex-wrap gap-3 justify-center items-end">
            {trick.map((t, idx) => {
              const center = (trick.length - 1) / 2;
              return (
                <motion.div
                  key={`${t.seat}-${t.card.id}`}
                  className="flex flex-col items-center gap-1"
                  initial={{ y: 140, x: 0, rotate: (idx - center) * 10, scale: 0.5, opacity: 0 }}
                  animate={
                    sweeping
                      ? { x: sweepX, y: -280, rotate: 0, scale: 0.3, opacity: 0 }
                      : { y: 0, x: 0, rotate: (idx - center) * 6, scale: 1, opacity: 1 }
                  }
                  transition={
                    sweeping
                      ? { duration: 0.5, ease: "easeIn" }
                      : { type: "spring", stiffness: 260, damping: 20, delay: idx * 0.04 }
                  }
                >
                  <div className="flex items-center gap-1 rounded-full bg-black/50 px-2 py-0.5 border border-white/10">
                    <Avatar avatar={players[t.seat].avatar} size={16} />
                    <span className="text-[10px] text-slate-300/80 max-w-[70px] truncate">{players[t.seat].name}</span>
                  </div>
                  <CardView card={t.card} size="md" testId={`played-trick-card-${t.seat}`} className={isTrickEnd && t.seat === lastWinner ? "glow-ring" : ""} />
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>

      {/* trick end banner OR active hand OR bot thinking */}
      {isTrickEnd ? (
        <div className="px-4 pb-6 text-center rise-in">
          <div className="inline-flex items-center gap-2 font-display text-xl text-emerald-300 mb-3" data-testid="trick-winner-banner">
            <Trophy size={20} /> {players[lastWinner].name} kassiert den Stich!
          </div>
          <div>
            <button
              onClick={handleContinue}
              disabled={sweeping}
              data-testid="btn-continue-trick"
              className="rounded-md px-8 py-3 font-display font-bold text-black bg-gradient-to-r from-yellow-300 to-amber-400 glow-ring disabled:opacity-60"
            >
              Einsammeln & weiter
            </button>
          </div>
        </div>
      ) : hideHand ? (
        <div className="px-4 pb-10 text-center rise-in" data-testid="bot-thinking">
          <div className="font-serif-fancy text-slate-300/70 italic text-lg mb-3">
            <span className="font-display text-amber-200 not-italic">{active.name}</span> überlegt seinen Zug…
          </div>
          <div className="flex justify-center -space-x-6">
            {hand.slice(0, 8).map((c, i) => (
              <div key={i} className="candle-flicker" style={{ animationDelay: `${i * 0.15}s` }}>
                <CardView faceDown size="sm" />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="px-2 pb-4" data-testid="active-player-hand-container">
          <div className="text-center mb-2 font-serif-fancy text-slate-300/80">
            <span className="text-amber-200 font-semibold font-display">{active.name}</span>, spiel deine Karte
            {armed && <span className="text-amber-400/80 text-sm"> — nochmal tippen, um sie auf den Tisch zu legen</span>}
          </div>
          <div className="compact-hand flex flex-wrap justify-center gap-1.5 sm:gap-2 max-w-5xl mx-auto">
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

