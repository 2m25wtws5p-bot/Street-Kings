import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui/dialog";
import { SUIT_ORDER, WIN_THRESHOLD } from "../game/constants";
import { SUIT_ICON, SPECIAL_ICON } from "./CardView";
import { getScoreCardMeta } from "../game/scoreExplanation";
import { Crown, ArrowRight } from "lucide-react";
import { useI18n } from "../i18n/I18nProvider";
import { useGameLabels } from "../i18n/gameLabels";
import { SpecialCardReference } from "./SpecialCardReference";

const SPECIAL_RULES = ["fire", "water", "pygmy", "air", "earth", "wizard"];
const PASS_ROWS = [
  [3, 20, 4, "rules.passing.odd"],
  [4, 15, 3, "rules.passing.even"],
  [5, 12, 3, "rules.passing.odd"],
  [6, 10, 2, "rules.passing.even"],
];

// Only trusted catalogue emphasis is supported; no HTML is ever injected.
function RuleText({ text }) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, index) => part.startsWith("**")
    ? <strong key={index}>{part.slice(2, -2)}</strong> : part);
}

function RuleSection({ number, title, children }) {
  return <section className="rule-section">
    <h3 className="font-display text-xl font-bold flex items-center gap-2 mb-2"><span className="rule-step grid place-items-center w-7 h-7 shrink-0 rounded">{number}</span>{title}</h3>
    {children}
  </section>;
}

