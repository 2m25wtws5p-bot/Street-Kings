import React from "react";
import { HERO_BG } from "../game/assets";
import { Sparkles, Users, Wifi, ScrollText, BookOpen } from "lucide-react";
import { sfx } from "../game/sound";

export function HomeScreen({ onLocal, onOnline, onRules, onStats }) {
  return (
    <div className="min-h-screen coven-bg relative">
      <div
        className="absolute inset-0 opacity-25"
        style={{ backgroundImage: `url(${HERO_BG})`, backgroundSize: "cover", backgroundPosition: "center", maskImage: "linear-gradient(to bottom, black, transparent 78%)" }}
      />
      <div className="fixed top-3 right-4 z-40 flex gap-1.5">
        <button onClick={onRules} data-testid="btn-open-how-to-play-dialog" title="How to play" className="grid place-items-center w-9 h-9 rounded-lg bg-black/40 border border-purple-500/25 text-amber-200 hover:border-amber-400/60 transition-colors">
          <BookOpen size={16} />
        </button>
        <button onClick={onStats} data-testid="btn-open-stats-modal" title="Records" className="grid place-items-center w-9 h-9 rounded-lg bg-black/40 border border-purple-500/25 text-amber-200 hover:border-amber-400/60 transition-colors">
          <ScrollText size={16} />
        </button>
      </div>

      <div className="relative max-w-3xl mx-auto px-4 py-14 sm:py-20">
        <div className="text-center mb-10 rise-in">
          <div className="inline-flex items-center gap-2 text-amber-400/80 font-display text-xs uppercase tracking-[0.3em] mb-3">
            <Sparkles size={14} /> A Trick-Taking Ritual <Sparkles size={14} />
          </div>
          <h1 className="font-display text-5xl sm:text-7xl font-black gold-text candle-flicker">Coven of Witches</h1>
          <p className="font-serif-fancy text-purple-200/80 text-lg mt-3 max-w-lg mx-auto">
            Gather round the cauldron. Avoid the fire, banish the witches, and outwit your rivals.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <button
            onClick={() => { sfx.select(); onLocal(); }}
            data-testid="btn-mode-local"
            className="panel rounded-2xl p-6 text-left group hover:border-amber-400/50 transition-all rise-in"
          >
            <Users size={32} className="text-amber-300 mb-3 group-hover:scale-110 transition-transform" />
            <h2 className="font-display text-xl text-amber-100 mb-1">On This Device</h2>
            <p className="font-serif-fancy text-purple-200/70 text-sm">
              Pass-and-play with friends around you, or duel AI witches solo.
            </p>
          </button>

          <button
            onClick={() => { sfx.select(); onOnline(); }}
            data-testid="btn-mode-online"
            className="panel rounded-2xl p-6 text-left group hover:border-amber-400/50 transition-all rise-in"
            style={{ animationDelay: "0.08s" }}
          >
            <Wifi size={32} className="text-amber-300 mb-3 group-hover:scale-110 transition-transform" />
            <h2 className="font-display text-xl text-amber-100 mb-1">Play Online</h2>
            <p className="font-serif-fancy text-purple-200/70 text-sm">
              Create a room, share the code or link, and play against friends on other devices.
            </p>
          </button>
        </div>
      </div>
    </div>
  );
}
