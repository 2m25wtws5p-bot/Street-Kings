import React, { useState } from "react";
import { AVATARS } from "../game/constants";
import { HERO_BG } from "../game/assets";
import { Avatar } from "./Avatar";
import { Sparkles, Users, Play, Bot, User } from "lucide-react";
import { sfx } from "../game/sound";

const PRESETS = [
  { n: 3, label: "Trio Coven" },
  { n: 4, label: "Quartet Gathering" },
  { n: 5, label: "Grand Circle" },
  { n: 6, label: "Grand Sabbat" },
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
      <div
        className="absolute inset-0 opacity-25"
        style={{ backgroundImage: `url(${HERO_BG})`, backgroundSize: "cover", backgroundPosition: "center", maskImage: "linear-gradient(to bottom, black, transparent 75%)" }}
      />
      <div className="relative max-w-3xl mx-auto px-4 py-10 sm:py-16">
        <div className="text-center mb-10 rise-in">
          <div className="inline-flex items-center gap-2 text-amber-400/80 font-display text-xs uppercase tracking-[0.3em] mb-3">
            <Sparkles size={14} /> A Trick-Taking Ritual <Sparkles size={14} />
          </div>
          <h1 className="font-display text-5xl sm:text-6xl font-black gold-text candle-flicker">Coven of Witches</h1>
          <p className="font-serif-fancy text-purple-200/80 text-lg mt-3 max-w-lg mx-auto">
            Gather round the cauldron. Avoid the fire, banish the witches, and pass the device from hand to hand.
          </p>
        </div>

        <div className="panel rounded-2xl p-5 sm:p-7 rise-in" style={{ animationDelay: "0.1s" }}>
          <div className="flex items-center gap-2 mb-3 text-amber-300 font-display">
            <Users size={18} /> How many witches?
          </div>
          <div className="grid grid-cols-4 gap-2 mb-6">
            {PRESETS.map((p) => (
              <button
                key={p.n}
                onClick={() => setCountSafe(p.n)}
                data-testid={`btn-player-count-${p.n}`}
                className={`rounded-xl py-3 px-1 border transition-all ${
                  count === p.n
                    ? "bg-amber-500/20 border-amber-400 glow-ring"
                    : "bg-black/30 border-purple-500/20 hover:border-purple-400/50"
                }`}
              >
                <div className="font-display text-2xl text-amber-100">{p.n}</div>
                <div className="text-[10px] text-purple-200/70 leading-tight mt-0.5">{p.label}</div>
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <div className="flex items-center gap-2 text-purple-200/80 font-serif-fancy text-sm">
              <Bot size={16} className="text-amber-300" /> Play solo? Fill seats with AI witches.
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => { setBots(AVATARS.map((_, i) => i !== 0)); sfx.select(); }}
                data-testid="btn-preset-solo"
                className="text-xs font-display rounded-lg px-3 py-1.5 bg-amber-500/15 border border-amber-400/50 text-amber-200 hover:bg-amber-500/25 transition-colors"
              >
                Solo vs AI
              </button>
              <button
                onClick={() => { setBots(AVATARS.map(() => false)); sfx.select(); }}
                data-testid="btn-preset-all-human"
                className="text-xs font-display rounded-lg px-3 py-1.5 bg-black/30 border border-purple-500/25 text-purple-200 hover:border-purple-400/50 transition-colors"
              >
                All Human
              </button>
            </div>
          </div>

          <div className="space-y-2.5">
            {Array.from({ length: count }, (_, i) => (
              <div key={i} className="flex items-center gap-3 rise-in" style={{ animationDelay: `${0.05 * i}s` }}>
                <button
                  onClick={() => cycleAvatar(i)}
                  title="Change avatar"
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
                  className="flex-1 bg-black/40 border border-purple-500/25 focus:border-amber-400/60 rounded-lg px-3 py-2.5 text-purple-50 placeholder:text-purple-300/40 outline-none transition-colors font-serif-fancy text-lg"
                />
                {i === 0 ? (
                  <span className="shrink-0 w-16 text-center text-[11px] font-display uppercase tracking-wider text-amber-300/80">
                    You
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => { const nx = [...bots]; nx[i] = !nx[i]; setBots(nx); sfx.select(); }}
                    data-testid={`btn-toggle-bot-${i}`}
                    className={`shrink-0 w-16 flex flex-col items-center gap-0.5 rounded-lg py-1.5 border text-[10px] font-display transition-all ${
                      bots[i]
                        ? "bg-purple-500/20 border-purple-400/60 text-purple-100"
                        : "bg-black/30 border-purple-500/25 text-purple-300/70 hover:border-purple-400/40"
                    }`}
                  >
                    {bots[i] ? <Bot size={16} /> : <User size={16} />}
                    {bots[i] ? "AI" : "Human"}
                  </button>
                )}
              </div>
            ))}
          </div>

          <button
            onClick={start}
            data-testid="btn-start-coven-game"
            className="mt-7 w-full rounded-xl py-4 font-display text-lg font-bold text-purple-950 bg-gradient-to-r from-amber-300 via-amber-400 to-amber-500 hover:from-amber-200 hover:to-amber-400 transition-all glow-ring flex items-center justify-center gap-2"
          >
            <Play size={20} className="fill-purple-950" /> Enter the Coven
          </button>
        </div>
      </div>
    </div>
  );
}
