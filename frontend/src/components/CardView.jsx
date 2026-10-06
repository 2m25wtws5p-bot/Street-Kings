import React from "react";
import { Siren, Banknote, Package, VenetianMask, Crown, Handshake, Coins, Eye, Gem, Footprints, Star } from "lucide-react";
import { SUITS, SPECIALS } from "../game/constants";

export const SUIT_ICON = { RED: Siren, YELLOW: VenetianMask, BLUE: Banknote, GREEN: Package };

export const SPECIAL_ICON = {
  fire: Crown,
  water: Eye,
  earth: Coins,
  air: Handshake,
  pygmy: Gem,
  wizard: Footprints,
};

const SIZES = {
  xs: "w-11 h-[64px]",
  sm: "w-16 h-[92px]",
  md: "w-20 h-[116px]",
  lg: "w-[104px] h-[148px]",
};

const NUM = { xs: "text-sm", sm: "text-lg", md: "text-2xl", lg: "text-4xl" };
const ICON_SZ = { xs: 22, sm: 30, md: 40, lg: 54 };

function CardBack({ sizeCls, className }) {
  return (
    <div
      className={`${sizeCls} card-concrete shrink-0 rounded-lg relative overflow-hidden ${className}`}
      style={{ backgroundColor: "#171a21", border: "2px solid #313746", boxShadow: "0 6px 16px rgba(0,0,0,0.7), inset 0 0 0 1px rgba(255,255,255,0.05)" }}
    >
      <div className="absolute inset-[4px] rounded-md border border-white/10 hazard-tape opacity-70" />
      <div className="absolute inset-0 grid place-items-center">
        <span className="font-display font-black text-white/70 text-lg tracking-tight" style={{ textShadow: "0 0 10px rgba(250,204,21,0.5)" }}>SK</span>
      </div>
    </div>
  );
}

export function CardView({
  card,
  size = "md",
  faceDown = false,
  selected = false,
  dim = false,
  onClick,
  className = "",
  testId,
}) {
  const sizeCls = SIZES[size] || SIZES.md;

  if (faceDown || !card) return <CardBack sizeCls={sizeCls} className={className} />;

  const suit = card.suit ? SUITS[card.suit] : null;
  const isWizard = card.special === "wizard";
  const special = card.special ? SPECIALS[card.special] : null;
  const Icon = card.suit ? SUIT_ICON[card.suit] : Footprints;
  const SpecialIcon = card.special ? SPECIAL_ICON[card.special] : null;
  const accent = suit ? suit.accent : "#CBD5E1";
  const neon = special ? special.tag : suit ? suit.neon : "#94A3B8";
  const numeral = isWizard ? "0" : card.value;
  const isFire = card.suit === "RED";
  const gradCls = suit ? suit.grad : "from-[#1c2029] via-[#141720] to-[#0d0f13]";
  const pipColor = special ? special.tag : accent;
  const Comp = onClick ? "button" : "div";

  return (
    <Comp
      type={onClick ? "button" : undefined}
      onClick={onClick}
      data-testid={testId}
      data-special={special && !isWizard ? card.special : undefined}
      data-received-from={card.receivedFrom || undefined}
      aria-label={`${card.suit || "Laufjunge"} ${numeral}${special ? ` · ${special.label}: ${special.short}` : ""}${card.receivedFrom ? ` · von ${card.receivedFrom}` : ""}`}
      title={card.receivedFrom ? `Erhalten von ${card.receivedFrom}` : undefined}
      className={`${sizeCls} relative shrink-0 rounded-lg overflow-hidden text-left transition-transform duration-200 ${
        selected ? "-translate-y-4 z-20" : ""
      } ${dim ? "opacity-40 saturate-50" : ""} ${onClick ? "cursor-pointer hover:-translate-y-1" : ""} ${className}`}
      style={{
        border: `2px solid ${special ? special.tag : suit ? suit.primary : "#64748B"}`,
        boxShadow: selected
          ? `0 0 0 2px ${neon}, 0 0 26px ${neon}aa, 0 10px 20px rgba(0,0,0,0.7)`
          : special
          ? `0 8px 18px rgba(0,0,0,0.7), 0 0 16px ${special.tag}66`
          : `0 8px 18px rgba(0,0,0,0.7), 0 0 8px ${neon}33`,
      }}
    >
      <div className={`absolute inset-0 bg-gradient-to-b ${gradCls}`} />
      <div className="absolute inset-0 card-concrete" />
      <div className="absolute inset-[3px] rounded-md border border-white/10 pointer-events-none" />

      {special ? (
        <>
          <div className="absolute inset-0" style={{ background: `radial-gradient(circle at 50% 42%, ${special.tag}3a, transparent 60%)` }} />
          {size !== "xs" && (
            <>
              <Star size={8} className="absolute top-1.5 right-2" color={special.tag} fill={special.tag} />
              <Star size={8} className="absolute bottom-1.5 left-2" color={special.tag} fill={special.tag} />
            </>
          )}
          <div className="absolute inset-0 grid place-items-center pb-3">
            <SpecialIcon
              size={ICON_SZ[size]}
              color={special.tag}
              strokeWidth={1.6}
              style={{ filter: `drop-shadow(0 0 10px ${special.tag}bb)` }}
            />
          </div>
        </>
      ) : (
        <div className="absolute inset-0 grid place-items-center">
          <Icon size={ICON_SZ[size]} color={accent} strokeWidth={1.5} className="opacity-60" style={{ filter: `drop-shadow(0 0 8px ${neon}66)` }} />
        </div>
      )}

      {/* top-left pip */}
      {card.receivedFrom && <span className="card-source" title={`Erhalten von ${card.receivedFrom}`}>↪ {card.receivedFrom}</span>}
      <div className="absolute top-1 left-1.5 flex flex-col items-center leading-none">
        <span className={`font-display font-black ${NUM[size]}`} style={{ color: pipColor, textShadow: `0 0 8px ${neon}88, 0 1px 3px rgba(0,0,0,0.9)` }}>
          {numeral}
        </span>
        <Icon size={size === "xs" ? 9 : 12} color={pipColor} strokeWidth={2.2} />
      </div>

      {/* bottom-right pip */}
      {size !== "xs" && (
        <div className="absolute bottom-1 right-1.5 flex flex-col items-center leading-none rotate-180">
          <span className={`font-display font-black ${NUM[size]}`} style={{ color: pipColor, textShadow: `0 0 8px ${neon}88, 0 1px 3px rgba(0,0,0,0.9)` }}>
            {numeral}
          </span>
          <Icon size={size === "xs" ? 9 : 12} color={pipColor} strokeWidth={2.2} />
        </div>
      )}

      {/* Hitze badge on plain red cards */}
      {isFire && !special && size !== "xs" && (
        <div className="absolute top-1 right-1 grid place-items-center rounded-sm bg-red-950/85 border border-red-500/70 police-strobe" style={{ width: 18, height: 18 }}>
          <Siren size={11} color="#fca5a5" />
        </div>
      )}

      {/* special banner: hazard tape */}
      {special && size !== "xs" && (
        <div className="absolute bottom-0 inset-x-0 px-1 pt-1.5 pb-1 text-center" style={{ background: `linear-gradient(0deg, ${special.tag}f0 0%, ${special.tag}99 70%, transparent)` }}>
          <div className="font-display text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-black leading-tight">{special.label}</div>
          {!isWizard && <div className="font-mono-stat text-[8px] font-bold text-black/80 leading-tight">{special.short}</div>}
        </div>
      )}
    </Comp>
  );
}

