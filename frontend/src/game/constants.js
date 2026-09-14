// Statische Spielkonstanten für STREET KINGS (Regelmechanik identisch mit dem Original).

export const SUITS = {
  RED: {
    key: "RED",
    people: "Hitze",
    realm: "Polizeidruck & Fahndung",
    icon: "flame",
    primary: "#DC2626",
    accent: "#EF4444",
    border: "#7F1D1D",
    grad: "from-[#3b0d0d] to-[#160707]",
    isFire: true,
  },
  YELLOW: {
    key: "YELLOW",
    people: "Schwarzmarkt",
    realm: "Untergrundhandel",
    icon: "sun",
    primary: "#EAB308",
    accent: "#FACC15",
    border: "#854D0E",
    grad: "from-[#3a2f08] to-[#161105]",
    isFire: false,
  },
  BLUE: {
    key: "BLUE",
    people: "Cash",
    realm: "Geld & Bargeld",
    icon: "mountain-snow",
    primary: "#2563EB",
    accent: "#60A5FA",
    border: "#1E3A8A",
    grad: "from-[#0d1e3b] to-[#070d18]",
    isFire: false,
  },
  GREEN: {
    key: "GREEN",
    people: "Ware",
    realm: "Schmuggel & illegale Geschäfte",
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
    label: "Kingpin",
    short: "HITZE x2",
    tag: "#EF4444",
    desc: "Der mächtigste Gangster der Stadt. Verdoppelt die gesamte Hitze, die du in dieser Runde kassierst (maximal 15). Er selbst bringt keine Hitze.",
  },
  water: {
    key: "water",
    label: "Fixer",
    short: "+5 HITZE",
    tag: "#38BDF8",
    desc: "Ein mächtiger Problemlöser mit hervorragenden Kontakten. Wer ihn im Stich kassiert, zieht +5 Hitze auf sich.",
  },
  earth: {
    key: "earth",
    label: "Informant",
    short: "-5 HITZE",
    tag: "#4ADE80",
    desc: "Ein zwielichtiger Informant, der Informationen verkauft. Lenkt in dieser Runde bis zu 5 Hitze von dir ab.",
  },
  air: {
    key: "air",
    label: "Schmierer",
    short: "NEUTRALISIERT",
    tag: "#FACC15",
    desc: "Ein korrupter Kontakt, der mit Geld und Beziehungen Probleme aus der Welt schafft. Hebt die Hitze von Fixer (+5) und Patin (+10) auf, wenn du ihn hältst.",
  },
  pygmy: {
    key: "pygmy",
    label: "Patin",
    short: "+10 HITZE",
    tag: "#A855F7",
    desc: "Die mächtigste Figur der Unterwelt, über allen Crews. Wer sie kassiert, zieht brutale +10 Hitze auf sich.",
  },
  wizard: {
    key: "wizard",
    label: "Laufjunge",
    short: "WERT 0",
    tag: "#C084FC",
    desc: "Junger Bote der Crews. Jederzeit spielbar, muss keine Farbe bedienen. Gewinnt nie einen Stich (außer es liegen nur Laufjungen). Dein sicherer Ausweg.",
  },
};

export const AVATARS = [
  { key: "boss", label: "Boss", icon: "crown", color: "#C084FC" },
  { key: "dealer", label: "Dealer", icon: "banknote", color: "#F472B6" },
  { key: "driver", label: "Fahrer", icon: "car", color: "#94A3B8" },
  { key: "smuggler", label: "Schmuggler", icon: "package", color: "#4ADE80" },
  { key: "hacker", label: "Hacker", icon: "laptop", color: "#38BDF8" },
  { key: "lawyer", label: "Anwalt", icon: "briefcase", color: "#FBBF24" },
];

export const WIN_THRESHOLD = 70;
