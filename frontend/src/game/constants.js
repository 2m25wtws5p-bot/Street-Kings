// Static game constants for the Witches (Amigo) card game.

export const SUITS = {
  RED: {
    key: "RED",
    people: "Goblins",
    realm: "Volcano Country",
    icon: "flame",
    primary: "#DC2626",
    accent: "#EF4444",
    border: "#7F1D1D",
    grad: "from-[#3b0d0d] to-[#160707]",
    isFire: true,
  },
  YELLOW: {
    key: "YELLOW",
    people: "Mongols",
    realm: "The Desert",
    icon: "sun",
    primary: "#EAB308",
    accent: "#FACC15",
    border: "#854D0E",
    grad: "from-[#3a2f08] to-[#161105]",
    isFire: false,
  },
  BLUE: {
    key: "BLUE",
    people: "Indians",
    realm: "Stormy Mountains",
    icon: "mountain-snow",
    primary: "#2563EB",
    accent: "#60A5FA",
    border: "#1E3A8A",
    grad: "from-[#0d1e3b] to-[#070d18]",
    isFire: false,
  },
  GREEN: {
    key: "GREEN",
    people: "Pygmies",
    realm: "The Rainforest",
    icon: "leaf",
    primary: "#16A34A",
    accent: "#4ADE80",
    border: "#14532D",
    grad: "from-[#0d3b1e] to-[#07160e]",
    isFire: false,
  },
};

export const SUIT_ORDER = ["RED", "YELLOW", "BLUE", "GREEN"];

// special -> suit,value mapping (source of truth used by the engine)
export const SPECIAL_MAP = {
  fire: { suit: "RED", value: 11 },
  water: { suit: "BLUE", value: 11 },
  earth: { suit: "GREEN", value: 11 },
  air: { suit: "YELLOW", value: 11 },
  pygmy: { suit: "GREEN", value: 12 },
};

export const SPECIALS = {
  fire: {
    key: "fire",
    label: "Fire Witch",
    short: "DOUBLES FIRE",
    tag: "#EF4444",
    desc: "Doubles all the fire points you collect this round (up to a maximum of 15). She carries no points of her own.",
  },
  water: {
    key: "water",
    label: "Water Witch",
    short: "+5 FIRE",
    tag: "#38BDF8",
    desc: "Carries a penalty of +5 fire points to whoever takes her in a trick.",
  },
  earth: {
    key: "earth",
    label: "Earth Witch",
    short: "-5 FIRE",
    tag: "#4ADE80",
    desc: "A bountiful blessing — reduces your fire points by up to 5 this round.",
  },
  air: {
    key: "air",
    label: "Air Witch",
    short: "NEUTRALIZER",
    tag: "#FACC15",
    desc: "A purifying storm — cancels the penalty points of the Water Witch (+5) and Pygmy Queen (+10) if you hold her.",
  },
  pygmy: {
    key: "pygmy",
    label: "Pygmy Queen",
    short: "+10 FIRE",
    tag: "#A855F7",
    desc: "The dread queen — inflicts a punishing +10 fire points upon whoever takes her.",
  },
  wizard: {
    key: "wizard",
    label: "Wizard",
    short: "VALUE 0",
    tag: "#C084FC",
    desc: "Play him anytime, he follows no suit. He never wins a trick (unless only wizards are played). Your safe escape card.",
  },
};

export const AVATARS = [
  { key: "oracle", label: "Oracle", icon: "eye", color: "#C084FC" },
  { key: "sorceress", label: "Sorceress", icon: "sparkles", color: "#F472B6" },
  { key: "necromancer", label: "Necromancer", icon: "skull", color: "#94A3B8" },
  { key: "druidess", label: "Druidess", icon: "sprout", color: "#4ADE80" },
  { key: "alchemist", label: "Alchemist", icon: "flask-conical", color: "#38BDF8" },
  { key: "enchanter", label: "Enchanter", icon: "wand-sparkles", color: "#FBBF24" },
];

export const WIN_THRESHOLD = 70;
