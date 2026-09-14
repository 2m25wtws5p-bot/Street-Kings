import React from "react";
import { BookOpen, ScrollText, Volume2, VolumeX } from "lucide-react";

export function IconBtn({ children, onClick, testId, title }) {
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

export function GameHeaderButtons({ sound, setSound, onRules, onStats }) {
  return (
    <div className="flex items-center gap-1.5">
      <IconBtn onClick={() => setSound((s) => !s)} testId="btn-toggle-sound" title="Sound">
        {sound ? <Volume2 size={16} /> : <VolumeX size={16} />}
      </IconBtn>
      <IconBtn onClick={onRules} testId="btn-open-how-to-play-dialog" title="How to play">
        <BookOpen size={16} />
      </IconBtn>
      <IconBtn onClick={onStats} testId="btn-open-stats-modal" title="Records">
        <ScrollText size={16} />
      </IconBtn>
    </div>
  );
}
