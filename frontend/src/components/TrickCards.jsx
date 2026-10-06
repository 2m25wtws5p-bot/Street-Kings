import React from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { CardView } from "./CardView";
import { Avatar } from "./Avatar";

export function TrickCards({ trick, players, n, trickKey, winner, complete, sweeping = false }) {
  const reduced = useReducedMotion();
  const winnerX = ((winner ?? 0) - (n - 1) / 2) * 70;
  return <div className="trick-cards flex flex-wrap gap-3 justify-center items-end" aria-live="polite" aria-label="Gespielte Karten in Reihenfolge">
    <AnimatePresence>
      {trick.map((entry, index) => {
        const player = players.find((p, i) => (p.seat ?? i) === entry.seat);
        const originX = (entry.seat - (n - 1) / 2) * 70;
        return <motion.div key={`${trickKey}-${entry.seat}-${entry.card.id}`} layout={!reduced} className="played-card flex flex-col items-center gap-1"
          initial={reduced ? { opacity: 0 } : { x: originX, y: 90, rotate: -10, scale: .8, opacity: 0 }}
          animate={sweeping ? { x: winnerX, y: -100, scale: .65, opacity: 0 } : { x: 0, y: 0, rotate: 0, scale: 1, opacity: 1 }}
          exit={reduced ? { opacity: 0 } : { x: winnerX, y: -100, scale: .65, opacity: 0 }}
          transition={{ duration: reduced ? .05 : .42, ease: [.22, 1, .36, 1], layout: { duration: .3 } }}>
          <div className="played-card-label flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 border border-white/15">
            <span className="text-amber-200 text-[10px]">{index + 1}.</span><Avatar avatar={player?.avatar} size={16} />
            <span className="text-[10px] text-slate-200 max-w-[70px] truncate" title={player?.name}>{player?.name}</span>
          </div>
          <div style={{ transform: `rotate(${(index % 3 - 1) * 3}deg)` }}><CardView card={entry.card} size="md" testId={`played-trick-card-${entry.seat}`} className={complete && entry.seat === winner ? "glow-ring" : ""} /></div>
        </motion.div>;
      })}
    </AnimatePresence>
  </div>;
}
