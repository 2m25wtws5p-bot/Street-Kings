import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { CardView } from "./CardView";
import { useI18n } from "../i18n/I18nProvider";
import "./TableImprovements.css";

export const EXCHANGE_REVEAL_MS = 1800;

// A private, once-per-round receipt. Polls, language changes and reconnects
// must not restart it, and a hot-seat gate must hide it immediately.
export function ExchangeReveal({ exchange, scopeKey, available }) {
  const { t } = useI18n();
  const reduced = useReducedMotion();
  const seen = useRef(new Map());
  const [receipt, setReceipt] = useState(null);
  const signature = exchange?.received?.map(card => card.id).join("|") || "";
  useEffect(() => {
    if (!available || !signature) { setReceipt(null); return; }
    const key = `${scopeKey}:${signature}`;
    const until = seen.current.get(key) ?? Date.now() + EXCHANGE_REVEAL_MS;
    seen.current.set(key, until);
    const remaining = until - Date.now();
    if (remaining <= 0) { setReceipt(null); return; }
    setReceipt({ key: scopeKey, exchange });
    const timer = setTimeout(() => setReceipt(null), remaining);
    return () => clearTimeout(timer);
    // Exchange snapshots arrive as new objects during polling; IDs are stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [available, scopeKey, signature]);
  // Privacy gates must unmount immediately, without an exit animation retaining
  // the previous player's private cards on a shared device.
  if (!available || receipt?.key !== scopeKey) return null;
  const visible = available && receipt?.key === scopeKey;
  return <AnimatePresence>{visible && <motion.aside key={scopeKey}
    className="exchange-receipt" data-testid="exchange-receipt" role="status" aria-live="polite"
    initial={reduced ? { opacity: 0 } : { opacity: 0, y: 24 }}
    animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
    transition={{ duration: reduced ? .05 : .25 }}>
    <h3>{t("improvements.receivedFrom", { name: receipt.exchange.receivedFrom })}</h3>
    <div className="exchange-receipt-cards">{receipt.exchange.received.map((card, index) =>
      <motion.div key={card.id} initial={reduced ? false : { x: 30, rotate: 8, opacity: 0 }}
        animate={{ x: 0, rotate: 0, opacity: 1 }} transition={{ delay: reduced ? 0 : index * .06, duration: .3 }}>
        <CardView card={card} size="md" testId={`received-card-${card.id}`} />
      </motion.div>)}</div>
  </motion.aside>}</AnimatePresence>;
}
