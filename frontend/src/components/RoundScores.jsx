import React, { useEffect } from "react";
import { Avatar } from "./Avatar";
import { WIN_THRESHOLD } from "../game/constants";
import { isGameOver } from "../game/engine";
import { Siren, Crown, ChevronRight, Footprints } from "lucide-react";
import { SUIT_ICON } from "./CardView";
import { explainRoundScore, getScoreCardMeta, signedScore } from "../game/scoreExplanation";
import { sfx } from "../game/sound";
import { useI18n } from "../i18n/I18nProvider";

const SUIT_TONES = { RED: ["#a3232c", "#ffe5dc"], GREEN: ["#146543", "#d8f3df"], BLUE: ["#1655a6", "#dceeff"], YELLOW: ["#704600", "#fff0b8"] };

function ScoreStep({ step, scoreCards }) {
  const card = scoreCards[step.cardKey];
  const Icon = SUIT_ICON[step.suit] || (step.cardKey === "wizard" ? Footprints : Siren);
  const [ink, paper] = SUIT_TONES[step.suit] || ["#343c49", "#ece5d5"];
  return <li className="score-step rounded-md p-2.5" data-score-step={step.id} style={{ background: paper, color: ink, border: `1px solid ${ink}55` }}>
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
      <span className="inline-flex items-center gap-1.5 font-display font-bold text-base"><Icon size={16} aria-hidden="true" />{card ? `${card.colorName} ${card.rank} · ${card.name}` : step.title}</span>
      <span className="score-math font-mono-stat text-sm font-bold whitespace-nowrap">{step.math}</span>
    </div>
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1 text-xs leading-relaxed">
      {step.status && <span className="score-status font-semibold rounded px-1.5 py-0.5" style={{ border: `1px solid ${ink}55` }}>{step.status}</span>}
      <span>{step.note}</span>
    </div>
  </li>;
}

export function RoundScores({ state, onNext }) {
  const { t } = useI18n();
  const { roundResult, scores, players } = state;
  const { results, shooter } = roundResult;
  const over = isGameOver(scores);
  const withheld = Boolean(roundResult.spellWithheld || results.some(r => r.spellWithheld || r.total < 0));
  const scoreCards = getScoreCardMeta(t);
  const shooterResult = shooter >= 0 ? results[shooter] : null;
  const takeoverName = t(shooterResult?.water && shooterResult?.pygmy ? "scores.summary.grandTakeover" : shooterResult?.pygmy ? "scores.summary.godmotherTakeover" : "scores.summary.takeover");

  useEffect(() => { if (shooter >= 0) sfx.witchReveal(); }, [shooter]);
  const order = players.map((_, i) => i).sort((a, b) => scores[a] - scores[b]);

  return <div className="round-summary min-h-screen coven-bg px-3 sm:px-4 py-8 overflow-y-auto">
    <div className="max-w-2xl mx-auto">
      <h2 className="font-display text-3xl gold-text text-center mb-1">{t("scores.summary.title")}</h2>
      <p className="text-center text-slate-300/80 mb-6 text-sm">{t("scores.summary.round", { round: state.roundIndex + 1 })}</p>
      {shooter >= 0 && <div className="score-takeover pop-in rounded-lg p-4 mb-5 text-center" data-testid="fire-spell-moon-banner">
        <div className="font-display text-2xl flex items-center justify-center gap-2"><Siren size={24} aria-hidden="true" />{takeoverName}!</div>
        <p className="text-sm mt-2 leading-relaxed">{t("scores.summary.takeoverCollected", { name: players[shooter].name, figures: t(shooterResult.water && shooterResult.pygmy ? "scores.summary.bothFigures" : shooterResult.pygmy ? "scores.summary.godmother" : "scores.summary.informant") })}</p>
        <p className="text-sm mt-1 font-semibold">{t(withheld ? "scores.summary.withheld" : "scores.summary.transferred")}</p>
      </div>}
      <div className="space-y-4">
        {order.map(i => {
          const explanation = explainRoundScore(results[i], { score: scores[i], roundResult, pile: state.piles?.[i], t });
          return <article key={i} className="score-card panel rounded-lg p-3 sm:p-4 rise-in" data-testid={`score-row-player-${i}`}>
            <div className="flex items-center gap-3 mb-3">
              <Avatar avatar={players[i].avatar} size={42} />
              <div className="flex-1 min-w-0"><h3 className="score-name font-display text-xl font-bold truncate">{players[i].name}</h3><p className="text-xs score-subtitle">{t(results[i].moon ? "scores.summary.shooter" : results[i].spellVictim ? "scores.summary.victim" : "scores.summary.personal")}</p></div>
              <div className="score-total text-center rounded-md py-1 px-3 shrink-0" data-score-total={explanation.total} style={{ color: explanation.total > 0 ? "#a3232c" : "#146543" }}>
                <div className="score-delta font-display text-3xl font-bold">{signedScore(explanation.total)}</div><div className="text-[10px] font-semibold uppercase">{t("scores.summary.roundHeat")}</div>
              </div>
            </div>
            <ol className="score-breakdown space-y-2" aria-label={t("scores.summary.breakdown", { name: players[i].name })}>{explanation.steps.map(step => <ScoreStep key={step.id} step={step} scoreCards={scoreCards} />)}</ol>
            <div className="score-ledger mt-3 pt-3 flex flex-wrap items-center justify-between gap-2" data-testid={`score-ledger-player-${i}`}>
              <div><div className="text-[11px] uppercase font-semibold">{t("scores.summary.ledger")}</div><div className="font-mono-stat text-base font-bold mt-0.5">{explanation.ledger}</div></div>
              <div className="text-right"><span className="font-display text-2xl font-bold">{scores[i]}</span><span className="text-xs ml-1">{t("scores.summary.heat", { threshold: WIN_THRESHOLD })}</span></div>
            </div>
            <div className="score-progress mt-2 h-2 rounded-full bg-black/15 overflow-hidden" role="progressbar" aria-label={t("scores.summary.totalHeat", { name: players[i].name })} aria-valuenow={scores[i]} aria-valuemin={0} aria-valuemax={Math.max(WIN_THRESHOLD, scores[i])} aria-valuetext={t("scores.summary.progress", { score: scores[i], threshold: WIN_THRESHOLD })}>
              <div className="h-full rounded-full transition-all" style={{ width: `${Math.max(0, Math.min(scores[i] / WIN_THRESHOLD * 100, 100))}%`, background: scores[i] >= WIN_THRESHOLD ? "#a3232c" : "linear-gradient(90deg,#d69223,#a3232c)" }} />
            </div>
          </article>;
        })}
      </div>
      {onNext ? <button onClick={() => { sfx.reveal(); onNext(); }} data-testid="btn-start-next-round" className="score-next mt-6 w-full rounded-md py-4 font-display text-lg font-bold flex items-center justify-center gap-2">
        {over ? <><Crown size={20} />{t("scores.summary.crown")}</> : <>{t("scores.summary.next")}<ChevronRight size={20} /></>}
      </button> : <p className="mt-6 text-center text-slate-300/70 text-sm" data-testid="spectator-waiting-next-round">{t("scores.summary.waiting")}</p>}
    </div>
  </div>;
}
