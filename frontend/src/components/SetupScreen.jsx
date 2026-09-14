import React, { useState } from "react";
import { AVATARS } from "../game/constants";
import { Avatar } from "./Avatar";
import { Siren, Users, Play, Bot, User } from "lucide-react";
import { sfx } from "../game/sound";

const PRESETS = [
  { n: 3, label: "Kleine Crew" },
  { n: 4, label: "Viererbande" },
  { n: 5, label: "Großer Deal" },
  { n: 6, label: "Ganze Stadt" },
];

export function SetupScreen({ onStart }) {
  const [count, setCount] = useState(4);
  const [names, setNames] = useState(() => AVATARS.map((a) => ""));
  const [avatars, setAvatars] = useState(() => AVATARS.map((_, i) => i));
  const [bots, setBots] = useState(() => AVATARS.map(() => false));

  const setCountSafe = (c) => {
    setCount(c);
    sfx.select();
  };

  const cycleAvatar = (idx) => {
    setAvatars((prev) => {
      const next = [...prev];
      next[idx] = (next[idx] + 1) % AVATARS.length;
      return next;
    });
    sfx.select();
  };

  const start = () => {
    const players = Array.from({ length: count }, (_, i) => ({
      name: (names[i] || "").trim() || `${AVATARS[avatars[i]].label} ${i + 1}`,
      avatar: AVATARS[avatars[i]],
      isBot: i === 0 ? false : bots[i],
    }));
    sfx.fanfare();
    onStart(players);
  };

  return (
    <div className="min-h-screen coven-bg relative">
      <div className="relative max-w-3xl mx-auto px-4 py-10 sm:py-16">
        <div className="text-center mb-10 rise-in">
          <div className="inline-flex items-center gap-2 text-amber-400/80 font-display text-xs uppercase tracking-[0.3em] mb-3">
            <Siren size={14} /> Ein Stichspiel der Unterwelt <Siren size={14} />
          </div>
          <h1 className="font-display text-5xl sm:text-6xl font-black gold-text candle-flicker">Street Kings</h1>
          <p className="font-serif-fancy text-slate-300/80 text-lg mt-3 max-w-lg mx-auto">
            Stellt eure Crews zusammen. Vermeidet die Hitze, meidet den Kingpin und reicht das Gerät von Hand zu Hand.
          </p>
        </div>

        <div className="panel rounded-lg p-5 sm:p-7 rise-in" style={{ animationDelay: "0.1s" }}>
          <div className="flex items-center gap-2 mb-3 text-amber-300 font-display">
            <Users size={18} /> Wie viele Gangster?
          </div>
          <div className="grid grid-cols-4 gap-2 mb-6">
            {PRESETS.map((p) => (
              <button
                key={p.n}
                onClick={() => setCountSafe(p.n)}
                data-testid={`btn-player-count-${p.n}`}
                className={`rounded-md py-3 px-1 border transition-all ${
                  count === p.n
                    ? "bg-amber-500/20 border-amber-400 glow-ring"
                    : "bg-black/30 border-white/10 hover:border-slate-400/60"
                }`}
              >
                <div className="font-display text-2xl text-amber-100">{p.n}</div>
                <div className="text-[10px] text-slate-300/70 leading-tight mt-0.5">{p.label}</div>
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <div className="flex items-center gap-2 text-slate-300/80 font-serif-fancy text-sm">
              <Bot size={16} className="text-amber-300" /> Allein unterwegs? Fülle die Plätze mit KI-Gangstern.
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => { setBots(AVATARS.map((_, i) => i !== 0)); sfx.select(); }}
                data-testid="btn-preset-solo"
                className="text-xs font-display rounded-lg px-3 py-1.5 bg-amber-500/15 border border-amber-400/50 text-amber-200 hover:bg-amber-500/25 transition-colors"
              >
                Solo gegen KI
              </button>
              <button
                onClick={() => { setBots(AVATARS.map(() => false)); sfx.select(); }}
                data-testid="btn-preset-all-human"
                className="text-xs font-display rounded-lg px-3 py-1.5 bg-black/30 border border-white/10 text-slate-300 hover:border-slate-400/60 transition-colors"
              >
                Nur Menschen
              </button>
            </div>
          </div>

          <div className="space-y-2.5">
            {Array.from({ length: count }, (_, i) => (
              <div key={i} className="flex items-center gap-3 rise-in" style={{ animationDelay: `${0.05 * i}s` }}>
                <button
                  onClick={() => cycleAvatar(i)}
                  title="Avatar wechseln"
                  data-testid={`btn-avatar-${i}`}
                  className="shrink-0"
                >
                  <Avatar avatar={AVATARS[avatars[i]]} size={44} active={i > 0 && bots[i]} />
                </button>
                <input
                  value={names[i]}
                  onChange={(e) => {
                    const nx = [...names];
                    nx[i] = e.target.value;
                    setNames(nx);
                  }}
                  maxLength={16}
                  placeholder={`${AVATARS[avatars[i]].label} ${i + 1}`}
                  data-testid={`input-player-name-${i}`}
                  className="flex-1 bg-black/40 border border-white/10 focus:border-amber-400/60 rounded-lg px-3 py-2.5 text-slate-50 placeholder:text-slate-400/40 outline-none transition-colors font-serif-fancy text-lg"
                />
                {i === 0 ? (
                  <span className="shrink-0 w-16 text-center text-[11px] font-display uppercase tracking-wider text-amber-300/80">
                    Du
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => { const nx = [...bots]; nx[i] = !nx[i]; setBots(nx); sfx.select(); }}
                    data-testid={`btn-toggle-bot-${i}`}
                    className={`shrink-0 w-16 flex flex-col items-center gap-0.5 rounded-lg py-1.5 border text-[10px] font-display transition-all ${
                      bots[i]
                        ? "bg-white/10 border-slate-300/70 text-slate-100"
                        : "bg-black/30 border-white/10 text-slate-400/70 hover:border-slate-400/50"
                    }`}
                  >
                    {bots[i] ? <Bot size={16} /> : <User size={16} />}
                    {bots[i] ? "KI" : "Mensch"}
                  </button>
                )}
              </div>
            ))}
          </div>

          <button
            onClick={start}
            data-testid="btn-start-coven-game"
            className="mt-7 w-full rounded-md py-4 font-display text-lg font-bold text-black bg-gradient-to-r from-yellow-300 to-amber-400 hover:from-yellow-200 hover:to-amber-300 transition-all glow-ring flex items-center justify-center gap-2"
          >
            <Play size={20} className="fill-black" /> Auf die Straße
          </button>
        </div>
      </div>
    </div>
  );
}
