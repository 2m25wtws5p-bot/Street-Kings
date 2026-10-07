import React, { useState } from "react";
import { AVATARS, randomAvatarIndex, randomBotName } from "../game/constants";
import { Avatar } from "./Avatar";
import { Siren, Users, Play, Bot, User } from "lucide-react";
import { sfx } from "../game/sound";
import { useI18n } from "../i18n/I18nProvider";
import { useGameLabels } from "../i18n/gameLabels";
import { LanguageSelector } from "./LanguageSelector";

const PRESETS = [
  { n: 3 },
  { n: 4 },
  { n: 5 },
  { n: 6 },
];

// A bigger portrait collection must not increase the six-seat game limit.
const MAX_PLAYERS = 6;

function shuffledAvatarIndices() {
  const indices = AVATARS.map((_, i) => i);
  for (let i = indices.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  return indices;
}

function makeBotDefaults(customNames = []) {
  const used = customNames.map((name) => name.trim()).filter(Boolean);
  return Array.from({ length: MAX_PLAYERS }, () => {
    const name = randomBotName(used);
    used.push(name);
    return name;
  });
}

export function SetupScreen({ onStart }) {
  const { t, language } = useI18n();
  const { avatars: avatarLabels } = useGameLabels();
  const [languages, setLanguages] = useState(() => Array(MAX_PLAYERS).fill(null));
  const [count, setCount] = useState(4);
  const [names, setNames] = useState(() => Array(MAX_PLAYERS).fill(""));
  const [avatars, setAvatars] = useState(() => shuffledAvatarIndices().slice(0, MAX_PLAYERS));
  const [bots, setBots] = useState(() => Array(MAX_PLAYERS).fill(false));
  // Typed names stay separate from generated defaults, so rerolls never erase them.
  const [botNames, setBotNames] = useState(() => makeBotDefaults());

  const setCountSafe = (c) => {
    setCount(c);
    sfx.select();
  };

  const isBotSeat = (idx) => idx > 0 && bots[idx];

  const rerollBotName = (idx) => {
    const used = names.map((name, i) => name.trim() || (bots[i] ? botNames[i] : ""));
    used.push(botNames[idx]);
    const chosen = randomBotName(used);
    setBotNames((prev) => prev.map((name, i) => (i === idx ? chosen : name)));
  };

  const randomizeAvatar = (idx) => {
    const available = AVATARS.map((_, index) => index).filter(index => !avatars.includes(index));
    const chosen = available.length ? available[Math.floor(Math.random() * available.length)] : randomAvatarIndex(avatars[idx]);
    setAvatars((prev) => {
      const next = [...prev];
      next[idx] = chosen;
      return next;
    });
    if (isBotSeat(idx) && !names[idx].trim()) rerollBotName(idx);
    sfx.select();
  };

  const soloPreset = () => {
    const shuffled = shuffledAvatarIndices().filter((index) => index !== avatars[0]);
    setAvatars([avatars[0], ...shuffled.slice(0, MAX_PLAYERS - 1)]);
    setBotNames(makeBotDefaults(names));
    setBots(Array.from({ length: MAX_PLAYERS }, (_, i) => i !== 0));
    sfx.select();
  };

  const toggleBot = (idx) => {
    if (!bots[idx] && !names[idx].trim()) rerollBotName(idx);
    setBots((prev) => prev.map((isBot, i) => (i === idx ? !isBot : isBot)));
    sfx.select();
  };

  const start = () => {
    const players = Array.from({ length: count }, (_, i) => ({
      name: (names[i] || "").trim() || (isBotSeat(i) ? botNames[i] : `${avatarLabels[avatars[i]].label} ${i + 1}`),
      avatar: AVATARS[avatars[i]],
      isBot: i === 0 ? false : bots[i],
      language: languages[i] || language,
    }));
    sfx.fanfare();
    onStart(players);
  };

  return (
    <div className="min-h-screen coven-bg relative">
      <div className="relative max-w-3xl mx-auto px-4 py-10 sm:py-16">
        <div className="text-center mb-10 rise-in">
          <div className="inline-flex items-center gap-2 text-amber-400/80 font-display text-xs uppercase tracking-[0.3em] mb-3">
            <Siren size={14} /> {t('home.tagline')} <Siren size={14} />
          </div>
          <h1 className="font-display text-5xl sm:text-6xl font-black gold-text candle-flicker">Street Kings</h1>
          <p className="font-serif-fancy text-slate-300/80 text-lg mt-3 max-w-lg mx-auto">
            {t('setup.description')}
          </p>
        </div>

        <div className="home-language-choice"><LanguageSelector /></div>

        <div className="panel rounded-lg p-5 sm:p-7 rise-in" style={{ animationDelay: "0.1s" }}>
          <div className="flex items-center gap-2 mb-3 text-amber-300 font-display">
            <Users size={18} /> {t('setup.playerCount')}
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
                <div className="text-[10px] text-slate-300/70 leading-tight mt-0.5">{t(`setup.preset.${p.n}`)}</div>
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <div className="flex items-center gap-2 text-slate-300/80 font-serif-fancy text-sm">
              <Bot size={16} className="text-amber-300" /> {t('setup.soloHint')}
            </div>
            <div className="flex gap-2">
              <button
                onClick={soloPreset}
                data-testid="btn-preset-solo"
                className="text-xs font-display rounded-lg px-3 py-1.5 bg-amber-500/15 border border-amber-400/50 text-amber-200 hover:bg-amber-500/25 transition-colors"
              >
                {t('setup.solo')}
              </button>
              <button
                onClick={() => { setBots(Array(MAX_PLAYERS).fill(false)); sfx.select(); }}
                data-testid="btn-preset-all-human"
                className="text-xs font-display rounded-lg px-3 py-1.5 bg-black/30 border border-white/10 text-slate-300 hover:border-slate-400/60 transition-colors"
              >
                {t('setup.allHuman')}
              </button>
            </div>
          </div>

          <div className="space-y-2.5">
            {Array.from({ length: count }, (_, i) => (
              <div key={i} className="flex items-center gap-3 rise-in" style={{ animationDelay: `${0.05 * i}s` }}>
                <button
                  onClick={() => randomizeAvatar(i)}
                  title={t(isBotSeat(i) && !names[i].trim() ? 'setup.randomBotPortrait' : 'setup.randomPortraitTitle')}
                  aria-label={t(isBotSeat(i) && !names[i].trim() ? 'setup.randomBotPortrait' : 'setup.randomPortrait')}
                  data-testid={`btn-avatar-${i}`}
                  className="shrink-0"
                >
                  <Avatar avatar={AVATARS[avatars[i]]} size={44} active={i > 0 && bots[i]} />
                </button>
                <div className="flex-1 min-w-0">
                <input
                  value={names[i]}
                  onChange={(e) => {
                    const nx = [...names];
                    nx[i] = e.target.value;
                    setNames(nx);
                  }}
                  maxLength={24}
                  placeholder={isBotSeat(i) ? botNames[i] : `${avatarLabels[avatars[i]].label} ${i + 1}`}
                  aria-label={t('setup.playerName', { number: i + 1 })}
                  data-testid={`input-player-name-${i}`}
                  className="w-full min-w-0 bg-black/40 border border-white/10 focus:border-amber-400/60 rounded-lg px-3 py-2.5 text-slate-50 placeholder:text-slate-400/40 outline-none transition-colors font-serif-fancy text-lg"
                />
                {!isBotSeat(i) && <LanguageSelector compact value={languages[i] || language} onChange={value => setLanguages(previous => previous.map((old, seat) => seat === i ? value : old))} label={t('setup.playerLanguage', { name: names[i].trim() || String(i + 1) })} testId={`player-language-${i}`} />}
                </div>
                {i === 0 ? (
                  <span className="shrink-0 w-16 text-center text-[11px] font-display uppercase tracking-wider text-amber-300/80">
                    {t('common.you')}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => toggleBot(i)}
                    data-testid={`btn-toggle-bot-${i}`}
                    className={`shrink-0 w-16 flex flex-col items-center gap-0.5 rounded-lg py-1.5 border text-[10px] font-display transition-all ${
                      bots[i]
                        ? "bg-white/10 border-slate-300/70 text-slate-100"
                        : "bg-black/30 border-white/10 text-slate-400/70 hover:border-slate-400/50"
                    }`}
                  >
                    {bots[i] ? <Bot size={16} /> : <User size={16} />}
                    {t(bots[i] ? 'common.bot' : 'common.human')}
                  </button>
                )}
              </div>
            ))}
          </div>

          <p className="mt-3 text-xs text-slate-300/70">
            {t('setup.portraitHint')}
          </p>

          <button
            onClick={start}
            data-testid="btn-start-coven-game"
            className="mt-7 w-full rounded-md py-4 font-display text-lg font-bold text-black bg-gradient-to-r from-yellow-300 to-amber-400 hover:from-yellow-200 hover:to-amber-300 transition-all glow-ring flex items-center justify-center gap-2"
          >
            <Play size={20} className="fill-black" /> {t('setup.start')}
          </button>
        </div>
      </div>
    </div>
  );
}
