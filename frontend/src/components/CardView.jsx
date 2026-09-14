import React from "react";
import { Flame, Sun, MountainSnow, Leaf, Star, Droplets, Wind, Crown, Sparkles, Sprout } from "lucide-react";
import { SUITS, SPECIALS } from "../game/constants";
import { CARD_BACK } from "../game/assets";

const SUIT_ICON = { RED: Flame, YELLOW: Sun, BLUE: MountainSnow, GREEN: Leaf };

export const SPECIAL_ICON = {
  fire: Flame,
  water: Droplets,
  earth: Sprout,
  air: Wind,
  pygmy: Crown,
  wizard: Sparkles,
};

const SIZES = {
  xs: "w-11 h-[62px]",
  sm: "w-16 h-[90px]",
  md: "w-20 h-[112px]",
  lg: "w-[104px] h-[146px]",
};

const NUM = { xs: "text-sm", sm: "text-lg", md: "text-xl", lg: "text-3xl" };
const ICON_SZ = { xs: 22, sm: 30, md: 40, lg: 54 };

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

  if (faceDown || !card) {
    return (
      <div
        className={`${sizeCls} shrink-0 rounded-lg overflow-hidden border-2 border-amber-700/40 shadow-[0_6px_16px_rgba(0,0,0,0.6)] ${className}`}
        style={{ backgroundImage: `url(${CARD_BACK})`, backgroundSize: "cover", backgroundPosition: "center" }}
      />
    );
  }

  const suit = card.suit ? SUITS[card.suit] : null;
  const isWizard = card.special === "wizard";
  const special = card.special ? SPECIALS[card.special] : null;
  const Icon = card.suit ? SUIT_ICON[card.suit] : Star;
  const SpecialIcon = card.special ? SPECIAL_ICON[card.special] : null;
  const accent = suit ? suit.accent : "#C084FC";
  const border = special ? special.tag : suit ? suit.border : "#6b21a8";
  const numeral = isWizard ? "0" : card.value;
  const isFire = card.suit === "RED";
  const gradCls = suit ? suit.grad : "from-[#2a123f] to-[#160823]";
  const pipColor = special ? special.tag : accent;
  const Comp = onClick ? "button" : "div";

  return (
    <Comp
      type={onClick ? "button" : undefined}
      onClick={onClick}
      data-testid={testId}
      className={`${sizeCls} relative shrink-0 rounded-lg overflow-hidden text-left transition-transform duration-200 ${
        selected ? "-translate-y-4 glow-ring z-20" : ""
      } ${dim ? "opacity-40 saturate-50" : ""} ${onClick ? "cursor-pointer" : ""} ${className}`}
      style={{
        border: `2px solid ${border}`,
        boxShadow: special
          ? `0 8px 18px rgba(0,0,0,0.6), 0 0 16px ${special.tag}55, inset 0 0 14px ${special.tag}22`
          : "0 8px 18px rgba(0,0,0,0.6)",
      }}
    >
      <div className={`absolute inset-0 bg-gradient-to-b ${gradCls}`} />

      {special ? (
        <>
          {/* special-card treatment: glowing sigil, no photo art */}
          <div className="absolute inset-0" style={{ background: `radial-gradient(circle at 50% 40%, ${special.tag}40, transparent 62%)` }} />
          <div className="absolute inset-[3px] rounded-md border border-white/15 pointer-events-none" />
          {size !== "xs" && (
            <>
              <Star size={9} className="absolute top-1 right-1.5" color={special.tag} fill={special.tag} />
              <Star size={9} className="absolute bottom-1 left-1.5" color={special.tag} fill={special.tag} />
            </>
          )}
          <div className="absolute inset-0 grid place-items-center pb-3">
            <SpecialIcon
              size={ICON_SZ[size]}
              color={special.tag}
              strokeWidth={1.6}
              style={{ filter: `drop-shadow(0 0 10px ${special.tag}aa)` }}
            />
          </div>
        </>
      ) : (
        <div className="absolute inset-0 grid place-items-center">
          <Icon size={ICON_SZ[size]} color={accent} strokeWidth={1.4} className="opacity-70" />
        </div>
      )}

      {/* top-left pip */}
      <div className="absolute top-1 left-1.5 flex flex-col items-center leading-none">
        <span className={`font-display font-black ${NUM[size]}`} style={{ color: pipColor, textShadow: "0 1px 4px rgba(0,0,0,0.9)" }}>
          {numeral}
        </span>
        <Icon size={size === "xs" ? 9 : 12} color={pipColor} strokeWidth={2.2} />
      </div>

      {/* bottom-right pip */}
      {size !== "xs" && (
        <div className="absolute bottom-1 right-1.5 flex flex-col items-center leading-none rotate-180">
          <span className={`font-display font-black ${NUM[size]}`} style={{ color: pipColor, textShadow: "0 1px 4px rgba(0,0,0,0.9)" }}>
            {numeral}
          </span>
          <Icon size={size === "xs" ? 9 : 12} color={pipColor} strokeWidth={2.2} />
        </div>
      )}

      {/* fire badge on plain red number cards */}
      {isFire && !special && size !== "xs" && (
        <div className="absolute top-1 right-1 grid place-items-center rounded-full bg-red-950/80 border border-red-500/60" style={{ width: 18, height: 18 }}>
          <Flame size={11} color="#fca5a5" />
        </div>
      )}

      {/* special banner */}
      {special && !isWizard && size !== "xs" && (
        <div className="absolute bottom-0 inset-x-0 px-1 py-1 text-center" style={{ background: `linear-gradient(0deg, ${special.tag}ee, transparent)` }}>
          <div className="font-display text-[8px] sm:text-[9px] font-bold uppercase tracking-wider text-white leading-tight">{special.label}</div>
          <div className="font-mono-stat text-[8px] text-white/90">{special.short}</div>
        </div>
      )}
      {isWizard && size !== "xs" && (
        <div className="absolute bottom-0 inset-x-0 px-1 py-1 text-center" style={{ background: `linear-gradient(0deg, ${special.tag}dd, transparent)` }}>
          <div className="font-display text-[9px] font-bold uppercase tracking-wider text-white">Wizard</div>
        </div>
      )}
    </Comp>
  );
}
