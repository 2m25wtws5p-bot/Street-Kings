import React from "react";
import { Users, Wifi, ScrollText, BookOpen, Siren } from "lucide-react";
import { sfx } from "../game/sound";

export function HomeScreen({ onLocal, onOnline, onRules, onStats }) {
  return (
    <div className="min-h-screen coven-bg relative">
      <div className="fixed top-3 right-4 z-40 flex gap-1.5">
        <button onClick={onRules} data-testid="btn-open-how-to-play-dialog" title="Spielregeln" className="grid place-items-center w-9 h-9 rounded-lg bg-black/40 border border-purple-500/25 text-amber-200 hover:border-amber-400/60 transition-colors">
          <BookOpen size={16} />
        </button>
        <button onClick={onStats} data-testid="btn-open-stats-modal" title="Akte" className="grid place-items-center w-9 h-9 rounded-lg bg-black/40 border border-purple-500/25 text-amber-200 hover:border-amber-400/60 transition-colors">
          <ScrollText size={16} />
        </button>
      </div>

      <div className="relative max-w-3xl mx-auto px-4 py-14 sm:py-20">
        <div className="text-center mb-10 rise-in">
          <div className="inline-flex items-center gap-2 text-amber-400/80 font-display text-xs uppercase tracking-[0.3em] mb-3">
            <Siren size={14} /> Ein Stichspiel der Unterwelt <Siren size={14} />
          </div>
          <h1 className="font-display text-5xl sm:text-7xl font-black gold-text candle-flicker" data-testid="home-title">Street Kings</h1>
          <p className="font-serif-fancy text-purple-200/80 text-2xl mt-2 italic" data-testid="home-subtitle">„Don't take the heat.“</p>
          <p className="font-serif-fancy text-purple-200/70 text-lg mt-3 max-w-lg mx-auto">
            Rivalisierende Crews, eine Stadt. Kassiere so wenig Hitze wie möglich und bring die anderen zum Schwitzen.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <button
            onClick={() => { sfx.select(); onLocal(); }}
            data-testid="btn-mode-local"
            className="panel rounded-2xl p-6 text-left group hover:border-amber-400/50 transition-all rise-in"
          >
            <Users size={32} className="text-amber-300 mb-3 group-hover:scale-110 transition-transform" />
            <h2 className="font-display text-xl text-amber-100 mb-1">Auf diesem Gerät</h2>
            <p className="font-serif-fancy text-purple-200/70 text-sm">
              Gerät weiterreichen und mit Freunden am Tisch spielen – oder solo gegen KI-Gangster.
            </p>
          </button>

          <button
            onClick={() => { sfx.select(); onOnline(); }}
            data-testid="btn-mode-online"
            className="panel rounded-2xl p-6 text-left group hover:border-amber-400/50 transition-all rise-in"
            style={{ animationDelay: "0.08s" }}
          >
            <Wifi size={32} className="text-amber-300 mb-3 group-hover:scale-110 transition-transform" />
            <h2 className="font-display text-xl text-amber-100 mb-1">Online spielen</h2>
            <p className="font-serif-fancy text-purple-200/70 text-sm">
              Raum eröffnen, Code oder Link teilen und gegen Freunde auf anderen Geräten spielen – oder zuschauen.
            </p>
          </button>
        </div>
      </div>
    </div>
  );
}
