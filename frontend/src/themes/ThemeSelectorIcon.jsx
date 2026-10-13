import React from "react";
import { Crown, PawPrint, Orbit } from "lucide-react";

export function ThemeSelectorIcon({ theme }) {
  const Icon = theme === "animal" ? PawPrint : theme === "space" ? Orbit : Crown;
  return <Icon className="theme-selector-icon" size={24} aria-hidden="true" />;
}
