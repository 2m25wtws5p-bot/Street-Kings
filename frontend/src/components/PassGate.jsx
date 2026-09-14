import React from "react";
import { Avatar } from "./Avatar";
import { Eye, ScrollText } from "lucide-react";
import { sfx } from "../game/sound";

export function PassGate({ player, headline = "Streng geheim", note, onReveal, ctaPrefix = "Karten zeigen" }) {
  return (
    <div
      className="min-h-screen coven-bg grid place-items-center px-4"
      data-testid="pass-device-gate-screen"
    >
      <div className="text-center max-w-sm rise-in">
        <div className="float-slow inline-block mb-6">
          <Avatar avatar={player.avatar} size={110} active />
        </div>
        <div className="text-amber-400/80 font-display text-xs uppercase tracking-[0.3em] mb-2 flex items-center justify-center gap-2">
          <ScrollText size={13} /> {headline}
        </div>
        <h2 className="font-display text-3xl gold-text mb-1">Gerät weitergeben an</h2>
        <p className="font-display text-4xl font-black text-amber-200 mb-5" data-testid="pass-gate-target-player-name">
          {player.name}
        </p>
        <p className="font-serif-fancy text-slate-300/70 text-base mb-8 italic">
          {note || "Achte darauf, dass niemand auf deine Karten linst…"}
        </p>
        <button
          onClick={() => {
            sfx.reveal();
            onReveal();
          }}
          data-testid="btn-reveal-player-hand"
          className="w-full rounded-md py-4 font-display text-lg font-bold text-black bg-gradient-to-r from-yellow-300 to-amber-400 hover:from-yellow-200 hover:to-amber-300 transition-all glow-ring flex items-center justify-center gap-2"
        >
          <Eye size={20} /> {ctaPrefix} — Ich bin {player.name}
        </button>
      </div>
    </div>
  );
}
