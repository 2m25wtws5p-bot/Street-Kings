import { useEffect, useRef, useState } from "react";
import { gameApi } from "@/game/api";
import { useWitchesGame } from "@/game/useGame";
import { SetupScreen } from "@/components/SetupScreen";
import { PassGate } from "@/components/PassGate";
import { PassingScreen } from "@/components/PassingScreen";
import { PlayTable } from "@/components/PlayTable";
import { RoundScores } from "@/components/RoundScores";
import { GameOver } from "@/components/GameOver";
import { RulesDialog } from "@/components/RulesDialog";
import { StatsDialog } from "@/components/StatsDialog";
import { Avatar } from "@/components/Avatar";
import { GameHeaderButtons } from "@/components/GameHeaderButtons";
import { LastTrickButton } from "@/components/LastTrickButton";
import { ExchangeHistoryButton } from "@/components/ExchangeHistoryButton";
import { localExchangeSeat } from "@/game/exchangeHistory";
import { lowestSeats, botPass, botPlay } from "@/game/engine";
import { recordGame } from "@/game/storage";
import { sfx } from "@/game/sound";
import { Home } from "lucide-react";
import { I18nScope, useI18n } from "../i18n/I18nProvider";
import { localLanguageSeat } from "../i18n/localLanguage";

export function LocalGame(props) {
  const game = useWitchesGame();
  const viewerRef = useRef(null);
  viewerRef.current = localLanguageSeat(game.state, viewerRef.current);
  const language = game.state.players?.[viewerRef.current]?.language;
  return <I18nScope language={language}><LocalGameView {...props} game={game} /></I18nScope>;
}

