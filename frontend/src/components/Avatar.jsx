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
  const color = avatar?.color || "#94A3B8";
  return (
    <div
      className={`rounded-md grid place-items-center transition-all card-concrete ${active ? "scale-110" : ""} ${className}`}
      style={{
        width: size,
        height: size,
        backgroundColor: "#171a21",
        backgroundImage: `radial-gradient(circle at 30% 25%, ${color}33, transparent 70%)`,
        border: `1.5px solid ${color}aa`,
        boxShadow: active ? `0 0 0 2px ${color}, 0 0 18px ${color}99` : `0 0 6px ${color}33`,
      }}
    >
      <Icon size={Math.round(size * 0.5)} color={color} strokeWidth={2} style={{ filter: `drop-shadow(0 0 4px ${color}88)` }} />
    </div>
  );
}
