import React, { useEffect, useRef, useState } from "react";
import { CardView, SUIT_ICON } from "./CardView";
import { Avatar } from "./Avatar";
import { PlayerIdentity } from "./PlayerIdentity";
import { LastTrickButton } from "./LastTrickButton";
import { TrickCards } from "./TrickCards";
import { SelectedCards } from "./SelectedCards";
import { RoundScores } from "./RoundScores";
import { GameOver } from "./GameOver";
import { GameHeaderButtons } from "./GameHeaderButtons";
import { RulesDialog } from "./RulesDialog";
import { StatsDialog } from "./StatsDialog";
import { legalCardIds, leadSuit, dealCount } from "../game/engine";
import { SUITS } from "../game/constants";
import { Trophy, Check, Hourglass, LogOut, Copy, Eye, WifiOff, Bot } from "lucide-react";
import { sfx } from "../game/sound";

export function OnlineTable({ view, actions, onLeave, sound, setSound }) {
  const [rulesOpen, setRulesOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const [selected, setSelected] = useState([]);
  const [armed, setArmed] = useState(null);
  const [trickReady, setTrickReady] = useState(false);
  const phaseRef = useRef("");

  const { players, n, yourSeat, phase, trick = [], currentSeat, lastWinner, scores = [], handCounts = [] } = view;
  const spectator = view.isSpectator;
  const lead = leadSuit(trick);
  const yourTurn = !spectator && phase === "playing" && currentSeat === yourSeat;
  const iPassed = view.iPassed;
  const nameOf = (seat) => players.find((p) => p.seat === seat)?.name;

  useEffect(() => {
    setTrickReady(false);
    if (phase !== "trickEnd") return;
    // Hold the complete trick locally too, including after a slow reconnect.
    const timer = setTimeout(() => setTrickReady(true), view.trickHoldMs ?? 2000);
    return () => clearTimeout(timer);
  }, [phase, view.roundIndex, view.trickNumber, view.trickHoldMs]);

  // reset local UI when relevant server state changes
  useEffect(() => { setArmed(null); }, [currentSeat, phase]);
  useEffect(() => { if (phase !== "passing") setSelected([]); }, [phase]);

  // sound cues from server diffs
  useEffect(() => {
    if (phase === "trickEnd" && phaseRef.current !== "trickEnd") sfx.winTrick();
    phaseRef.current = phase;
  }, [phase]);

  const pseudo = { players, scores, roundResult: view.roundResult, roundIndex: view.roundIndex };
  const shellProps = { view, actions, onLeave, sound, setSound, setRulesOpen, setStatsOpen, rulesOpen, statsOpen };

  if (phase === "roundScores" && view.roundResult) {
    return (
      <Shell {...shellProps}>
        <div className="pt-10">
          <RoundScores state={pseudo} onNext={spectator ? null : actions.nextRound} />
        </div>
      </Shell>
    );
  }
  if (phase === "gameOver") {
    return (
      <Shell {...shellProps}>
        <GameOver
          state={{ players, scores }}
          onRematch={view.isHost ? actions.rematch : undefined}
          rematchDisabled={!view.isHost}
          onNewGame={onLeave}
          onStats={() => setStatsOpen(true)}
          rematchLabel="Revanche"
          newGameLabel="Hauptmenü"
          note={view.isHost ? "Revanche startet sofort eine neue Partie mit derselben Crew in diesem Raum." : spectator ? "Warten, ob der Host eine Revanche startet…" : "Nur der Host kann die Revanche starten – bleib dran!"}
        />
      </Shell>
    );
  }

  // passing / playing / trickEnd
  const yourHand = view.yourHand || [];
  const legal = yourTurn ? new Set(legalCardIds(yourHand, trick)) : new Set();

  const toggleSelect = (id) => {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= view.passCount) return prev;
      sfx.select();
      return [...prev, id];
    });
  };

  const clickPlay = (card) => {
    if (!legal.has(card.id)) return;
    if (armed === card.id) {
      actions.play(card.id);
      setArmed(null);
    } else {
      sfx.select();
      setArmed(card.id);
    }
  };

  return (
    <Shell {...shellProps}>
      <div className="game-table min-h-screen coven-bg flex flex-col pt-10">
        <div className="flex items-center justify-between px-4 pt-2 pb-2">
          <div className="font-mono-stat text-xs text-slate-300/70">
            Runde {(view.roundIndex ?? 0) + 1} · {phase === "passing" ? "Karten werden getauscht" : `Stich ${view.trickNumber}/${dealCount(n)}`}
          </div>
          {lead && (
            <div className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-display" style={{ background: `${SUITS[lead].primary}22`, border: `1px solid ${SUITS[lead].primary}66`, color: SUITS[lead].accent }} data-testid="active-lead-suit-indicator">
              {React.createElement(SUIT_ICON[lead], { size: 14 })} Angespielt: {SUITS[lead].people}
            </div>
          )}
        </div>

        {/* roster */}
        <div className="game-roster flex flex-wrap gap-2 justify-center px-3 pb-2">
          {players.map((p) => {
            const i = p.seat;
            const isCurrent = phase === "playing" && i === currentSeat;
            const isWinner = phase === "trickEnd" && i === lastWinner;
            const passed = phase === "passing" && view.passedSeats?.[i];
            const offline = !p.isBot && !p.connected;
            return (
              <div key={i} data-testid={`opponent-seat-player-${i}`} data-current={isCurrent ? "true" : undefined} data-winner={isWinner ? "true" : undefined} className={`crew-player flex items-center gap-2 rounded-md px-2.5 py-1.5 border transition-all ${isCurrent ? "bg-amber-500/15 border-amber-400/70" : isWinner ? "bg-emerald-500/15 border-emerald-400/60" : "bg-black/30 border-white/10"} ${offline ? "opacity-60" : ""}`}>
                <Avatar avatar={p.avatar} size={30} active={isCurrent} />
                <PlayerIdentity name={p.name} heat={scores[i]} cards={handCounts[i]}>
                    {i === yourSeat && <span className="text-amber-300/80 text-[9px]">(du)</span>}
                    {passed && <Check size={11} className="text-emerald-400" />}
                    {offline && <WifiOff size={11} className="text-red-400" data-testid={`player-offline-${i}`} />}
                    {p.reviewingLastTrick && <Eye size={13} className="text-amber-200" aria-label="Sieht letzten Stich an" />}
                </PlayerIdentity>
                {offline && view.isHost && i !== yourSeat && (
                  <button onClick={() => { if (window.confirm(`${p.name} durch einen KI-Gangster ersetzen?`)) actions.replaceWithBot(i); }} data-testid={`btn-replace-bot-${i}`} title="Durch KI ersetzen" className="ml-1 grid place-items-center w-7 h-7 rounded-md bg-red-950/60 border border-red-500/60 text-red-200 hover:bg-red-900/70 transition-colors">
                    <Bot size={14} />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* table center */}
        <div className="game-center flex-1 grid place-items-center px-4 py-2">
          <div className="relative w-full max-w-2xl min-h-[200px] rounded-[40%] grid place-items-center" style={{ background: "radial-gradient(ellipse at center, rgba(239,68,68,0.10), rgba(13,15,19,0) 70%)" }} data-testid="central-trick-cauldron">
            {trick.length === 0 && phase !== "trickEnd" && (
              <p className="font-serif-fancy text-slate-400/50 italic text-lg">
                {phase === "passing" ? "Die Crews verhandeln im Hinterzimmer…" : "Die Straße wartet auf den ersten Zug…"}
              </p>
            )}
          <TrickCards trick={trick} players={players} n={n} trickKey={`${view.code}-${view.roundIndex}-${view.trickNumber}`} winner={lastWinner} complete={phase === "trickEnd"} />
          </div>
        </div>

        {/* bottom action area */}
        {spectator ? (
          <SpectatorBar phase={phase} currentSeat={currentSeat} lastWinner={lastWinner} nameOf={nameOf} passed={view.passedSeats} n={n} />
        ) : phase === "trickEnd" ? (
          <div className="px-4 pb-6 text-center rise-in">
            <div className="inline-flex items-center gap-2 font-display text-xl text-emerald-300 mb-3" data-testid="trick-winner-banner">
              <Trophy size={20} /> {nameOf(lastWinner)} kassiert den Stich!
            </div>
            <div>
              {lastWinner === yourSeat || view.isHost ? (
                <button disabled={!trickReady} onClick={actions.continueTrick} data-testid="btn-continue-trick" className="rounded-md px-8 py-3 font-display font-bold text-black bg-gradient-to-r from-yellow-300 to-amber-400 glow-ring disabled:opacity-60">
                  {trickReady ? "Einsammeln & weiter" : "Stich ansehen…"}
                </button>
              ) : (
                <p className="font-serif-fancy text-slate-300/70 italic">Warten, bis {nameOf(lastWinner)} den Stich einsammelt…</p>
              )}
            </div>
            <Waiting yourHand={yourHand} text="" />
          </div>
        ) : phase === "passing" ? (
          iPassed ? (
            <Waiting yourHand={yourHand} text={`Deal besiegelt! Warten auf die anderen Crews… (${view.passedSeats.filter(Boolean).length}/${n})`} />
          ) : (
            <div className="px-2 pb-4" data-testid="passing-hand-container">
              <div className="text-center mb-2 font-serif-fancy text-slate-300/80" data-testid="passing-phase-instructions">
                Wähle <b className="text-amber-300">{view.passCount}</b> Karte{view.passCount > 1 ? "n" : ""} zum Weitergeben an{" "}
                <span className="text-amber-200 font-semibold font-display">{nameOf(view.passTarget)}</span>
                <span className="font-mono-stat text-amber-300 text-sm ml-2" data-testid="passing-phase-selected-count">{selected.length}/{view.passCount}</span>
              </div>
              <div className="compact-hand flex flex-wrap justify-center gap-1.5 sm:gap-2 max-w-5xl mx-auto">
                {yourHand.map((card) => (
                  <CardView key={card.id} card={card} size="md" selected={selected.includes(card.id)} onClick={() => toggleSelect(card.id)} testId={`pass-card-item-${card.id}`} />
                ))}
              </div>
              <div className="text-center mt-3">
                <SelectedCards hand={yourHand} selected={selected} count={view.passCount} onRemove={toggleSelect} />
                <button disabled={selected.length !== view.passCount} onClick={() => { sfx.playCard(); actions.pass(selected); }} data-testid="btn-confirm-card-pass" className={`rounded-md px-8 py-3 font-display font-bold transition-all ${selected.length === view.passCount ? "text-black bg-gradient-to-r from-yellow-300 to-amber-400 glow-ring" : "text-slate-400/40 bg-black/30 border border-white/10 cursor-not-allowed"}`}>
                  Deal besiegeln
                </button>
              </div>
            </div>
          )
        ) : yourTurn ? (
          <div className="px-2 pb-4" data-testid="active-player-hand-container">
            <div className="text-center mb-2 font-serif-fancy text-slate-300/80">
              <span className="text-amber-200 font-semibold font-display">Dein Zug</span>, spiel deine Karte
              {armed && <span className="text-amber-400/80 text-sm"> — nochmal tippen, um sie zu legen</span>}
            </div>
            <div className="compact-hand flex flex-wrap justify-center gap-1.5 sm:gap-2 max-w-5xl mx-auto">
              {yourHand.map((card) => (
                <CardView key={card.id} card={card} size="md" selected={armed === card.id} dim={!legal.has(card.id)} onClick={() => clickPlay(card)} testId={`hand-card-item-${card.id}`} />
              ))}
            </div>
          </div>
        ) : (
          <Waiting text={`Warten, bis ${nameOf(currentSeat)} spielt…`} yourHand={yourHand} />
        )}
      </div>
    </Shell>
  );
}

function SpectatorBar({ phase, currentSeat, lastWinner, nameOf, passed = [], n }) {
  let text;
  if (phase === "passing") text = `Die Crews tauschen Karten… (${passed.filter(Boolean).length}/${n})`;
  else if (phase === "trickEnd") text = `${nameOf(lastWinner)} kassiert den Stich!`;
  else text = `${nameOf(currentSeat)} ist am Zug…`;
  return (
    <div className="px-4 pb-10 text-center rise-in" data-testid="spectator-bar">
      <div className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 bg-black/40 border border-amber-400/30 font-display text-xs uppercase tracking-wider text-amber-300 mb-3">
        <Eye size={14} /> Du schaust zu
      </div>
      <div className="font-serif-fancy text-slate-300/70 italic text-lg" data-testid="spectator-status-text">{text}</div>
    </div>
  );
}

function Waiting({ text, yourHand }) {
  return (
    <div className="px-4 pb-10 text-center rise-in" data-testid="waiting-indicator">
      {text && <div className="font-serif-fancy text-slate-300/70 italic text-lg mb-3 flex items-center justify-center gap-2">
        <Hourglass size={18} className="text-amber-300 candle-flicker" /> {text}
      </div>}
      {yourHand && (
        <div className="compact-hand flex flex-wrap justify-center gap-1 max-w-4xl mx-auto opacity-80">
          {yourHand.map((c) => (
            <CardView key={c.id} card={c} size="sm" />
          ))}
        </div>
      )}
    </div>
  );
}

function Shell({ view, actions, onLeave, sound, setSound, setRulesOpen, setStatsOpen, rulesOpen, statsOpen, children }) {
  const copyLink = () => {
    const url = `${window.location.origin}${window.location.pathname}?room=${view.code}`;
    navigator.clipboard?.writeText(url);
    sfx.select();
  };
  const specCount = view.spectators?.length || 0;
  return (
    <div className="grain min-h-screen">
      <div className="fixed top-0 inset-x-0 z-40 flex items-center justify-between px-4 py-2 bg-gradient-to-b from-[#0d0f13]/98 to-transparent">
        <div className="flex items-center gap-2">
          <button onClick={() => { if (window.confirm("Diesen Raum verlassen?")) onLeave(); }} data-testid="btn-leave-room" className="grid place-items-center w-9 h-9 rounded-lg bg-black/40 border border-white/10 text-amber-200 hover:border-amber-400/60 transition-colors">
            <LogOut size={16} />
          </button>
          <button onClick={copyLink} data-testid="btn-copy-room-link" className="font-mono-stat text-xs gold-text flex items-center gap-1.5 rounded-lg px-2 py-1.5 bg-black/40 border border-white/10 hover:border-amber-400/60 transition-colors">
            <Copy size={13} /> {view.code}
          </button>
          {specCount > 0 && (
            <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-slate-400/70 font-mono-stat" data-testid="spectator-count">
              <Eye size={12} /> {specCount}
            </span>
          )}
        </div>
        <GameHeaderButtons sound={sound} setSound={setSound} onRules={() => setRulesOpen(true)} onStats={() => setStatsOpen(true)} />
      </div>
      {children}
      <LastTrickButton trick={view.lastTrick} players={view.players} winner={view.lastWinner} onReviewChange={view.isSpectator ? undefined : actions.reviewLastTrick} />
      {view.players.some((p) => p.reviewingLastTrick && p.seat !== view.yourSeat) && <div className="trick-review-notice" role="status" data-testid="trick-review-notice"><Eye size={12} className="inline mr-1" />{view.players.filter((p) => p.reviewingLastTrick && p.seat !== view.yourSeat).map((p) => p.name).join(", ")} sieht letzten Stich an</div>}
      <RulesDialog open={rulesOpen} onOpenChange={setRulesOpen} />
      <StatsDialog open={statsOpen} onOpenChange={setStatsOpen} />
    </div>
  );
}
