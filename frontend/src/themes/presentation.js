import { de, en } from "../i18n/messages/animalCrews.js";
import { normalizeTheme } from "./themeConfig.js";

export function getThemeMessages(theme, language) {
  if (normalizeTheme(theme) !== "animal") return null;
  return language === "en" ? en : de;
}

export const ANIMAL_AVATAR_NAMES = {
  de: ["Rabe", "Waschbär", "Wolf", "Biber", "Fuchs", "Eule", "Ratte", "Hyäne", "Hase", "Panther", "Bär", "Luchs", "Kojote", "Dachs", "Otter", "Roter Panda", "Wildschwein", "Elster"],
  en: ["Raven", "Raccoon", "Wolf", "Beaver", "Fox", "Owl", "Rat", "Hyena", "Rabbit", "Panther", "Bear", "Lynx", "Coyote", "Badger", "Otter", "Red panda", "Boar", "Magpie"],
};

export const ANIMAL_CARD_CELLS = Object.freeze({
  RED: 0, YELLOW: 1, BLUE: 2, GREEN: 3, kingpin: 4,
  informant: 5, briber: 6, fixer: 7, godmother: 8, runner: 9,
});

export function atlasPosition(index, columns, rows) {
  return `${index % columns * 100 / (columns - 1)}% ${Math.floor(index / columns) * 100 / (rows - 1)}%`;
}
