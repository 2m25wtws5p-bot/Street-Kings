import { de } from "../i18n/messages/rules";

// Presentation of an authoritative round result. This module never awards points.
const CARD_IDENTITIES = {
  fire: { suit: "RED", rank: 11, ink: "#a3232c", paper: "#ffe5dc", roleKey: "heat" },
  water: { suit: "GREEN", rank: 11, ink: "#146543", paper: "#d8f3df", roleKey: "heat" },
  pygmy: { suit: "GREEN", rank: 12, ink: "#146543", paper: "#d8f3df", roleKey: "heat" },
  air: { suit: "BLUE", rank: 11, ink: "#1655a6", paper: "#dceeff", roleKey: "help" },
  earth: { suit: "YELLOW", rank: 11, ink: "#704600", paper: "#fff0b8", roleKey: "help" },
  wizard: { suit: null, rank: 0, ink: "#344153", paper: "#edf2f8", roleKey: "anytime" },
};

// Non-React callers keep the previous German default. React passes its viewer's t.
function defaultTranslate(key, params = {}) {
  const message = de[key] || key;
  return message.replace(/\{(\w+)\}/g, (_, param) => String(params[param] ?? `{${param}}`));
}

export function getScoreCardMeta(t = defaultTranslate) {
  return Object.fromEntries(Object.entries(CARD_IDENTITIES).map(([key, card]) => [key, {
    ...card,
    name: t(`scores.meta.${key}.name`),
    colorName: t(`scores.color.${card.suit || "neutral"}`),
    role: t(`scores.role.${card.roleKey}`),
  }]));
}

export const SCORE_CARD_META = getScoreCardMeta();

export function signedScore(value) {
  return value > 0 ? `+${value}` : value < 0 ? `−${Math.abs(value)}` : "0";
}

export function explainRoundScore(result, { score = 0, roundResult = {}, pile, t = defaultTranslate } = {}) {
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
    step("takeover-red", t("scores.step.allRed"), "13 × 2 → 15", t("scores.step.takeoverRedNote"), "fire", "RED", t("scores.step.maximum"));
    if (r.water) step("water", t("scores.meta.water.name"), "+5", t("scores.step.takeoverPart"), "water", "GREEN");
    if (r.pygmy) step("pygmy", t("scores.meta.pygmy.name"), "+10", t("scores.step.takeoverPart"), "pygmy", "GREEN");
    step("takeover", t("scores.step.takeover"), `15${r.water ? " + 5" : ""}${r.pygmy ? " + 10" : ""} = ${spell}`, spellWithheld ? t("scores.step.takeoverWithheldNote") : t("scores.step.takeoverOtherHeat", { heat: spell }), null, null, t(spellWithheld ? "scores.step.prevented" : "scores.step.transferred"));
  } else if (r.spellVictim) {
    step("takeover", t("scores.step.opponentTakeover"), signedScore(total), t(spellWithheld ? "scores.step.opponentWithheld" : "scores.step.replaces"), null, null, t(spellWithheld ? "scores.step.prevented" : "scores.step.transferred"));
  } else {
    step("red", t("scores.step.red"), `${count} × 1 = ${count}`, t(r.fireWitch ? "scores.step.red11Excluded" : "scores.step.redPoint"), null, "RED");
    if (r.fireWitch) step("fire", t("scores.meta.fire.name"), `${count} × 2${count * 2 > 15 ? ` → ${red}` : ` = ${red}`}`, t("scores.step.doubleRed"), "fire", "RED", count * 2 > 15 ? t("scores.step.maximum") : null);
    if (r.water) step("water", t("scores.meta.water.name"), "+5", t("scores.step.green11"), "water", "GREEN");
    if (r.pygmy) step("pygmy", t("scores.meta.pygmy.name"), "+10", t("scores.step.green12"), "pygmy", "GREEN");
    const beforeFixer = red + green;
    const neutralized = r.air ? beforeFixer : 0;
    if (r.air) step("air", t("scores.meta.air.name"), `−${neutralized} → ${beforeFixer - neutralized}`, t("scores.step.neutralizeNote"), "air", "BLUE", t("scores.step.neutralized"));
    const beforeEarth = beforeFixer - neutralized;
    const reduction = r.earth ? Math.min(5, beforeEarth) : 0;
    if (r.earth) step("earth", t("scores.meta.earth.name"), `−${reduction} → ${beforeEarth - reduction}`, t(reduction < 5 ? "scores.step.availableOnly" : "scores.step.reduceNote"), "earth", "YELLOW", t(reduction === 0 ? "scores.step.noHeat" : "scores.step.reduced"));
  }

  if (r.moon || r.spellVictim) {
    for (const [key, field] of [["air", "air"], ["earth", "earth"]]) {
      if (r[field]) step(`inactive-${key}`, t(`scores.meta.${key}.name`), t("scores.step.noEffect"), t("scores.step.inactiveNote"), key, CARD_IDENTITIES[key].suit, t("scores.step.inactive"));
    }
    if (r.spellVictim) {
      for (const key of ["water", "pygmy"]) if (r[key]) step(`inactive-${key}`, t(`scores.meta.${key}.name`), t("scores.step.noEffect"), t("scores.step.flatRegardless"), key, "GREEN", t("scores.step.inactive"));
    }
  }
  return { steps, total, previous, score, spell, spellWithheld, isTakeover: Boolean(r.moon || r.spellVictim), ledger: `${previous} ${total < 0 ? "−" : "+"} ${Math.abs(total)} = ${score}` };
}
