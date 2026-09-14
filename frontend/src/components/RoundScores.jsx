import React, { useEffect } from "react";
import { Avatar } from "./Avatar";
import { WIN_THRESHOLD } from "../game/constants";
import { isGameOver } from "../game/engine";
import { Flame, X, Siren, Shield, Minus, Crown, ChevronRight } from "lucide-react";
import { sfx } from "../game/sound";

function Chip({ color, icon, label }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-mono-stat" style={{ background: `${color}22`, border: `1px solid ${color}55`, color }}>
      {icon} {label}
    </span>
  );
}

export function RoundScores({ state, onNext }) {
  const { roundResult, scores, players } = state;
  const { results, shooter, spellName } = roundResult;
  const over = isGameOver(scores);

  useEffect(() => {
    if (shooter >= 0) sfx.witchReveal();
  }, [shooter]);

  const order = players.map((_, i) => i).sort((a, b) => scores[a] - scores[b]);

  return (
    <div className="min-h-screen coven-bg px-4 py-8 overflow-y-auto">
      <div className="max-w-xl mx-auto">
        <h2 className="font-display text-3xl gold-text text-center mb-1">Die Abrechnung</h2>
        <p className="text-center text-purple-200/70 font-serif-fancy mb-6">Runde {state.roundIndex + 1} abgerechnet</p>

        {shooter >= 0 && (
          <div className="pop-in rounded-2xl p-4 mb-5 text-center bg-gradient-to-r from-red-900/50 to-orange-900/40 border border-amber-400/50" data-testid="fire-spell-moon-banner">
            <div className="font-display text-xl text-amber-200 flex items-center justify-center gap-2">
              <Siren className="text-red-400" /> {spellName}!
            </div>
            <p className="text-sm text-amber-100/80 mt-1">
              {players[shooter].name} hat die gesamte Hitze auf sich gezogen und die Kontrolle übernommen – alle anderen Crews zahlen!
            </p>
          </div>
        )}

        <div className="space-y-2.5">
          {order.map((i) => {
            const r = results[i];
            return (
              <div key={i} className="panel rounded-xl p-3 rise-in" data-testid={`score-row-player-${i}`}>
                <div className="flex items-center gap-3">
                  <Avatar avatar={players[i].avatar} size={38} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-display text-purple-100 truncate">{players[i].name}</span>
                      <span className={`font-display text-lg ${r.total > 0 ? "text-red-300" : "text-emerald-300"}`}>
                        +{r.total}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {r.moon && <Chip color="#FBBF24" icon={<Siren size={10} />} label="TAKEOVER · 0" />}
                      {r.spellVictim && <Chip color="#EF4444" icon={<Flame size={10} />} label="Takeover kassiert" />}
                      {!r.moon && !r.spellVictim && r.fireCards > 0 && <Chip color="#EF4444" icon={<Flame size={10} />} label={`${r.fireCards} Hitze`} />}
                      {r.fireWitch && !r.moon && <Chip color="#EF4444" icon={<X size={10} />} label="x2 Kingpin" />}
                      {r.water && <Chip color="#38BDF8" icon={<span>+5</span>} label="Fixer" />}
                      {r.pygmy && <Chip color="#A855F7" icon={<span>+10</span>} label="Patin" />}
                      {r.air && <Chip color="#FACC15" icon={<Shield size={10} />} label="Schmierer neutralisiert" />}
                      {r.earth && <Chip color="#4ADE80" icon={<Minus size={10} />} label="Informant −5" />}
                    </div>
                  </div>
                </div>
                {/* cumulative progress */}
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex-1 h-2 rounded-full bg-black/40 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.min((scores[i] / WIN_THRESHOLD) * 100, 100)}%`,
                        background: scores[i] >= WIN_THRESHOLD ? "#EF4444" : "linear-gradient(90deg,#f59e0b,#ef4444)",
                      }}
                    />
                  </div>
                  <span className="font-mono-stat text-xs text-purple-200/80 w-16 text-right">{scores[i]}/{WIN_THRESHOLD}</span>
                </div>
              </div>
            );
          })}
        </div>

        {onNext ? (
          <button
            onClick={() => {
              sfx.reveal();
              onNext();
            }}
            data-testid="btn-start-next-round"
            className="mt-6 w-full rounded-xl py-4 font-display text-lg font-bold text-purple-950 bg-gradient-to-r from-amber-300 to-amber-500 glow-ring flex items-center justify-center gap-2"
          >
            {over ? <><Crown size={20} /> Street King krönen</> : <>Nächste Runde <ChevronRight size={20} /></>}
          </button>
        ) : (
          <p className="mt-6 text-center font-serif-fancy text-purple-200/60 italic" data-testid="spectator-waiting-next-round">
            Warten, bis die Crews die nächste Runde starten…
          </p>
        )}
      </div>
    </div>
  );
}
