import { de } from "../i18n/messages/rules";

// Presentation of an authoritative round result. This module never awards points.
const CARD_IDENTITIES = {
  kingpin: { suit: "RED", rank: 11, ink: "#a3232c", paper: "#ffe5dc", roleKey: "heat" },
  informant: { suit: "GREEN", rank: 11, ink: "#146543", paper: "#d8f3df", roleKey: "heat" },
  godmother: { suit: "GREEN", rank: 12, ink: "#146543", paper: "#d8f3df", roleKey: "heat" },
  fixer: { suit: "BLUE", rank: 11, ink: "#1655a6", paper: "#dceeff", roleKey: "help" },
  briber: { suit: "YELLOW", rank: 11, ink: "#704600", paper: "#fff0b8", roleKey: "help" },
  runner: { suit: null, rank: 0, ink: "#344153", paper: "#edf2f8", roleKey: "anytime" },
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
    for (const [key, field] of [["kingpin", "kingpin"], ["informant", "informant"], ["godmother", "godmother"], ["fixer", "fixer"], ["briber", "briber"]]) {
      r[field] = r[field] || pile.some(card => card.special === key);
    }
  }
  const total = Number.isFinite(r.total) ? r.total : 0;
  const previous = score - total;
  const count = Math.max(0, Number(r.heatCards) || 0);
  const red = r.kingpin ? Math.min(count * 2, 15) : count;
  const green = (r.informant ? 5 : 0) + (r.godmother ? 10 : 0);
  const steps = [];
  const step = (id, title, math, note, cardKey, suit, status) => steps.push({ id, title, math, note, cardKey, suit, status });
  const takeoverWithheld = Boolean(roundResult.takeoverWithheld || r.takeoverWithheld || total < 0);
  const takeover = Number(roundResult.takeoverPoints) || (r.moon ? 15 + green : (roundResult.results || []).find(item => item.takeoverVictim && item.total > 0)?.total) || (r.takeoverVictim ? total : 0);

  if (r.moon) {
    step("takeover-red", t("scores.step.allRed"), "13 × 2 → 15", t("scores.step.takeoverRedNote"), "kingpin", "RED", t("scores.step.maximum"));
    if (r.informant) step("informant", t("scores.meta.informant.name"), "+5", t("scores.step.takeoverPart"), "informant", "GREEN");
    if (r.godmother) step("godmother", t("scores.meta.godmother.name"), "+10", t("scores.step.takeoverPart"), "godmother", "GREEN");
    step("takeover", t("scores.step.takeover"), `15${r.informant ? " + 5" : ""}${r.godmother ? " + 10" : ""} = ${takeover}`, takeoverWithheld ? t("scores.step.takeoverWithheldNote") : t("scores.step.takeoverOtherHeat", { heat: takeover }), null, null, t(takeoverWithheld ? "scores.step.prevented" : "scores.step.transferred"));
  } else if (r.takeoverVictim) {
    step("takeover", t("scores.step.opponentTakeover"), signedScore(total), t(takeoverWithheld ? "scores.step.opponentWithheld" : "scores.step.replaces"), null, null, t(takeoverWithheld ? "scores.step.prevented" : "scores.step.transferred"));
  } else {
    step("red", t("scores.step.red"), `${count} × 1 = ${count}`, t(r.kingpin ? "scores.step.red11Excluded" : "scores.step.redPoint"), null, "RED");
    if (r.kingpin) step("kingpin", t("scores.meta.kingpin.name"), `${count} × 2${count * 2 > 15 ? ` → ${red}` : ` = ${red}`}`, t("scores.step.doubleRed"), "kingpin", "RED", count * 2 > 15 ? t("scores.step.maximum") : null);
    if (r.informant) step("informant", t("scores.meta.informant.name"), "+5", t("scores.step.green11"), "informant", "GREEN");
    if (r.godmother) step("godmother", t("scores.meta.godmother.name"), "+10", t("scores.step.green12"), "godmother", "GREEN");
    const beforeFixer = red + green;
    const neutralized = r.fixer ? beforeFixer : 0;
    if (r.fixer) step("fixer", t("scores.meta.fixer.name"), `−${neutralized} → ${beforeFixer - neutralized}`, t("scores.step.neutralizeNote"), "fixer", "BLUE", t("scores.step.neutralized"));
    const beforeEarth = beforeFixer - neutralized;
    const reduction = r.briber ? Math.min(5, beforeEarth) : 0;
    if (r.briber) step("briber", t("scores.meta.briber.name"), `−${reduction} → ${beforeEarth - reduction}`, t(reduction < 5 ? "scores.step.availableOnly" : "scores.step.reduceNote"), "briber", "YELLOW", t(reduction === 0 ? "scores.step.noHeat" : "scores.step.reduced"));
  }

  if (r.moon || r.takeoverVictim) {
    for (const [key, field] of [["fixer", "fixer"], ["briber", "briber"]]) {
      if (r[field]) step(`inactive-${key}`, t(`scores.meta.${key}.name`), t("scores.step.noEffect"), t("scores.step.inactiveNote"), key, CARD_IDENTITIES[key].suit, t("scores.step.inactive"));
    }
    if (r.takeoverVictim) {
      for (const key of ["informant", "godmother"]) if (r[key]) step(`inactive-${key}`, t(`scores.meta.${key}.name`), t("scores.step.noEffect"), t("scores.step.flatRegardless"), key, "GREEN", t("scores.step.inactive"));
    }
  }
  return { steps, total, previous, score, takeover, takeoverWithheld, isTakeover: Boolean(r.moon || r.takeoverVictim), ledger: `${previous} ${total < 0 ? "−" : "+"} ${Math.abs(total)} = ${score}` };
}
