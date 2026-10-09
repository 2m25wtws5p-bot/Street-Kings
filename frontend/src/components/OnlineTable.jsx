import React, { useEffect, useRef, useState } from "react";
import { HandCards } from "./HandCards";
import { ExchangeReveal } from "./ExchangeReveal";
import { PlayOrder } from "./PlayOrder";
import { LeadSuitIndicator } from "./LeadSuitIndicator";
import { Avatar } from "./Avatar";
import { PlayerIdentity } from "./PlayerIdentity";
import { LastTrickButton } from "./LastTrickButton";
import { ExchangeHistoryButton } from "./ExchangeHistoryButton";
import { TrickCards } from "./TrickCards";
import { SelectedCards } from "./SelectedCards";
import { RoundScores } from "./RoundScores";
import { GameOver } from "./GameOver";
import { GameHeaderButtons } from "./GameHeaderButtons";
import { RulesDialog } from "./RulesDialog";
import { StatsDialog } from "./StatsDialog";
import { TurnStatus } from "./TurnStatus";
import { ChatPanel } from "./ChatPanel";
import { ChatBubble } from "./ChatBubble";
import { HostCrown } from "./HostCrown";
import { PassingProgress } from "./PassingProgress";
import { hostSeat } from "../game/chat";
import { copyText, invitationLink } from "../game/clipboard";
import { legalCardIds, leadSuit, dealCount } from "../game/engine";
import { useTurnReminder } from "../game/useTurnReminder";
import { rememberPlayedCard } from "../game/cardMotion";
import { Trophy, Check, LogOut, Copy, Link, Eye, WifiOff, Bot } from "lucide-react";
import { sfx } from "../game/sound";
import { useI18n } from "../i18n/I18nProvider";