export function RulesDialog({ open, onOpenChange }) {
  const { t } = useI18n();
  const { suits } = useGameLabels();
  const scoreCards = getScoreCardMeta(t);
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="street-dialog rule-dialog w-[calc(100vw-1.5rem)] max-w-2xl max-h-[88dvh] overflow-y-auto p-4 sm:p-6" data-testid="rules-dialog">
      <DialogHeader className="street-dialog-header pr-6">
        <p className="street-dialog-kicker font-display text-xs tracking-[0.2em] font-bold">{t("rules.kicker")}</p>
        <DialogTitle className="street-dialog-title font-display text-3xl flex items-center gap-2"><Crown size={28} aria-hidden="true" />{t("rules.title")}</DialogTitle>
        <DialogDescription className="street-dialog-description text-sm">{t("rules.description")}</DialogDescription>
      </DialogHeader>
      <div className="space-y-6 text-sm leading-relaxed">
        <RuleSection number="01" title={t("rules.goal.title")}>
          <p><RuleText text={t("rules.goal.text", { threshold: WIN_THRESHOLD })} /></p>
        </RuleSection>

        <RuleSection number="02" title={t("rules.passing.title")}>
          <p><RuleText text={t("rules.passing.text")} /></p>
          <div className="rule-table overflow-x-auto rounded-md mt-3">
            <table className="w-full text-left text-xs sm:text-sm">
              <caption className="sr-only">{t("rules.passing.caption")}</caption>
              <thead><tr><th scope="col" className="p-2 font-display">{t("rules.passing.crews")}</th><th scope="col" className="p-2 font-display">{t("rules.passing.hand")}</th><th scope="col" className="p-2 font-display">{t("rules.passing.amount")}</th><th scope="col" className="p-2 font-display">{t("rules.passing.cycle")}</th></tr></thead>
              <tbody>{PASS_ROWS.map(([n, hand, pass, direction]) => <tr key={n}><th scope="row" className="p-2 font-mono-stat">{n}</th><td className="p-2">{hand}</td><td className="p-2 font-bold">{t("rules.passing.cards", { count: pass })}</td><td className="p-2 min-w-[140px]">{t(direction)}</td></tr>)}</tbody>
            </table>
          </div>
          <p className="mt-2">{t("rules.passing.start")}</p>
          <div className="grid grid-cols-2 gap-2 mt-3">{SUIT_ORDER.map(key => {
            const s = suits[key]; const Icon = SUIT_ICON[key];
            const meta = Object.values(scoreCards).find(card => card.suit === key);
            return <div key={key} className="rule-suit rounded-md p-2 flex items-center gap-2" style={{ color: meta.ink, background: meta.paper, border: `1px solid ${meta.ink}55` }}>
              <Icon size={22} aria-hidden="true" /><div><div className="font-display font-bold">{t(`scores.color.${key}`)} · {s.people}</div><div className="text-xs">{t("rules.suit.values")}</div></div>
            </div>;
          })}</div>
        </RuleSection>

        <RuleSection number="03" title={t("rules.trick.title")}>
          <ol className="list-decimal pl-5 space-y-2">
            <li>{t("rules.trick.lead")}</li>
            <li><RuleText text={t("rules.trick.follow")} /></li>
            <li>{t("rules.trick.win")}</li>
            <li>{t("rules.trick.next")}</li>
          </ol>
          <div className="rule-note rounded-md p-3 mt-3"><RuleText text={t("rules.trick.runners")} /></div>
        </RuleSection>

        <RuleSection number="04" title={t("rules.specials.title")}>
          <p className="mb-3"><RuleText text={t("rules.specials.text")} /></p>
          <div className="grid gap-2">{SPECIAL_RULES.map(key => {
            const card = scoreCards[key]; const Icon = SUIT_ICON[card.suit] || SPECIAL_ICON[key];
            return <div key={key} className="rule-special rule-special-illustrated rounded-md p-3" data-rule-card={key} style={{ color: card.ink, background: card.paper, border: `1px solid ${card.ink}66` }}>
              <SpecialCardReference cardKey={key} />
              <div className="rule-special-copy">
                <div className="flex flex-wrap justify-between gap-1 mb-1"><span className="font-display text-lg font-bold inline-flex items-center gap-2"><Icon size={20} aria-hidden="true" />{card.colorName} {card.rank} · {card.name}</span><span className="text-[10px] font-bold uppercase self-center">{card.role}</span></div>
                <p className="text-xs sm:text-sm leading-relaxed">{t(`rules.special.${key}`)}</p>
              </div>
            </div>;
          })}</div>
        </RuleSection>

        <RuleSection number="05" title={t("rules.scoring.title")}>
          <p><RuleText text={t("rules.scoring.text")} /></p>
          <div className="rule-example rounded-md p-3 mt-3 space-y-2 text-xs sm:text-sm">
            <div><div className="rule-scoring-illustrations"><SpecialCardReference cardKey="fire" compact /></div><p><RuleText text={t("rules.scoring.doubleBefore")} /> <span className="font-mono-stat font-bold">4 × 2 = 8</span>. {t("rules.scoring.doubleBetween")} <span className="font-mono-stat font-bold">20 → 15</span>.</p></div>
            <div><div className="rule-scoring-illustrations">{["water", "pygmy", "air"].map(key => <SpecialCardReference key={key} cardKey={key} compact />)}</div><p><RuleText text={t("rules.scoring.greenBefore")} /> <span className="font-mono-stat font-bold">2 + 5 + 10 = 17</span>. {t("rules.scoring.greenBetween")} <span className="font-mono-stat font-bold">0</span>.</p></div>
            <div><div className="rule-scoring-illustrations"><SpecialCardReference cardKey="earth" compact /></div><p><RuleText text={t("rules.scoring.reduceBefore")} /> <span className="font-mono-stat font-bold">3 − 3 = 0</span>. {t("rules.scoring.reduceAfter")}</p></div>
          </div>
          <p className="mt-2 inline-flex items-center gap-1 flex-wrap"><strong>{t("rules.scoring.total")}</strong> {t("rules.scoring.previous")} <ArrowRight size={14} aria-hidden="true" /> {t("rules.scoring.plus")} <ArrowRight size={14} aria-hidden="true" /> {t("rules.scoring.new")}</p>
        </RuleSection>

        <RuleSection number="06" title={t("rules.takeover.title")}>
          <p><RuleText text={t("rules.takeover.text")} /></p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-3">
            {[["scores.meta.water.name", "15 + 5", 20], ["scores.meta.pygmy.name", "15 + 10", 25], ["rules.takeover.both", "15 + 5 + 10", 30]].map(([nameKey, math, total]) => <div key={nameKey} className="rule-example rounded-md p-3 text-center"><div className="font-display font-bold">{t("rules.takeover.allRed", { name: t(nameKey) })}</div><div className="font-mono-stat text-xs mt-1">{math}</div><div className="font-display text-3xl font-bold">{t("rules.takeover.heat", { count: total })}</div></div>)}
          </div>
          <p className="mt-3">{t("rules.takeover.effects")}</p>
          <div className="rule-note rounded-md p-3 mt-3"><RuleText text={t("rules.takeover.exception")} /></div>
        </RuleSection>

        <RuleSection number="07" title={t("rules.online.title")}>
          <p>{t("rules.online.bots")}</p>
          <p className="mt-2">{t("rules.online.restore")}</p>
          <p className="rule-note rounded-md p-3 mt-3 text-xs"><RuleText text={t("rules.online.variant")} /></p>
        </RuleSection>
      </div>
    </DialogContent>
  </Dialog>;
}
