import React from "react";
import { Eye, Sparkles, Skull, Sprout, FlaskConical, WandSparkles } from "lucide-react";

const MAP = {
  oracle: Eye,
  sorceress: Sparkles,
  necromancer: Skull,
  druidess: Sprout,
  alchemist: FlaskConical,
  enchanter: WandSparkles,
};

export function Avatar({ avatar, size = 40, active = false, className = "" }) {
  const Icon = MAP[avatar?.key] || Sparkles;
  const color = avatar?.color || "#C084FC";
  return (
    <div
      className={`rounded-full grid place-items-center transition-all ${active ? "glow-ring scale-110" : ""} ${className}`}
      style={{
        width: size,
        height: size,
        background: `radial-gradient(circle at 30% 25%, ${color}44, #160823 75%)`,
        border: `1.5px solid ${color}88`,
      }}
    >
      <Icon size={Math.round(size * 0.5)} color={color} strokeWidth={2} />
    </div>
  );
}
