import React, { useEffect, useRef } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { CardView } from "./CardView";
import { Avatar } from "./Avatar";
import { sfx } from "../game/sound";

function cardPose(id) {
  let seed = 0;
  for (const letter of id) seed = (seed * 31 + letter.charCodeAt(0)) >>> 0;
  seed = Math.imul(seed ^ (seed >>> 16), 0x45d9f3b) >>> 0;
  seed = (seed ^ (seed >>> 16)) >>> 0;
  return { tilt: ((seed % 101) / 100 - .5) * 7, lift: (seed % 5) - 2, duration: .48 + (seed % 6) * .017 };
}

export function TrickCards({ trick, players, n, trickKey, winner, complete, sweeping = false }) {
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
  const winnerX = ((winner ?? 0) - (n - 1) / 2) * 70;
  return <div className="trick-cards flex flex-wrap gap-3 justify-center items-end" aria-live="polite" aria-label="Gespielte Karten in Reihenfolge">
    <AnimatePresence>
      {trick.map((entry, index) => {
        const player = players.find((p, i) => (p.seat ?? i) === entry.seat);
        const originX = (entry.seat - (n - 1) / 2) * 70;
        const pose = cardPose(`${trickKey}-${entry.card.id}`);
        return <motion.div key={`${trickKey}-${entry.seat}-${entry.card.id}`} layout={!reduced} className="played-card flex flex-col items-center gap-1"
          initial={reduced ? { opacity: 0 } : { x: originX, y: 70, rotate: pose.tilt - 7, scale: .94, opacity: 0 }}
          animate={sweeping ? { x: winnerX, y: -85, scale: .9, opacity: 0 } : { x: 0, y: 0, rotate: 0, scale: 1, opacity: 1 }}
          exit={reduced ? { opacity: 0 } : { x: winnerX, y: -85, scale: .9, opacity: 0 }}
          transition={{ duration: reduced ? .05 : sweeping ? .48 : pose.duration, ease: [.18, .8, .25, 1], layout: { type: "spring", stiffness: 135, damping: 24 } }}>
          <div className="played-card-label flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 border border-white/15">
            <span className="text-amber-200 text-[10px]">{index + 1}.</span><Avatar avatar={player?.avatar} size={16} />
            <span className="text-[10px] text-slate-200 max-w-[70px] truncate" title={player?.name}>{player?.name}</span>
          </div>
          <motion.div animate={{ rotate: reduced ? 0 : pose.tilt, y: reduced ? 0 : pose.lift }} transition={{ duration: .55, ease: [.18, .8, .25, 1] }}><CardView card={entry.card} size="md" testId={`played-trick-card-${entry.seat}`} className={complete && entry.seat === winner ? "trick-winner-card" : ""} /></motion.div>
        </motion.div>;
      })}
    </AnimatePresence>
  </div>;
}
