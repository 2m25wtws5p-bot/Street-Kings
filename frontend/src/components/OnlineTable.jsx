import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { CardView } from "./CardView";
import { Avatar } from "./Avatar";
import { RoundScores } from "./RoundScores";
import { GameOver } from "./GameOver";
import { GameHeaderButtons } from "./GameHeaderButtons";
import { RulesDialog } from "./RulesDialog";
import { StatsDialog } from "./StatsDialog";
import { legalCardIds, leadSuit, dealCount } from "../game/engine";
import { SUITS } from "../game/constants";
import { Flame, Sun, MountainSnow, Leaf, Trophy, Check, Hourglass, LogOut, Copy, Eye, WifiOff } from "lucide-react";
import { sfx } from "../game/sound";

const SUIT_ICON = { RED: Flame, YELLOW: Sun, BLUE: MountainSnow, GREEN: Leaf };

export function OnlineTable({ view, actions, onLeave, sound, setSound }) {
  const [rulesOpen, setRulesOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const [selected, setSelected] = useState([]);
  const [armed, setArmed] = useState(null);
  const trickLenRef = useRef(0);
  const phaseRef = useRef("");

  const { players, n, yourSeat, phase, trick = [], currentSeat, lastWinner, scores = [], handCounts = [] } = view;
  const spectator = view.isSpectator;
  const lead = leadSuit(trick);
  const yourTurn = !spectator && phase === "playing" && currentSeat === yourSeat;
  const iPassed = view.iPassed;
  const nameOf = (seat) => players.find((p) => p.seat === seat)?.name;

  // reset local UI when relevant server state changes
  useEffect(() => { setArmed(null); }, [currentSeat, phase]);
  useEffect(() => { if (phase !== "passing") setSelected([]); }, [phase]);

  // sound cues from server diffs
  useEffect(() => {
    if (trick.length > trickLenRef.current) sfx.playCard();
    trickLenRef.current = trick.length;
  }, [trick.length]);
  useEffect(() => {
    if (phase === "trickEnd" && phaseRef.current !== "trickEnd") sfx.winTrick();
    phaseRef.current = phase;
  }, [phase]);

  const pseudo = { players, scores, roundResult: view.roundResult, roundIndex: view.roundIndex };
  const shellProps = { view, onLeave, sound, setSound, setRulesOpen, setStatsOpen, rulesOpen, statsOpen };

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
        <GameOver state={{ players, scores }} onRematch={onLeave} onNewGame={onLeave} onStats={() => setStatsOpen(true)} rematchLabel="Zurück zur Lobby" newGameLabel="Hauptmenü" />
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
      if (card.suit === "RED" || card.special) sfx.fireBurst();
      else sfx.playCard();
      actions.play(card.id);
      setArmed(null);
    } else {
      sfx.select();
      setArmed(card.id);
    }
  };

  return (
    <Shell {...shellProps}>
      <div className="min-h-screen coven-bg flex flex-col pt-10">
        <div className="flex items-center justify-between px-4 pt-2 pb-2">
          <div className="font-mono-stat text-xs text-purple-200/70">
            Runde {(view.roundIndex ?? 0) + 1} · {phase === "passing" ? "Karten werden getauscht" : `Stich ${view.trickNumber}/${dealCount(n)}`}
          </div>
          {lead && (
            <div className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-display" style={{ background: `${SUITS[lead].primary}22`, border: `1px solid ${SUITS[lead].primary}66`, color: SUITS[lead].accent }} data-testid="active-lead-suit-indicator">
              {React.createElement(SUIT_ICON[lead], { size: 14 })} Angespielt: {SUITS[lead].people}
            </div>
          )}
        </div>

        {/* roster */}
        <div className="flex flex-wrap gap-2 justify-center px-3 pb-2">
          {players.map((p) => {
            const i = p.seat;
            const isCurrent = phase === "playing" && i === currentSeat;
            const isWinner = phase === "trickEnd" && i === lastWinner;
            const passed = phase === "passing" && view.passedSeats?.[i];
            const offline = !p.isBot && !p.connected;
            return (
              <div key={i} data-testid={`opponent-seat-player-${i}`} className={`flex items-center gap-2 rounded-xl px-2.5 py-1.5 border transition-all ${isCurrent ? "bg-amber-500/15 border-amber-400/70" : isWinner ? "bg-emerald-500/15 border-emerald-400/60" : "bg-black/30 border-purple-500/20"} ${offline ? "opacity-60" : ""}`}>
                <Avatar avatar={p.avatar} size={30} active={isCurrent} />
                <div className="leading-tight">
                  <div className="font-display text-xs text-purple-100 max-w-[92px] truncate flex items-center gap-1">
                    {p.name}
                    {i === yourSeat && <span className="text-amber-300/80 text-[9px]">(du)</span>}
                    {passed && <Check size={11} className="text-emerald-400" />}
                    {offline && <WifiOff size={11} className="text-red-400" data-testid={`player-offline-${i}`} />}
                  </div>
                  <div className="font-mono-stat text-[10px] text-purple-300/70">
                    <span className="text-red-300">{scores[i]} Hitze</span> · {handCounts[i]}K
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* table center */}
        <div className="flex-1 grid place-items-center px-4 py-2">
          <div className="relative w-full max-w-2xl min-h-[200px] rounded-[40%] grid place-items-center" style={{ background: "radial-gradient(ellipse at center, rgba(80,40,130,0.35), rgba(11,7,19,0) 70%)" }} data-testid="central-trick-cauldron">
            {trick.length === 0 && phase !== "trickEnd" && (
              <p className="font-serif-fancy text-purple-300/50 italic text-lg">
                {phase === "passing" ? "Die Crews verhandeln im Hinterzimmer…" : "Die Straße wartet auf den ersten Zug…"}
              </p>
            )}
            <div className="flex flex-wrap gap-3 justify-center items-end">
              {trick.map((t, idx) => {
                const center = (trick.length - 1) / 2;
                return (
                  <motion.div key={`${t.seat}-${t.card.id}`} className="flex flex-col items-center gap-1" initial={{ y: 130, rotate: (idx - center) * 10, scale: 0.5, opacity: 0 }} animate={{ y: 0, rotate: (idx - center) * 6, scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 260, damping: 20 }}>
                    <div className="flex items-center gap-1 rounded-full bg-black/50 px-2 py-0.5 border border-purple-500/20">
                      <Avatar avatar={players.find((p) => p.seat === t.seat)?.avatar} size={16} />
                      <span className="text-[10px] text-purple-200/80 max-w-[70px] truncate">{nameOf(t.seat)}</span>
                    </div>
                    <CardView card={t.card} size="md" testId={`played-trick-card-${t.seat}`} className={phase === "trickEnd" && t.seat === lastWinner ? "glow-ring" : ""} />
                  </motion.div>
                );
              })}
            </div>
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
                <button onClick={actions.continueTrick} data-testid="btn-continue-trick" className="rounded-xl px-8 py-3 font-display font-bold text-purple-950 bg-gradient-to-r from-amber-300 to-amber-500 glow-ring">
                  Einsammeln & weiter
                </button>
              ) : (
                <p className="font-serif-fancy text-purple-200/70 italic">Warten, bis {nameOf(lastWinner)} den Stich einsammelt…</p>
              )}
            </div>
          </div>
        ) : phase === "passing" ? (
          iPassed ? (
            <Waiting text={`Deal besiegelt! Warten auf die anderen Crews… (${view.passedSeats.filter(Boolean).length}/${n})`} />
          ) : (
            <div className="px-2 pb-4" data-testid="passing-hand-container">
              <div className="text-center mb-2 font-serif-fancy text-purple-200/80" data-testid="passing-phase-instructions">
                Wähle <b className="text-amber-300">{view.passCount}</b> Karte{view.passCount > 1 ? "n" : ""} zum Weitergeben an{" "}
                <span className="text-amber-200 font-semibold font-display">{nameOf(view.passTarget)}</span>
                <span className="font-mono-stat text-amber-300 text-sm ml-2" data-testid="passing-phase-selected-count">{selected.length}/{view.passCount}</span>
              </div>
              <div className="flex flex-wrap justify-center gap-1.5 sm:gap-2 max-w-5xl mx-auto">
                {yourHand.map((card) => (
                  <CardView key={card.id} card={card} size="md" selected={selected.includes(card.id)} onClick={() => toggleSelect(card.id)} testId={`pass-card-item-${card.id}`} />
                ))}
              </div>
              <div className="text-center mt-3">
                <button disabled={selected.length !== view.passCount} onClick={() => { sfx.playCard(); actions.pass(selected); }} data-testid="btn-confirm-card-pass" className={`rounded-xl px-8 py-3 font-display font-bold transition-all ${selected.length === view.passCount ? "text-purple-950 bg-gradient-to-r from-amber-300 to-amber-500 glow-ring" : "text-purple-300/40 bg-black/30 border border-purple-500/20 cursor-not-allowed"}`}>
                  Deal besiegeln
                </button>
              </div>
            </div>
          )
        ) : yourTurn ? (
          <div className="px-2 pb-4" data-testid="active-player-hand-container">
            <div className="text-center mb-2 font-serif-fancy text-purple-200/80">
              <span className="text-amber-200 font-semibold font-display">Dein Zug</span>, spiel deine Karte
              {armed && <span className="text-amber-400/80 text-sm"> — nochmal tippen, um sie zu legen</span>}
            </div>
            <div className="flex flex-wrap justify-center gap-1.5 sm:gap-2 max-w-5xl mx-auto">
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
      <div className="font-serif-fancy text-purple-200/70 italic text-lg" data-testid="spectator-status-text">{text}</div>
    </div>
  );
}