export function OnlineTable({ view, actions, onLeave, sound, setSound }) {
  const { t } = useI18n();
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
  const reminderCount = useTurnReminder({ enabled: yourTurn && !actions.error, turnKey: `${view.code}-${view.roundIndex}-${view.trickNumber}-${yourSeat}` });
  const iPassed = view.iPassed;
  const nameOf = (seat) => players.find((p) => p.seat === seat)?.name;

  useEffect(() => {
    setTrickReady(false);
    if (phase !== "trickEnd") return;
    // Hold the complete trick locally too, including after a slow reconnect.
    const timer = setTimeout(() => setTrickReady(true), view.trickHoldMs ?? 1000);
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
          <RoundScores state={pseudo} onNext={spectator ? null : actions.nextRound} readySeats={view.readySeats} yourSeat={yourSeat} busy={actions.busy} spectator={spectator}
            onReplaceSeat={view.isHost && !spectator ? seat => { if (window.confirm(t("online.replaceConfirm", { name: nameOf(seat) }))) actions.replaceWithBot(seat); } : undefined} />
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
          rematchLabel={t("online.rematch")}
          newGameLabel={t("online.menu")}
          note={t(view.isHost ? "online.rematchHost" : spectator ? "online.rematchSpectator" : "online.rematchPlayer")}
        />
      </Shell>
    );
  }

  // passing / playing / trickEnd
  const yourHand = view.yourHand || [];
  const confirmedPassIds = (view.yourPassedCards || []).map(card => card.id);
  const legal = yourTurn ? new Set(legalCardIds(yourHand, trick)) : new Set();

  const toggleSelect = (id) => {
    if (actions.busy) return;
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= view.passCount) return prev;
      sfx.select();
      return [...prev, id];
    });
  };

  const clickPlay = (card) => {
    if (actions.busy) return;
    if (!legal.has(card.id)) return;
    if (armed === card.id) {
      rememberPlayedCard(card.id);
      actions.play(card.id);
      setArmed(null);
    } else {
      sfx.select();
      setArmed(card.id);
    }
  };
  const dropPlay = (card) => {
    if (actions.busy || !yourTurn || !legal.has(card.id)) return;
    rememberPlayedCard(card.id);
    actions.play(card.id);
    setArmed(null);
  };

  return (
    <Shell {...shellProps}>
      {!spectator && <ExchangeReveal exchange={view.yourExchange} scopeKey={`${view.code}-${view.roundId || view.roundIndex}-${yourSeat}`} available={phase === "playing" && view.trickNumber === 1} />}
      <div className="game-table min-h-screen coven-bg flex flex-col pt-10" data-phase={phase}>
        <div className="game-table-status flex items-center justify-between px-4 pt-2 pb-2">
          <div className="font-mono-stat text-xs text-slate-300/70">
            {t(phase === "passing" ? "online.roundPassing" : "online.roundTrick", { round: (view.roundIndex ?? 0) + 1, trick: view.trickNumber, total: dealCount(n) })}
          </div>
          <LeadSuitIndicator suit={lead} />
          {phase === "passing" && <PassingProgress players={players} passedSeats={view.passedSeats} yourSeat={yourSeat} />}
        </div>

        {/* roster */}
        <div className="game-roster flex flex-wrap gap-2 justify-center px-3 pb-2" data-player-count={n}>
          {players.map((p) => {
            const i = p.seat;
            const isCurrent = phase === "playing" && i === currentSeat;
            const isWinner = phase === "trickEnd" && i === lastWinner;
            const passed = phase === "passing" && view.passedSeats?.[i];
            const offline = !p.isBot && !p.connected;
            return (
              <div key={i} data-testid={`opponent-seat-player-${i}`} data-current={isCurrent ? "true" : undefined} data-own-turn={yourTurn && i === yourSeat ? "true" : undefined} data-winner={isWinner ? "true" : undefined} className={`crew-player flex items-center gap-2 rounded-md px-2.5 py-1.5 border transition-all ${isCurrent ? "bg-amber-500/15 border-amber-400/70" : isWinner ? "bg-emerald-500/15 border-emerald-400/60" : "bg-black/30 border-white/10"} ${offline ? "opacity-60" : ""}`}>
                <Avatar avatar={p.avatar} size={30} active={isCurrent} />
                <div className="crew-chat-identity">
                  <PlayerIdentity name={p.name} heat={scores[i]} cards={handCounts[i]}>
                    {i === hostSeat(view) && <HostCrown />}
                    {i === yourSeat && <span className="text-amber-300/80 text-[9px]">{t("online.you")}</span>}
                    {passed && <Check size={11} className="text-emerald-400" />}
                    {offline && <WifiOff size={11} className="text-red-400" aria-label={t("online.offline")} data-testid={`player-offline-${i}`} />}
                    {p.reviewingLastTrick && <Eye size={13} className="text-amber-200" aria-label={t("online.reviewing")} />}
                  </PlayerIdentity>
                  <ChatBubble messages={view.chatMessages} seat={i} />
                </div>
                {offline && view.isHost && i !== yourSeat && (
                  <button disabled={actions.busy} onClick={() => { if (window.confirm(t("online.replaceConfirm", { name: p.name }))) actions.replaceWithBot(i); }} data-testid={`btn-replace-bot-${i}`} title={t("online.replaceBot")} aria-label={t("online.replaceBot")} className="ml-1 grid place-items-center w-7 h-7 rounded-md bg-red-950/60 border border-red-500/60 text-red-200 hover:bg-red-900/70 transition-colors disabled:opacity-40">
                    <Bot size={14} />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {phase !== "passing" && <PlayOrder players={players} currentSeat={phase === "playing" ? currentSeat : null} />}
        {/* table center */}
        <div className="game-center flex-1 grid place-items-center px-4 py-2">
          <div className="relative w-full max-w-2xl min-h-[200px] rounded-[40%] grid place-items-center" style={{ background: "radial-gradient(ellipse at center, rgba(239,68,68,0.10), rgba(13,15,19,0) 70%)" }} data-card-drop-zone data-testid="central-trick-cauldron">
            {trick.length === 0 && phase !== "trickEnd" && (
              <p className="font-serif-fancy text-slate-400/50 italic text-lg">
                {t(phase === "passing" ? "online.passingEmpty" : "online.playingEmpty")}
              </p>
            )}
          <TrickCards trick={trick} players={players} n={n} trickKey={`${view.code}-${view.roundIndex}-${view.trickNumber}`} winner={lastWinner} complete={phase === "trickEnd"} />
          </div>
        </div>

        {/* bottom action area */}
        {spectator ? (
          <SpectatorBar phase={phase} currentSeat={currentSeat} lastWinner={lastWinner} nameOf={nameOf} passed={view.passedSeats} n={n} />
        ) : (
          <div className="turn-hand-zone game-hand-section px-2 pb-4" data-testid={phase === "passing" && !iPassed ? "passing-hand-container" : yourTurn ? "active-player-hand-container" : "own-hand-container"}>
            <div className="turn-action-slot">
              {phase === "passing" ? (
                <div className="game-hand-instructions text-center font-serif-fancy text-slate-300/80" data-testid="passing-phase-instructions">
                  {iPassed ? <span data-testid="waiting-indicator">{t("online.passedWait", { count: (view.passedSeats || []).filter(Boolean).length, total: n })}</span> : <>
                  {t("online.choosePass", { count: view.passCount, name: nameOf(view.passTarget) })}
                  <span className="font-mono-stat text-amber-300 text-sm ml-2" data-testid="passing-phase-selected-count">{selected.length}/{view.passCount}</span>
                  </>}
                  {Number.isInteger(view.passTarget) && <div className="passing-recipient">{t("improvements.recipient")} <strong>{nameOf(view.passTarget)}</strong></div>}
                </div>
              ) : (
                <TurnStatus
                  state={phase === "trickEnd" ? "complete" : yourTurn ? "active" : "waiting"}
                  title={t(phase === "trickEnd" ? "online.trickComplete" : yourTurn ? "online.yourTurn" : "online.waiting")}
                  subtitle={phase === "trickEnd" ? (
                    <span className="inline-flex items-center gap-2 text-emerald-300" data-testid="trick-winner-banner"><Trophy size={18} /> {t("online.trickWinner", { name: nameOf(lastWinner) })}</span>
                  ) : yourTurn ? t("online.playHint") : (
                    <span data-testid="waiting-indicator">{t("online.playerTurn", { name: nameOf(currentSeat) })}</span>
                  )}
                  reminderCount={reminderCount}
                  confirming={!!armed}
                >
                  <span className={`game-play-hint text-amber-400/80 text-sm ${armed ? "" : "invisible"}`} aria-hidden={!armed} data-testid="game-play-confirmation-hint">{t("online.confirmHint")}</span>
                  {phase === "trickEnd" && (
                    <div className="trick-action-panel">
                      {lastWinner === yourSeat || view.isHost ? (
                        <button disabled={!trickReady || actions.busy} onClick={actions.continueTrick} data-testid="btn-continue-trick" className="game-action-button">
                          {t(trickReady ? "online.collect" : "online.viewTrick")}
                        </button>
                      ) : (
                        <p className="font-serif-fancy text-slate-300/70 italic">{t("online.waitCollect", { name: nameOf(lastWinner) })}</p>
                      )}
                    </div>
                  )}
                </TurnStatus>
              )}
            </div>
            <HandCards cards={yourHand} initialCount={dealCount(n)}
              selectedIds={phase === "passing" ? iPassed ? confirmedPassIds : selected : yourTurn && armed ? [armed] : []}
              legalIds={legal} dimIds={yourTurn ? yourHand.filter(card => !legal.has(card.id)).map(card => card.id) : []}
              onCardClick={phase === "passing" && !iPassed && !actions.busy ? card => toggleSelect(card.id) : yourTurn && !actions.busy ? clickPlay : undefined}
              onCardDrop={dropPlay} canDrag={yourTurn && !actions.busy}
              interactionKey={`${view.code}-${view.roundId || view.roundIndex}-${view.trickNumber}-${currentSeat}-${phase}-${actions.busy}`}
              testIdPrefix={phase === "passing" ? "pass-card-item-" : "hand-card-item-"} />
            {phase === "passing" && (
              <div className={`game-hand-actions text-center ${iPassed ? "invisible" : ""}`} aria-hidden={!!iPassed}>
                <SelectedCards hand={yourHand} selected={selected} count={view.passCount} onRemove={toggleSelect} />
                <button disabled={iPassed || actions.busy || selected.length !== view.passCount} onClick={() => { sfx.playCard(); actions.pass(selected); }} data-testid="btn-confirm-card-pass" className="game-action-button">
                  {t("online.confirmPass")}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </Shell>
  );
}

function SpectatorBar({ phase, currentSeat, lastWinner, nameOf, passed = [], n }) {
  const { t } = useI18n();
  let text;
  if (phase === "passing") text = t("online.spectatorPassing", { count: passed.filter(Boolean).length, total: n });
  else if (phase === "trickEnd") text = t("online.trickWinner", { name: nameOf(lastWinner) });
  else text = t("online.spectatorTurn", { name: nameOf(currentSeat) });
  return (
    <div className="px-4 pb-10 text-center rise-in" data-testid="spectator-bar">
      <div className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 bg-black/40 border border-amber-400/30 font-display text-xs uppercase tracking-wider text-amber-300 mb-3">
        <Eye size={14} /> {t("online.spectating")}
      </div>
      <div className="font-serif-fancy text-slate-300/70 italic text-lg" data-testid="spectator-status-text">{text}</div>
    </div>
  );
}

function Shell({ view, actions, onLeave, sound, setSound, setRulesOpen, setStatsOpen, rulesOpen, statsOpen, children }) {
  const { t } = useI18n();
  const [copyMessage, setCopyMessage] = useState("");
  useEffect(() => {
    if (!copyMessage) return;
    const timer = setTimeout(() => setCopyMessage(""), 3000);
    return () => clearTimeout(timer);
  }, [copyMessage]);
  const copyRoom = async (link = false) => {
    const copied = await copyText(link ? invitationLink(view.code) : view.code);
    setCopyMessage(copied ? (link ? "online.copiedLink" : "online.copiedCode") : "online.copyBlocked");
    if (copied) sfx.select();
  };
  const specCount = view.spectators?.length || 0;
  return (
    <div className="grain min-h-screen">
      <div className="online-room-header fixed top-0 inset-x-0 z-40 flex items-center justify-between px-4 py-2 bg-gradient-to-b from-[#0d0f13]/98 to-transparent">
        <div className="flex items-center gap-2">
          <button onClick={() => { if (window.confirm(t("online.leaveConfirm"))) onLeave(); }} data-testid="btn-leave-room" aria-label={t("online.leave")} title={t("online.leave")} className="grid place-items-center w-9 h-9 rounded-lg bg-black/40 border border-white/10 text-amber-200 hover:border-amber-400/60 transition-colors">
            <LogOut size={16} />
          </button>
          <button onClick={() => copyRoom()} data-testid="btn-copy-room-code" aria-label={t("online.copyCode", { code: view.code })} className="room-code-button flex items-center gap-1.5 rounded-lg px-2 py-1.5 bg-black/40 border border-white/10 hover:border-amber-400/60 transition-colors">
            <Copy size={13} aria-hidden="true" /> <span className="room-code-text">{view.code}</span>
          </button>
          <button type="button" onClick={() => copyRoom(true)} data-testid="btn-copy-room-link" aria-label={t("online.copyLinkRoom", { code: view.code })} title={t("online.copyLink")} className="room-link-icon-button"><Link size={14} aria-hidden="true" /></button>
          <ChatPanel view={view} actions={actions} inline />
          {specCount > 0 && (
            <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-slate-400/70 font-mono-stat" data-testid="spectator-count">
              <Eye size={12} /> {specCount}
            </span>
          )}
        </div>
        <GameHeaderButtons sound={sound} setSound={setSound} onRules={() => setRulesOpen(true)} onStats={() => setStatsOpen(true)} />
      </div>
      {children}
      {copyMessage && <button type="button" role="status" onClick={() => setCopyMessage("")} data-testid="room-copy-status" className="fixed bottom-3 inset-x-3 z-50 mx-auto max-w-md panel rounded-lg p-3 text-sm text-amber-200">{t(copyMessage, { code: view.code })}</button>}
      <LastTrickButton trick={view.lastTrick} players={view.players} winner={view.lastWinner} onReviewChange={view.isSpectator ? undefined : actions.reviewLastTrick} />
      {!view.isSpectator && <ExchangeHistoryButton exchange={view.yourExchange} phase={view.phase} trickNumber={view.trickNumber} scopeKey={`${view.code}-${view.roundIndex}-${view.yourSeat}`} />}
      {view.players.some((p) => p.reviewingLastTrick && p.seat !== view.yourSeat) && <div className="trick-review-notice" role="status" data-testid="trick-review-notice"><Eye size={12} className="inline mr-1" />{t("online.reviewNotice", { count: view.players.filter((p) => p.reviewingLastTrick && p.seat !== view.yourSeat).length, names: view.players.filter((p) => p.reviewingLastTrick && p.seat !== view.yourSeat).map((p) => p.name).join(", ") })}</div>}
      <RulesDialog open={rulesOpen} onOpenChange={setRulesOpen} />
      <StatsDialog open={statsOpen} onOpenChange={setStatsOpen} />
    </div>
  );
}

