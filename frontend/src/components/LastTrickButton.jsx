import React, { useEffect, useRef, useState } from "react";
import { CardView } from "./CardView";

export function LastTrickButton({ trick, players, winner }) {
  const [open, setOpen] = useState(false);
  const dialog = useRef(null);
  useEffect(() => {
    const element = dialog.current;
    if (open && element && !element.open) element.showModal();
    if (!open && element?.open) element.close();
  }, [open]);
  const name = (seat) => players.find((p, i) => (p.seat ?? i) === seat)?.name || "Spieler";
  return <>
    <button type="button" className="last-trick-button" disabled={!trick?.length} onClick={() => setOpen(true)} data-testid="btn-last-trick">Letzter Stich</button>
    <dialog ref={dialog} className="last-trick-dialog" onCancel={() => setOpen(false)} onClose={() => setOpen(false)} onClick={(event) => { if (event.target === dialog.current) setOpen(false); }}>
      <div className="flex items-center justify-between gap-3 mb-4"><h2 className="font-display text-lg text-amber-200">Letzter Stich</h2><button type="button" autoFocus onClick={() => setOpen(false)} aria-label="Letzten Stich schließen" className="rounded border border-white/20 px-3 py-1">Schließen</button></div>
      <p className="text-sm text-emerald-300 mb-4">Gewonnen von {name(winner)}</p>
      <div className="flex flex-wrap justify-center gap-3">{trick?.map((entry) => <div key={entry.seat} className="text-center"><p className="text-xs mb-2 max-w-20 truncate" title={name(entry.seat)}>{name(entry.seat)}</p><CardView card={entry.card} size="sm" /></div>)}</div>
    </dialog>
  </>;
}
