import { useEffect, useRef, useState } from "react";
import axios from "axios";
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
import { lowestSeats, botPass, botPlay } from "@/game/engine";
import { recordGame } from "@/game/storage";
import { sfx } from "@/game/sound";
import { Home } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export function LocalGame({ onExit, sound, setSound }) {
  const { state, actions } = useWitchesGame();
  const [rulesOpen, setRulesOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const savedRef = useRef(false);

  useEffect(() => {
    if (state.phase === "setup" || state.phase === "passGate") savedRef.current = false;
  }, [state.phase]);

  useEffect(() => {
    if (state.phase !== "gameOver" || savedRef.current) return;
    savedRef.current = true;
    const winners = lowestSeats(state.scores).map((i) => state.players[i].name);
    recordGame({ players: state.players, scores: state.scores, winnerNames: winners, rounds: state.totalRounds });
    axios
      .post(`${API}/games`, {
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
      t = setTimeout(() => actions.confirmPass(botPass(state.hands[state.passSeat], state.passCount)), 650);
    } else if (phase === "playGate" && state.players[state.currentSeat]?.isBot) {
      t = setTimeout(() => actions.reveal(), 250);
    } else if (phase === "playing" && state.players[state.currentSeat]?.isBot) {
      t = setTimeout(() => {
        const id = botPlay(state.hands[state.currentSeat], state.trick);
        const card = state.hands[state.currentSeat].find((c) => c.id === id);
        if (card && (card.suit === "RED" || card.special)) sfx.fireBurst();
        else sfx.playCard();
        actions.playCard(id);
      }, 850);
    }
    return () => t && clearTimeout(t);
  }, [state.phase, state.currentSeat, state.passSeat]); // eslint-disable-line

  const botActing =
    (state.phase === "playGate" && state.players?.[state.currentSeat]?.isBot) ||
    (state.phase === "passGate" && state.players?.[state.passSeat]?.isBot);
  const showHeader = state.phase !== "setup" || botActing;

  return (
    <div className="grain min-h-screen">
      {(showHeader || state.phase === "setup") && (
        <div className="fixed top-0 inset-x-0 z-40 flex items-center justify-between px-4 py-2 bg-gradient-to-b from-[#0d0f13]/98 to-transparent">
          <button
            onClick={() => {
              if (window.confirm("Spiel verlassen und zum Hauptmenü zurückkehren?")) onExit();
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

      {state.phase === "passGate" &&
        (state.players[state.passSeat]?.isBot ? (
          <BotWaiting player={state.players[state.passSeat]} text="wählt Karten zum Weitergeben…" />
        ) : (
          <PassGate player={state.players[state.passSeat]} onReveal={actions.reveal} ctaPrefix="Karten zeigen" note="Zeit für den Deal. Achte darauf, dass niemand auf deine Karten linst…" />
        ))}
      {state.phase === "passing" && <PassingScreen state={state} onConfirm={actions.confirmPass} />}

      {state.phase === "playGate" && !state.players[state.currentSeat]?.isBot && (
          <PassGate player={state.players[state.currentSeat]} headline="Dein Zug" onReveal={actions.reveal} ctaPrefix="Karten zeigen" note="Die Straße ruft. Nimm das Gerät und spiel im Geheimen…" />
        )}
      {(state.phase === "playing" || state.phase === "trickEnd" || (state.phase === "playGate" && state.players[state.currentSeat]?.isBot)) && (
        <div className="sm:pt-10">
          <PlayTable state={state} onPlay={actions.playCard} onContinueTrick={actions.continueTrick} hideHand={state.players[state.currentSeat]?.isBot} />
        </div>
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

