import React from "react";
import { Crown, Banknote, Car, Package, Laptop, Briefcase, User } from "lucide-react";

const MAP = {
  boss: Crown,
  dealer: Banknote,
  driver: Car,
  smuggler: Package,
  hacker: Laptop,
  lawyer: Briefcase,
};

export function Avatar({ avatar, size = 40, active = false, className = "" }) {
  const Icon = MAP[avatar?.key] || User;
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
