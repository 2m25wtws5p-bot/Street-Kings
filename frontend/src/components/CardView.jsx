import React from "react";
import { Siren, Banknote, Package, VenetianMask, Crown, Handshake, Coins, Eye, Gem, Footprints, TriangleAlert, ShieldCheck } from "lucide-react";
import { useI18n } from "../i18n/I18nProvider";
import { useGameLabels } from "../i18n/gameLabels";
import { CARD_ART } from "../game/cardArt";

export const SUIT_ICON = { RED: Siren, YELLOW: VenetianMask, BLUE: Banknote, GREEN: Package };
export const SPECIAL_ICON = { fire: Crown, water: Eye, earth: Coins, air: Handshake, pygmy: Gem, wizard: Footprints };
// Width is responsive; one printed-card ratio governs every size and state.
const SIZES = { xs: "w-11", sm: "w-16", md: "w-20", lg: "w-[104px]" };
const NUM = { xs: "text-sm", sm: "text-lg", md: "text-2xl", lg: "text-4xl" };
// Suit identity always wins over a special's badge color (including green 12).
const INK = { RED: "#a3232c", YELLOW: "#704600", BLUE: "#1655a6", GREEN: "#146543" };
const PAPER = { RED: "#ffe5dc", YELLOW: "#fff0b8", BLUE: "#dceeff", GREEN: "#d8f3df" };
// Presentation only: gameplay and scoring remain in the engines.
export const CARD_IMPACT = { fire: "risk", water: "risk", pygmy: "risk", earth: "help", air: "help", wizard: "neutral" };
const HAND_EFFECT = { fire: "×2", water: "+5", pygmy: "+10", earth: "−5", air: "Ø", wizard: "0" };

function CardBack({ sizeCls, className, testId, style }) {
  const { t } = useI18n();
  return <div className={`${sizeCls} street-card-back shrink-0 rounded-lg relative overflow-hidden ${className}`} data-testid={testId} style={style} aria-label={t('cards.faceDown')}>
    <div className="absolute inset-[4px] rounded-md border border-[#e8c98c]/60" />
    <div className="absolute inset-0 grid place-items-center"><span className="street-wordmark text-[#ffe5ac] text-lg -rotate-12">SK</span></div>
  </div>;
}

export function CardView({ card, size = "md", faceDown = false, selected = false, dim = false, onClick, className = "", testId,
  style, dragging = false, onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onLostPointerCapture }) {
  const { t } = useI18n();
  const { suits: SUITS, specials: SPECIALS } = useGameLabels();
  const sizeCls = SIZES[size] || SIZES.md;
  if (faceDown || !card) return <CardBack sizeCls={sizeCls} className={className} testId={testId} style={style} />;
  const suit = SUITS[card.suit];
  const special = SPECIALS[card.special];
  const isWizard = card.special === "wizard";
  const Icon = SUIT_ICON[card.suit] || Footprints;
  const SpecialIcon = SPECIAL_ICON[card.special];
  const ink = INK[card.suit] || "#273444";
  const paper = PAPER[card.suit] || "#edf2f8";
  const accent = suit?.primary || "#a7b3c5";
  const impact = CARD_IMPACT[card.special];
  const ImpactIcon = impact === "risk" ? TriangleAlert : impact === "help" ? ShieldCheck : SpecialIcon;
  const effect = t(impact === "risk" ? 'cards.effectRisk' : impact === "help" ? 'cards.effectHelp' : 'cards.effectNeutral');
  const numeral = isWizard ? "0" : card.value;
  const artwork = CARD_ART[card.special] || CARD_ART[card.suit];
  const Comp = onClick ? "button" : "div";
  return <Comp type={onClick ? "button" : undefined} onClick={onClick}
    onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}
    onPointerCancel={onPointerCancel} onLostPointerCapture={onLostPointerCapture}
    data-testid={testId} data-suit={card.suit || "NEUTRAL"} data-card-size={size} data-impact={impact}
    data-special={special && !isWizard ? card.special : undefined}
    data-selected={selected ? "true" : undefined} data-dragging={dragging ? "true" : undefined} aria-pressed={onClick ? selected : undefined}
    data-received-from={card.receivedFrom || undefined}
    aria-label={`${suit?.people || t('cards.wizard.label')} ${numeral}${special ? ` · ${special.label}: ${special.desc} · ${effect}` : ""}${card.receivedFrom ? ` · ${t('cards.from', { name: card.receivedFrom })}` : ""}`}
    title={[special ? `${special.label}: ${special.desc}` : null, card.receivedFrom ? t('cards.receivedFrom', { name: card.receivedFrom }) : null].filter(Boolean).join(" · ") || undefined}
    className={`${sizeCls} street-card relative shrink-0 rounded-lg overflow-hidden text-left transition-transform duration-200 ${selected ? "-translate-y-4 z-20" : ""} ${dim ? "opacity-40 saturate-50" : ""} ${onClick ? "cursor-pointer hover:-translate-y-1" : ""} ${className}`}
    style={{ "--suit-ink": ink, "--suit-paper": paper, "--suit-accent": accent, backgroundColor: paper,
      border: `3px solid ${accent}`, boxShadow: selected ? `0 0 0 2px #fff8df, 0 0 12px ${accent}66, 0 10px 20px #0008` : special ? `0 7px 15px #0007, 0 0 0 1px #10191d, 0 0 7px ${accent}33` : "0 6px 12px #0006, 0 0 0 1px #10191d", ...style }}>
    {artwork && <img className="card-art" src={artwork} alt="" draggable={false} decoding="async" />}
    <div className="card-print-shade" aria-hidden="true" />
    <div className="absolute inset-[3px] rounded-md border border-white/25 pointer-events-none" />
    {selected && <span className="card-selection-check" aria-hidden="true">✓</span>}
    <div className="card-pip card-pip-top">
      <span className={`font-display font-black ${NUM[size]}`}>{numeral}</span>
      <Icon size={size === "xs" ? 9 : 12} strokeWidth={2.4} />
    </div>
    {!special && size !== "xs" && <div className="card-suit-stamp" aria-hidden="true"><Icon size={12} strokeWidth={2} /></div>}
    {size !== "xs" && !special && <div className="card-pip card-pip-bottom rotate-180"><span className={`font-display font-black ${NUM[size]}`}>{numeral}</span><Icon size={12} strokeWidth={2.4} /></div>}
    {special && <div className="card-special-stamp" title={effect} aria-hidden="true"><ImpactIcon size={size === "xs" ? 10 : 14} strokeWidth={2.2}/></div>}
    {special && <span className="card-hand-effect" aria-hidden="true"><ImpactIcon size={9} /><b>{HAND_EFFECT[card.special]}</b></span>}
    {special && size !== "xs" && <div className="card-special-banner">
      <div className="font-display card-special-name">{special.label}</div>
      <div className="card-special-rule">{special.short}</div>
      {!isWizard && <div className="card-impact-label">{t(impact === "risk" ? 'cards.danger' : 'cards.protection')}</div>}
    </div>}
  </Comp>;
}