function Waiting({ text, yourHand }) {
  return (
    <div className="px-4 pb-10 text-center rise-in" data-testid="waiting-indicator">
      <div className="font-serif-fancy text-purple-200/70 italic text-lg mb-3 flex items-center justify-center gap-2">
        <Hourglass size={18} className="text-amber-300 candle-flicker" /> {text}
      </div>
      {yourHand && (
        <div className="flex flex-wrap justify-center gap-1 max-w-4xl mx-auto opacity-80">
          {yourHand.map((c) => (
            <CardView key={c.id} card={c} size="sm" />
          ))}
        </div>
      )}
    </div>
  );
}

function Shell({ view, onLeave, sound, setSound, setRulesOpen, setStatsOpen, rulesOpen, statsOpen, children }) {
  const copyLink = () => {
    const url = `${window.location.origin}${window.location.pathname}?room=${view.code}`;
    navigator.clipboard?.writeText(url);
    sfx.select();
  };
  const specCount = view.spectators?.length || 0;
  return (
    <div className="grain min-h-screen">
      <div className="fixed top-0 inset-x-0 z-40 flex items-center justify-between px-4 py-2 bg-gradient-to-b from-[#0b0713]/95 to-transparent">
        <div className="flex items-center gap-2">
          <button onClick={() => { if (window.confirm("Diesen Raum verlassen?")) onLeave(); }} data-testid="btn-leave-room" className="grid place-items-center w-9 h-9 rounded-lg bg-black/40 border border-purple-500/25 text-amber-200 hover:border-amber-400/60 transition-colors">
            <LogOut size={16} />
          </button>
          <button onClick={copyLink} data-testid="btn-copy-room-link" className="font-mono-stat text-xs gold-text flex items-center gap-1.5 rounded-lg px-2 py-1.5 bg-black/40 border border-purple-500/25 hover:border-amber-400/60 transition-colors">
            <Copy size={13} /> {view.code}
          </button>
          {specCount > 0 && (
            <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-purple-300/70 font-mono-stat" data-testid="spectator-count">
              <Eye size={12} /> {specCount}
            </span>
          )}
        </div>
        <GameHeaderButtons sound={sound} setSound={setSound} onRules={() => setRulesOpen(true)} onStats={() => setStatsOpen(true)} />
      </div>
      {children}
      <RulesDialog open={rulesOpen} onOpenChange={setRulesOpen} />
      <StatsDialog open={statsOpen} onOpenChange={setStatsOpen} />
    </div>
  );
}
