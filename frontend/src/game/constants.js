// Statische Spielkonstanten für STREET KINGS (Regelmechanik nach Amigo-Original).

export const SUITS = {
  RED: {
    key: "RED",
    people: "Hitze",
    realm: "Polizeidruck & Fahndung",
    icon: "siren",
    primary: "#EF4444",
    accent: "#F87171",
    neon: "#FF2A2A",
    border: "#7F1D1D",
    grad: "from-[#240d12] via-[#15090b] to-[#0d0608]",
    isFire: true,
  },
  YELLOW: {
    key: "YELLOW",
    people: "Schwarzmarkt",
    realm: "Untergrundhandel",
    icon: "mask",
    primary: "#FACC15",
    accent: "#FDE047",
    neon: "#FFE600",
    border: "#713F12",
    grad: "from-[#241d08] via-[#171306] to-[#0d0a03]",
    isFire: false,
  },
  BLUE: {
    key: "BLUE",
    people: "Cash",
    realm: "Geld & Bargeld",
    icon: "banknote",
    primary: "#00A3FF",
    accent: "#38BDF8",
    neon: "#00E5FF",
    border: "#0C4A6E",
    grad: "from-[#091726] via-[#08101a] to-[#050b12]",
    isFire: false,
  },
  GREEN: {
    key: "GREEN",
    people: "Ware",
    realm: "Schmuggel & illegale Geschäfte",
    icon: "package",
    primary: "#10B981",
    accent: "#34D399",
    neon: "#00FF88",
    border: "#064E3B",
    grad: "from-[#091e14] via-[#07150e] to-[#040d08]",
    isFire: false,
  },
};

export const SUIT_ORDER = ["RED", "YELLOW", "BLUE", "GREEN"];

// special -> suit,value mapping (Originalregeln: Rot 11, Grün 11, Gelb 11, Blau 11, Grün 12)
export const SPECIAL_MAP = {
  fire: { suit: "RED", value: 11 },
  water: { suit: "GREEN", value: 11 },
  earth: { suit: "YELLOW", value: 11 },
  air: { suit: "BLUE", value: 11 },
  pygmy: { suit: "GREEN", value: 12 },
};

export const SPECIALS = {
  fire: {
    key: "fire",
    label: "Kingpin",
    short: "HITZE x2",
    tag: "#EF4444",
    desc: "Der mächtigste Gangster der Stadt (Hitze 11). Verdoppelt die gesamte Hitze, die du in dieser Runde kassierst (maximal 15). Er selbst bringt keine Hitze.",
  },
  water: {
    key: "water",
    label: "Informant",
    short: "+5 HITZE",
    tag: "#00FF88",
    desc: "Ein zwielichtiger Informant (Ware 11), der Informationen an die Bullen verkauft. Wer ihn im Stich kassiert, zieht +5 Hitze auf sich.",
  },
  earth: {
    key: "earth",
    label: "Schmierer",
    short: "-5 HITZE",
    tag: "#FACC15",
    desc: "Ein korrupter Kontakt (Schwarzmarkt 11), der mit Geld und Beziehungen Probleme aus der Welt schafft. Nimmt dir in dieser Runde bis zu 5 Hitze ab.",
  },
  air: {
    key: "air",
    label: "Fixer",
    short: "NEUTRALISIERT",
    tag: "#00E5FF",
    desc: "Ein mächtiger Problemlöser mit hervorragenden Kontakten (Cash 11). Lässt die Hitze von Informant (+5) und Patin (+10) verschwinden, wenn du ihn hältst.",
  },
  pygmy: {
    key: "pygmy",
    label: "Patin",
    short: "+10 HITZE",
    tag: "#E11D48",
    desc: "Die mächtigste Figur der Unterwelt, über allen Crews (Ware 12). Wer sie kassiert, zieht brutale +10 Hitze auf sich.",
  },
  wizard: {
    key: "wizard",
    label: "Laufjunge",
    short: "WERT 0",
    tag: "#94A3B8",
    desc: "Junger Bote der Crews. Jederzeit spielbar, muss keine Farbe bedienen. Gewinnt nie einen Stich (außer es liegen nur Laufjungen). Dein sicherer Ausweg.",
  },
};

export const AVATARS = [
  { key: "boss", label: "Boss", icon: "crown", color: "#FACC15" },
  { key: "dealer", label: "Dealer", icon: "banknote", color: "#F472B6" },
  { key: "driver", label: "Fahrer", icon: "car", color: "#94A3B8" },
  { key: "smuggler", label: "Schmuggler", icon: "package", color: "#34D399" },
  { key: "hacker", label: "Hacker", icon: "laptop", color: "#00E5FF" },
  { key: "lawyer", label: "Anwalt", icon: "briefcase", color: "#FB923C" },
];

export const WIN_THRESHOLD = 70;
