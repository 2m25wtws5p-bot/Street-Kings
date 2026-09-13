import { useEffect, useRef, useState } from "react";
import "@/App.css";
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
import { lowestSeats } from "@/game/engine";
import { recordGame } from "@/game/storage";
import { sfx, setSoundEnabled } from "@/game/sound";
import { BookOpen, ScrollText, Volume2, VolumeX, Home } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

function App() {
  const { state, actions } = useWitchesGame();
  const [rulesOpen, setRulesOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const [sound, setSound] = useState(true);
  const savedRef = useRef(false);

  useEffect(() => {
    setSoundEnabled(sound);
  }, [sound]);

  // reset save guard when a new game starts
  useEffect(() => {
    if (state.phase === "setup" || state.phase === "passGate") savedRef.current = false;
  }, [state.phase]);

  // persist game result once, when the game ends
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

  const showHeader = ["passing", "playing", "trickEnd", "roundScores"].includes(state.phase);

  return (
    <div className="App grain min-h-screen">
      {showHeader && (
        <div className="fixed top-0 inset-x-0 z-40 flex items-center justify-between px-4 py-2 bg-gradient-to-b from-[#0b0713]/95 to-transparent">
          <button
            onClick={() => {
              if (window.confirm("Abandon this ritual and return to setup?")) actions.newGame();
            }}
            data-testid="nav-brand-title"
            className="font-display text-sm gold-text flex items-center gap-1.5 hover:opacity-80"
          >
            <Home size={15} /> Coven
          </button>
          <div className="flex items-center gap-1.5">
            <IconBtn onClick={() => setSound((s) => !s)} testId="btn-toggle-sound" title="Sound">
              {sound ? <Volume2 size={16} /> : <VolumeX size={16} />}
            </IconBtn>
            <IconBtn onClick={() => setRulesOpen(true)} testId="btn-open-how-to-play-dialog" title="How to play">
              <BookOpen size={16} />
            </IconBtn>
            <IconBtn onClick={() => setStatsOpen(true)} testId="btn-open-stats-modal" title="Records">
              <ScrollText size={16} />
            </IconBtn>
          </div>
        </div>
      )}

      {state.phase === "setup" && (
        <>
          <div className="fixed top-3 right-4 z-40 flex gap-1.5">
            <IconBtn onClick={() => setSound((s) => !s)} testId="btn-toggle-sound" title="Sound">
              {sound ? <Volume2 size={16} /> : <VolumeX size={16} />}
            </IconBtn>
            <IconBtn onClick={() => setRulesOpen(true)} testId="btn-open-how-to-play-dialog" title="How to play">
              <BookOpen size={16} />
            </IconBtn>
            <IconBtn onClick={() => setStatsOpen(true)} testId="btn-open-stats-modal" title="Records">
              <ScrollText size={16} />
            </IconBtn>
          </div>
          <SetupScreen onStart={actions.startGame} />
        </>
      )}

      {state.phase === "passGate" && (
        <PassGate player={state.players[state.passSeat]} onReveal={actions.reveal} ctaPrefix="Reveal My Hand" note="Time to trade curses. Ensure no wandering eyes peer at your cards…" />
      )}
      {state.phase === "passing" && <PassingScreen state={state} onConfirm={actions.confirmPass} />}

      {state.phase === "playGate" && (
        <PassGate
          player={state.players[state.currentSeat]}
          headline="Your Turn"
          onReveal={actions.reveal}
          ctaPrefix="Reveal My Hand"
          note="The cauldron calls. Take the device and play in secret…"
        />
      )}
      {(state.phase === "playing" || state.phase === "trickEnd") && (
        <div className="pt-10">
          <PlayTable state={state} onPlay={actions.playCard} onContinueTrick={actions.continueTrick} />
        </div>
      )}

      {state.phase === "roundScores" && (
        <div className="pt-10">
          <RoundScores state={state} onNext={actions.nextRound} />
        </div>
      )}

      {state.phase === "gameOver" && (
        <GameOver state={state} onRematch={actions.restartSame} onNewGame={actions.newGame} onStats={() => setStatsOpen(true)} />
      )}

      <RulesDialog open={rulesOpen} onOpenChange={setRulesOpen} />
      <StatsDialog open={statsOpen} onOpenChange={setStatsOpen} />
    </div>
  );
}

function IconBtn({ children, onClick, testId, title }) {
  return (
    <button
      onClick={onClick}
      data-testid={testId}
      title={title}
      className="grid place-items-center w-9 h-9 rounded-lg bg-black/40 border border-purple-500/25 text-amber-200 hover:border-amber-400/60 hover:text-amber-100 transition-colors"
    >
      {children}
    </button>
  );
}

export default App;
