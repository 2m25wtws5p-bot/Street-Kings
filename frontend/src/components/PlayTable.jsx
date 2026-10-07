import React, { useState, useEffect, useRef } from "react";
import { CardView } from "./CardView";
import { LeadSuitIndicator } from "./LeadSuitIndicator";
import { Avatar } from "./Avatar";
import { PlayerIdentity } from "./PlayerIdentity";
import { TrickCards } from "./TrickCards";
import { TurnStatus } from "./TurnStatus";
import { useTurnReminder } from "../game/useTurnReminder";
import { useHandLayout } from "../game/useHandLayout";
import { legalCardIds, leadSuit, dealCount } from "../game/engine";
import { sfx } from "../game/sound";
import { useI18n } from "../i18n/I18nProvider";

export function PlayTable({ state, onPlay, onContinueTrick, hideHand = false, displaySeat = null }) {
  const { t } = useI18n();
  const { n, players, hands, scores, trick, trickNumber, currentSeat, phase, lastWinner } = state;
  const [armed, setArmed] = useState(null);
  const [sweeping, setSweeping] = useState(false);
  const [ready, setReady] = useState(false);
  const sweepTimer = useRef(null);
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

  // Only solo-vs-bots has one persistent owner. Hot-seat hands remain private.
  const persistentHand = Number.isInteger(displaySeat);
  const handSeat = persistentHand ? displaySeat : currentSeat;
  const hand = hands[handSeat] || [];
  const canPlay = phase === "playing" && !hideHand && currentSeat === handSeat;
  const faceDown = !persistentHand && (hideHand || isTrickEnd);
  const legal = canPlay ? new Set(legalCardIds(hand, trick)) : new Set();
  const reminderCount = useTurnReminder({ enabled: canPlay, turnKey: `${state.roundIndex}-${trickNumber}-${currentSeat}` });
  const handLayout = useHandLayout(totalTricks);
  const active = players[currentSeat];
  useEffect(() => {
    setReady(false);
    if (!isTrickEnd) return;
    const timer = setTimeout(() => setReady(true), 2000);
    return () => clearTimeout(timer);
  }, [isTrickEnd, trickNumber]);
  useEffect(() => () => clearTimeout(sweepTimer.current), []);

  const clickCard = (card) => {
    if (!canPlay) return;
    if (!legal.has(card.id)) return;
    if (armed === card.id) {
      sfx.playCard(card, `${state.roundIndex}-${trickNumber}-${currentSeat}-${card.id}`);
      onPlay(card.id);
      setArmed(null);
    } else {
      sfx.select();
      setArmed(card.id);
    }
  };

  const handleContinue = () => {
    if (!ready || sweeping) return;
    setSweeping(true);
    sfx.reveal();
    sweepTimer.current = setTimeout(() => onContinueTrick(), 520);
  };

  return (
    <div className="game-table min-h-screen coven-bg flex flex-col" data-phase={phase}>
      {/* header row */}
      <div className="game-table-status flex items-center justify-between px-4 pt-3 pb-2">
        <div className="font-mono-stat text-xs text-slate-300/70">
          {t("game.roundTrick", { round: state.roundIndex + 1, trick: trickNumber, total: totalTricks })}
        </div>
        <LeadSuitIndicator suit={lead} />
      </div>

      {/* opponents roster */}
      <div className="game-roster flex flex-wrap gap-2 justify-center px-3 pb-2" data-player-count={n}>
        {players.map((p, i) => (
          <div
            key={i}
            data-testid={`opponent-seat-player-${i}`}
            data-current={!isTrickEnd && i === currentSeat ? "true" : undefined}
            data-own-turn={canPlay && i === handSeat ? "true" : undefined}
            data-winner={isTrickEnd && i === lastWinner ? "true" : undefined}
            className={`crew-player flex items-center gap-2 rounded-md px-2.5 py-1.5 border transition-all ${
              !isTrickEnd && i === currentSeat
                ? "bg-amber-500/15 border-amber-400/70"
                : isTrickEnd && i === lastWinner
                ? "bg-emerald-500/15 border-emerald-400/60"
                : "bg-black/30 border-white/10"
            }`}
          >
            <Avatar avatar={p.avatar} size={30} active={!isTrickEnd && i === currentSeat} />
            <PlayerIdentity name={p.name} heat={scores[i]} cards={hands[i].length}/>
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
            <p className="font-serif-fancy text-slate-400/50 italic text-lg">{t("game.emptyTrick")}</p>
          )}
          <TrickCards trick={trick} players={players} n={n} trickKey={`${state.roundIndex}-${trickNumber}`} winner={lastWinner} complete={isTrickEnd} sweeping={sweeping} />
        </div>
      </div>

      {/* One hand footprint for a human turn, bot wait and completed trick. */}
      <div className="turn-hand-zone game-hand-section px-2 pb-4" data-testid={canPlay ? "active-player-hand-container" : "own-hand-container"}>
        <div className="turn-action-slot">
          <TurnStatus state={isTrickEnd ? "complete" : canPlay ? "active" : "waiting"}
            title={isTrickEnd ? t("game.trickWinner", { name: players[lastWinner].name }) : canPlay ? t("game.yourTurn") : t("game.waiting")}
            subtitle={isTrickEnd ? t("game.trickComplete") : canPlay ? t("game.chooseCard", { name: active.name }) : t("game.playerTurn", { name: active.name })}
            reminderCount={reminderCount} confirming={!!armed}>
            <span className={`game-play-hint text-amber-400/80 text-sm ${canPlay && armed ? "" : "invisible"}`} aria-hidden={!armed} data-testid="game-play-confirmation-hint">{t("game.confirmPlay")}</span>
            {isTrickEnd && <div className="trick-action-panel">
              <button onClick={handleContinue} disabled={sweeping || !ready} data-testid="btn-continue-trick" className="game-action-button">
                {ready ? t("game.collectContinue") : t("game.viewTrick")}
              </button>
            </div>}
            {!canPlay && !isTrickEnd && <span data-testid="bot-thinking" className="turn-wait-note">{t("game.handStays")}</span>}
          </TurnStatus>
        </div>
        <div className="turn-hand-grid compact-hand flex flex-wrap justify-center gap-1.5 sm:gap-2 max-w-5xl mx-auto" ref={handLayout.ref} style={handLayout.style} data-initial-count={totalTricks} data-testid="own-hand-grid">
          {hand.map((card) => <CardView key={card.id} card={card} size="md" faceDown={faceDown}
            selected={canPlay && armed === card.id} dim={canPlay && !legal.has(card.id)}
            onClick={canPlay ? () => clickCard(card) : undefined} testId={`hand-card-item-${card.id}`} />)}
        </div>
      </div>
    </div>
  );
}

