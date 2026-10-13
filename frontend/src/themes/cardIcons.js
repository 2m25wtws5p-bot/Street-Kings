import { Siren, Banknote, Package, VenetianMask, Crown, Handshake, Coins, Eye, Gem, Footprints, TriangleAlert, ShieldCheck, Sparkles, Cookie, Droplets, Leaf, PawPrint, Rabbit, Heart, Flower2, Sun } from "lucide-react";
import { useTheme } from "./ThemeProvider";

// Keep the original icon maps as stable exports for existing Street screens.
// The theme changes presentation only: suit/special identifiers never change.
export const SUIT_ICON = { RED: Siren, YELLOW: VenetianMask, BLUE: Banknote, GREEN: Package };
export const SPECIAL_ICON = { kingpin: Crown, informant: Eye, briber: Coins, fixer: Handshake, godmother: Gem, runner: Footprints };
export const ANIMAL_SUIT_ICON = { RED: Sun, YELLOW: Cookie, BLUE: Droplets, GREEN: Leaf };
export const ANIMAL_SPECIAL_ICON = { kingpin: Sparkles, informant: Flower2, briber: Heart, fixer: ShieldCheck, godmother: PawPrint, runner: Rabbit };

const STREET_ICONS = { suits: SUIT_ICON, specials: SPECIAL_ICON, runner: Footprints, risk: TriangleAlert, help: ShieldCheck, heat: Siren };
const ANIMAL_ICONS = { suits: ANIMAL_SUIT_ICON, specials: ANIMAL_SPECIAL_ICON, runner: Rabbit, risk: Sparkles, help: Heart, heat: Sparkles };

export function useCardIcons() {
  const { theme } = useTheme();
  return theme === "animal" ? ANIMAL_ICONS : STREET_ICONS;
}
