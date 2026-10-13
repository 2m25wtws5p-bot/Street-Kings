import { de, en } from "../i18n/messages/animalCrews.js";
import { de as spaceDe, en as spaceEn } from "../i18n/messages/spaceSmugglers.js";
import { normalizeTheme } from "./themeConfig.js";

export function getThemeMessages(theme, language) {
  const id = normalizeTheme(theme);
  if (id === "animal") return language === "en" ? en : de;
  if (id === "space") return language === "en" ? spaceEn : spaceDe;
  return null;
}

export const ANIMAL_AVATAR_NAMES = {
  de: ["Rabe", "Waschbär", "Wolf", "Biber", "Fuchs", "Eule", "Maus", "Hyäne", "Hase", "Panther", "Bär", "Luchs", "Kojote", "Dachs", "Otter", "Roter Panda", "Wildschwein", "Elster"],
  en: ["Raven", "Raccoon", "Wolf", "Beaver", "Fox", "Owl", "Mouse", "Hyena", "Rabbit", "Panther", "Bear", "Lynx", "Coyote", "Badger", "Otter", "Red panda", "Boar", "Magpie"],
};

export const ANIMAL_CARD_CELLS = Object.freeze({
  RED: 0, YELLOW: 1, BLUE: 2, GREEN: 3, kingpin: 4,
  informant: 5, briber: 6, fixer: 7, godmother: 8, runner: 9,
});

export const SPACE_AVATAR_NAMES = {
  de: ["Kapitänin", "Ingenieur", "Alien-Navigator", "Pilot", "Mechanikerin", "Serviceroboter", "Funkerin", "Alien-Händler", "Frachtkurier", "Wissenschaftlerin", "Android", "Alien-Botaniker", "Kometenkurierin", "Bordkoch", "Alien-Diplomatin", "Sternenkartograf", "Rover-Roboter", "Alien-Sanitäter"],
  en: ["Captain", "Engineer", "Alien navigator", "Pilot", "Mechanic", "Service robot", "Comms officer", "Alien trader", "Cargo courier", "Scientist", "Android", "Alien botanist", "Comet courier", "Space cook", "Alien diplomat", "Star mapper", "Rover robot", "Alien medic"],
};

// Both atlases share the presentation grid, never card IDs or gameplay values.
export const SPACE_CARD_CELLS = Object.freeze({ ...ANIMAL_CARD_CELLS });

export function atlasPosition(index, columns, rows) {
  return `${index % columns * 100 / (columns - 1)}% ${Math.floor(index / columns) * 100 / (rows - 1)}%`;
}
