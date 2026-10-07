import React from "react";
import { BookOpen, ScrollText, Volume2, VolumeX } from "lucide-react";
import { setSoundEnabled, unlockSound } from "../game/sound";
import { useI18n } from "../i18n/I18nProvider";

export function IconBtn({ children, onClick, testId, title }) {
  return (
    <button
      onClick={onClick}
      data-testid={testId}
      title={title}
      aria-label={title}
      className="grid place-items-center w-9 h-9 rounded-lg bg-black/40 border border-white/10 text-amber-200 hover:border-amber-400/60 hover:text-amber-100 transition-colors"
    >
      {children}
    </button>
  );
}

export function GameHeaderButtons({ sound, setSound, onRules, onStats }) {
  const { t } = useI18n();
  return (
    <div className="flex items-center gap-1.5">
      <IconBtn onClick={() => {
        const next = !sound;
        setSoundEnabled(next);
        if (next) unlockSound();
        setSound(next);
      }} testId="btn-toggle-sound" title={sound ? t("game.soundOff") : t("game.soundOn")}>
        {sound ? <Volume2 size={16} /> : <VolumeX size={16} />}
      </IconBtn>
      <IconBtn onClick={onRules} testId="btn-open-how-to-play-dialog" title={t("game.rules")}>
        <BookOpen size={16} />
      </IconBtn>
      <IconBtn onClick={onStats} testId="btn-open-stats-modal" title={t("game.record")}>
        <ScrollText size={16} />
      </IconBtn>
    </div>
  );
}
