import React, { useEffect, useLayoutEffect, useRef } from "react";
import { AnimatePresence, motion, useAnimation, useReducedMotion } from "framer-motion";
import { CardView } from "./CardView";
import { Avatar } from "./Avatar";
import { sfx } from "../game/sound";
import { useI18n } from "../i18n/I18nProvider";
import { playedCardOrigin } from "../game/cardMotion";
import "./TableImprovements.css";

function cardPose(id) {
  let seed = 0;
  for (const letter of id) seed = (seed * 31 + letter.charCodeAt(0)) >>> 0;
  seed = Math.imul(seed ^ (seed >>> 16), 0x45d9f3b) >>> 0;
  seed = (seed ^ (seed >>> 16)) >>> 0;
  return { tilt: ((seed % 101) / 100 - .5) * 7, lift: (seed % 5) - 2, duration: .48 + (seed % 6) * .017 };
}

export function TrickCards({ trick, players, n, trickKey, winner, complete, sweeping = false }) {
  const { t } = useI18n();
  const reduced = useReducedMotion();
  const sounded = useRef(null);
  const latest = trick[trick.length - 1];
  useEffect(() => {
    if (!latest) return;
    const key = `${trickKey}-${latest.seat}-${latest.card.id}`;
    if (sounded.current === key) return;
    sounded.current = key;
    sfx.playCard(latest.card, key);
  }, [trickKey, latest]);
  return <div className="trick-cards flex justify-center items-end" data-player-count={n}
    style={{ "--trick-player-count": n }} aria-live="polite" aria-label={t("game.playedOrder")}>
    <AnimatePresence>
      {trick.map((entry, index) => {
        const player = players.find((p, i) => (p.seat ?? i) === entry.seat);
        const pose = cardPose(`${trickKey}-${entry.card.id}`);
        return <PlayedTrickCard key={`${trickKey}-${entry.seat}-${entry.card.id}`} entry={entry} pose={pose} reduced={reduced} sweeping={sweeping} winner={winner} n={n}>
          <div className="played-card-label flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 border border-white/15" title={`${index + 1}. ${player?.name || t("game.player")}`}>
            <span className="text-amber-200 text-[10px]">{index + 1}.</span><Avatar avatar={player?.avatar} size={16} />
            <span className="text-[10px] text-slate-200 max-w-[70px] truncate" title={player?.name}>{player?.name}</span>
          </div>
          <motion.div className="played-card-art" animate={{ rotate: reduced ? 0 : pose.tilt, y: reduced ? 0 : pose.lift }} transition={{ duration: .55, ease: [.18, .8, .25, 1] }}><CardView card={entry.card} size="md" testId={`played-trick-card-${entry.seat}`} className={complete && entry.seat === winner ? "trick-winner-card" : ""} /></motion.div>
        </PlayedTrickCard>;
      })}
    </AnimatePresence>
  </div>;
}

function PlayedTrickCard({ entry, pose, reduced, sweeping, winner, n, children }) {
  const node = useRef(null);
  const controls = useAnimation();
  useLayoutEffect(() => {
    const target = node.current?.getBoundingClientRect();
    const source = playedCardOrigin(entry.card.id, entry.seat);
    if (!reduced && source && target) {
      controls.set({ x: source.x - (target.x + target.width / 2), y: source.y - (target.y + target.height / 2), rotate: pose.tilt - 8, scale: .9, opacity: 0 });
    }
    controls.start({ x: 0, y: 0, rotate: 0, scale: 1, opacity: 1, transition: { duration: reduced ? .05 : pose.duration, ease: [.18, .8, .25, 1] } });
    // Runs only for a newly played card, never for polling object changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const winnerX = ((winner ?? 0) - (n - 1) / 2) * 70;
  useEffect(() => {
    if (sweeping) controls.start({ x: winnerX, y: -85, scale: .9, opacity: 0, transition: { duration: reduced ? .05 : .48 } });
  }, [sweeping, winnerX, controls, reduced]);
  return <motion.div ref={node} layout={!reduced} className="played-card flex flex-col items-center gap-1" data-played-seat={entry.seat}
    initial={{ opacity: 0 }} animate={controls}
    exit={reduced ? { opacity: 0 } : { x: winnerX, y: -85, scale: .9, opacity: 0 }}
    transition={{ duration: reduced ? .05 : .48, layout: { type: "spring", stiffness: 135, damping: 24 } }}>
    {children}
  </motion.div>;
}