function LocalGameView({ onExit, sound, setSound, game }) {
  const { state, actions } = game;
  const { t, language } = useI18n();
  const [rulesOpen, setRulesOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const [revealedSeat, setRevealedSeat] = useState(null);
  const savedRef = useRef(false);
  const humanSeats = (state.players || []).flatMap((player, seat) => player.isBot ? [] : [seat]);
  const soloHumanSeat = humanSeats.length === 1 ? humanSeats[0] : null;
  const reveal = actions.reveal;

  useEffect(() => {
    // No handover gate is necessary when only one person uses the device.
    if (state.phase === "playGate" && state.currentSeat === soloHumanSeat) reveal();
  }, [state.phase, state.currentSeat, soloHumanSeat, reveal]);

  useEffect(() => {
    setRevealedSeat(null);
  }, [state.roundIndex]);
  useEffect(() => {
    if (state.phase === "playing" && !state.players?.[state.currentSeat]?.isBot) {
      setRevealedSeat(state.currentSeat);
    } else if (state.phase === "playGate" && !state.players?.[state.currentSeat]?.isBot) {
      setRevealedSeat(null);
    }
  }, [state.phase, state.currentSeat, state.players]);

  useEffect(() => {
    if (state.phase === "setup" || state.phase === "passGate") savedRef.current = false;
  }, [state.phase]);

  useEffect(() => {
    if (state.phase !== "gameOver" || savedRef.current) return;
    savedRef.current = true;
    const winners = lowestSeats(state.scores).map((i) => state.players[i].name);
    recordGame({ players: state.players, scores: state.scores, winnerNames: winners, rounds: state.totalRounds });
    gameApi
      .record({
        players: state.n,
        rounds: state.totalRounds,
        scores: state.players.map((p, i) => ({ name: p.name, score: state.scores[i] })),
        winners,
      })
      .catch(() => {});
  }, [state.phase]); // eslint-disable-line

  useEffect(() => {
    if (!state.players) return;
    let t;
    const { phase } = state;
    if (phase === "passGate" && state.players[state.passSeat]?.isBot) {
      t = setTimeout(() => actions.confirmPass(botPass(state.hands[state.passSeat], state.passCount)), 580 + Math.random() * 240);
    } else if (phase === "playGate" && state.players[state.currentSeat]?.isBot) {
      t = setTimeout(() => actions.reveal(), 140 + Math.random() * 100);
    } else if (phase === "playing" && state.players[state.currentSeat]?.isBot) {
      t = setTimeout(() => {
        const id = botPlay(state.hands[state.currentSeat], state.trick);
        const card = state.hands[state.currentSeat].find((c) => c.id === id);
        sfx.playCard(card, `${state.roundIndex}-${state.trickNumber}-${state.currentSeat}-${id}`);
        actions.playCard(id);
      }, 620 + Math.random() * 320);
    }
    return () => t && clearTimeout(t);
  }, [state.phase, state.currentSeat, state.passSeat]); // eslint-disable-line

  const botActing =
    (state.phase === "playGate" && state.players?.[state.currentSeat]?.isBot) ||
    (state.phase === "passGate" && state.players?.[state.passSeat]?.isBot);
  const showHeader = state.phase !== "setup" || botActing;
  const exchangeSeat = localExchangeSeat(state, revealedSeat);

  return (
    <div className="grain min-h-screen" lang={language}>
      {(showHeader || state.phase === "setup") && (
        <div className="fixed top-0 inset-x-0 z-40 flex items-center justify-between px-4 py-2 bg-gradient-to-b from-[#0d0f13]/98 to-transparent">
          <button
            onClick={() => {
              if (window.confirm(t('local.leaveConfirm'))) onExit();
            }}
            data-testid="nav-brand-title"
            className="font-display text-sm gold-text flex items-center gap-1.5 hover:opacity-80"
          >
            <Home size={15} /> Street Kings
          </button>
          <GameHeaderButtons sound={sound} setSound={setSound} onRules={() => setRulesOpen(true)} onStats={() => setStatsOpen(true)} />
        </div>
      )}

      {state.phase === "setup" && <SetupScreen onStart={actions.startGame} />}
      {state.phase !== "setup" && <LastTrickButton trick={state.lastTrick} players={state.players} winner={state.lastWinner} />}
      <ExchangeHistoryButton exchange={exchangeSeat == null ? null : state.exchangeHistory?.[exchangeSeat]} phase={state.phase} trickNumber={state.trickNumber} scopeKey={`${state.roundIndex}-${exchangeSeat}`} />

      {state.phase === "passGate" &&
        (state.players[state.passSeat]?.isBot ? (
          <BotWaiting player={state.players[state.passSeat]} text={t('local.botPassing')} />
        ) : (
          <PassGate player={state.players[state.passSeat]} onReveal={actions.reveal} ctaPrefix={t('local.showCards')} note={t('local.passNote')} />
        ))}
      {state.phase === "passing" && <PassingScreen state={state} onConfirm={actions.confirmPass} />}

      {state.phase === "playGate" && !state.players[state.currentSeat]?.isBot && soloHumanSeat == null && (
          <PassGate player={state.players[state.currentSeat]} headline={t('local.yourTurn')} onReveal={actions.reveal} ctaPrefix={t('local.showCards')} note={t('local.playNote')} />
        )}
      {(state.phase === "playing" || state.phase === "trickEnd" || (state.phase === "playGate" && (state.players[state.currentSeat]?.isBot || soloHumanSeat != null))) && (
        <PlayTable state={state} onPlay={actions.playCard} onContinueTrick={actions.continueTrick} hideHand={state.players[state.currentSeat]?.isBot} displaySeat={soloHumanSeat} />
      )}

      {state.phase === "roundScores" && (
        <div className="pt-10">
          <RoundScores state={state} onNext={actions.nextRound} />
        </div>
      )}

      {state.phase === "gameOver" && (
        <GameOver state={state} onRematch={actions.restartSame} onNewGame={onExit} onStats={() => setStatsOpen(true)} />
      )}

      <RulesDialog open={rulesOpen} onOpenChange={setRulesOpen} />
      <StatsDialog open={statsOpen} onOpenChange={setStatsOpen} />
    </div>
  );
}

function BotWaiting({ player, text }) {
  return (
    <div className="min-h-screen coven-bg grid place-items-center px-4" data-testid="bot-waiting-screen">
      <div className="text-center rise-in">
        <div className="float-slow inline-block mb-5">
          <Avatar avatar={player.avatar} size={96} active />
        </div>
        <h2 className="font-display text-2xl gold-text">{player.name}</h2>
        <p className="font-serif-fancy text-slate-300/70 text-lg italic mt-1">{text}</p>
        <div className="mt-4 flex justify-center gap-1.5">
          {[0, 1, 2].map((i) => (
            <span key={i} className="w-2 h-2 rounded-full bg-amber-400 candle-flicker" style={{ animationDelay: `${i * 0.25}s` }} />
          ))}
        </div>
      </div>
    </div>
  );
}

