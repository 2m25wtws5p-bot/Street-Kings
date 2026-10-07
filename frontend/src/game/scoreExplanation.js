// Presentation of an authoritative round result. This module never awards points.
export const SCORE_CARD_META = {
  fire: { suit: "RED", rank: 11, name: "Kingpin", colorName: "Rot", ink: "#a3232c", paper: "#ffe5dc", role: "Bringt Hitze" },
  water: { suit: "GREEN", rank: 11, name: "Informant", colorName: "Grün", ink: "#146543", paper: "#d8f3df", role: "Bringt Hitze" },
  pygmy: { suit: "GREEN", rank: 12, name: "Patin", colorName: "Grün", ink: "#146543", paper: "#d8f3df", role: "Bringt Hitze" },
  air: { suit: "BLUE", rank: 11, name: "Fixer", colorName: "Blau", ink: "#1655a6", paper: "#dceeff", role: "Hilft gegen Hitze" },
  earth: { suit: "YELLOW", rank: 11, name: "Schmierer", colorName: "Gelb", ink: "#704600", paper: "#fff0b8", role: "Hilft gegen Hitze" },
  wizard: { suit: null, rank: 0, name: "Laufjunge", colorName: "Neutral", ink: "#344153", paper: "#edf2f8", role: "Jederzeit spielbar" },
};

export function signedScore(value) {
  return value > 0 ? `+${value}` : value < 0 ? `−${Math.abs(value)}` : "0";
}

export function explainRoundScore(result, { score = 0, roundResult = {}, pile } = {}) {
  const r = { ...result };
  // Local play has captured piles; old online results still work without them.
  if (Array.isArray(pile)) {
    for (const [key, field] of [["fire", "fireWitch"], ["water", "water"], ["pygmy", "pygmy"], ["air", "air"], ["earth", "earth"]]) {
      r[field] = r[field] || pile.some(card => card.special === key);
    }
  }
  const total = Number.isFinite(r.total) ? r.total : 0;
  const previous = score - total;
  const count = Math.max(0, Number(r.fireCards) || 0);
  const red = r.fireWitch ? Math.min(count * 2, 15) : count;
  const green = (r.water ? 5 : 0) + (r.pygmy ? 10 : 0);
  const steps = [];
  const step = (id, title, math, note, cardKey, suit, status) => steps.push({ id, title, math, note, cardKey, suit, status });
  const spellWithheld = Boolean(roundResult.spellWithheld || r.spellWithheld || total < 0);
  const spell = Number(roundResult.spellPoints) || (r.moon ? 15 + green : (roundResult.results || []).find(item => item.spellVictim && item.total > 0)?.total) || (r.spellVictim ? total : 0);

  if (r.moon) {
    step("takeover-red", "Alle 14 roten Karten", "13 × 2 → 15", "Kingpin zählt selbst 0; die roten Punkte sind auf 15 gedeckelt.", "fire", "RED", "Maximum 15");
    if (r.water) step("water", "Informant", "+5", "Teil des Takeovers.", "water", "GREEN");
    if (r.pygmy) step("pygmy", "Patin", "+10", "Teil des Takeovers.", "pygmy", "GREEN");
    step("takeover", "Takeover", `15${r.water ? " + 5" : ""}${r.pygmy ? " + 10" : ""} = ${spell}`, spellWithheld ? "Die anderen erhalten 0; du senkst deinen Gesamtstand um den Takeover, höchstens bis 0." : `Jede andere Crew erhält ${spell} Hitze; deine Runde zählt 0.`, null, null, spellWithheld ? "Ende verhindert" : "Übertragen");
  } else if (r.spellVictim) {
    step("takeover", "Takeover der anderen Crew", signedScore(total), spellWithheld ? "Das Spielende wurde verhindert: dein Gesamtstand bleibt gleich." : "Diese Pauschale ersetzt deine normale Rundenwertung.", null, null, spellWithheld ? "Ende verhindert" : "Übertragen");
  } else {
    step("red", "Rote Punktekarten", `${count} × 1 = ${count}`, r.fireWitch ? "Die rote 11 ist hier nicht mitgezählt." : "Jede rote Karte außer dem Kingpin bringt 1 Hitze.", null, "RED");
    if (r.fireWitch) step("fire", "Kingpin", `${count} × 2${count * 2 > 15 ? ` → ${red}` : ` = ${red}`}`, "Verdoppelt nur rote Punkte; selbst 0 Hitze.", "fire", "RED", count * 2 > 15 ? "Maximum 15" : null);
    if (r.water) step("water", "Informant", "+5", "Grüne 11: zusätzliche Hitze.", "water", "GREEN");
    if (r.pygmy) step("pygmy", "Patin", "+10", "Grüne 12: zusätzliche Hitze.", "pygmy", "GREEN");
    const beforeFixer = red + green;
    const neutralized = r.air ? beforeFixer : 0;
    if (r.air) step("air", "Fixer", `−${neutralized} → ${beforeFixer - neutralized}`, "Neutralisiert alle roten und grünen Hitze-Punkte dieser Runde.", "air", "BLUE", "Neutralisiert");
    const beforeEarth = beforeFixer - neutralized;
    const reduction = r.earth ? Math.min(5, beforeEarth) : 0;
    if (r.earth) step("earth", "Schmierer", `−${reduction} → ${beforeEarth - reduction}`, reduction < 5 ? "Nur vorhandene Rundenhitze wird abgezogen; Minimum 0." : "Zieht bis zu 5 Hitze aus dieser Runde ab.", "earth", "YELLOW", reduction === 0 ? "Keine Hitze übrig" : "Reduziert");
  }

  if (r.moon || r.spellVictim) {
    for (const [key, field] of [["air", "air"], ["earth", "earth"]]) {
      if (r[field]) step(`inactive-${key}`, SCORE_CARD_META[key].name, "ohne Effekt", "Bei einem Takeover verlieren Sonderkarten ihre normalen Fähigkeiten.", key, SCORE_CARD_META[key].suit, "Takeover: inaktiv");
    }
    if (r.spellVictim) {
      for (const key of ["water", "pygmy"]) if (r[key]) step(`inactive-${key}`, SCORE_CARD_META[key].name, "ohne Effekt", "Die Takeover-Pauschale gilt unabhängig von deinen Karten.", key, "GREEN", "Takeover: inaktiv");
    }
  }
  return { steps, total, previous, score, spell, spellWithheld, isTakeover: Boolean(r.moon || r.spellVictim), ledger: `${previous} ${total < 0 ? "−" : "+"} ${Math.abs(total)} = ${score}` };
}
