import React, { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui/dialog";
import { loadStats, clearStats } from "../game/storage";
import { Trophy, Siren, ScrollText, Trash2, Crown } from "lucide-react";
import { gameApi } from "../game/api";

export function StatsDialog({ open, onOpenChange }) {
  const [stats, setStats] = useState(loadStats);
  const [recent, setRecent] = useState([]);

  useEffect(() => {
    if (!open) return;
    let active = true;
    const controller = new AbortController();
    setStats(loadStats());
    setRecent([]);
    gameApi.recent({ signal: controller.signal })
      .then(games => { if (active) setRecent(games); })
      .catch(() => { if (active) setRecent([]); });
    return () => { active = false; controller.abort(); };
  }, [open]);

  const players = Object.entries(stats.players || {})
    .map(([name, record]) => ({ name, ...record, avg: record.games ? (record.totalFire / record.games).toFixed(1) : 0 }))
    .sort((a, b) => b.wins - a.wins || a.avg - b.avg);

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="street-dialog stats-dialog w-[calc(100vw-1.5rem)] max-w-xl max-h-[88dvh] overflow-y-auto p-4 sm:p-6" data-testid="stats-dialog">
      <DialogHeader className="street-dialog-header pr-6">
        <p className="street-dialog-kicker font-display text-xs tracking-[0.2em] font-bold">Street Kings · Crew-Statistik</p>
        <DialogTitle className="street-dialog-title font-display text-3xl flex items-center gap-2"><ScrollText size={28} aria-hidden="true" />Die Akte</DialogTitle>
        <DialogDescription className="street-dialog-description text-sm">Deine abgeschlossenen Partien auf diesem Gerät. Weniger Hitze ist besser.</DialogDescription>
      </DialogHeader>

      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <Stat icon={<Trophy size={21} />} label="Spiele" value={stats.gamesPlayed || 0} />
        <Stat icon={<ScrollText size={21} />} label="Runden" value={stats.roundsPlayed || 0} />
        <Stat icon={<Siren size={21} />} label="Wenigste Hitze" value={stats.lowestScore ?? "—"} />
      </div>

      <section>
        <h3 className="font-display text-xl font-bold mb-2">Rangliste der Crews</h3>
        {players.length === 0 ? <div className="stats-empty rounded-md p-5 text-center"><Crown size={30} className="mx-auto mb-2" aria-hidden="true" /><p className="font-display text-lg font-bold">Die Akte ist noch leer</p><p className="text-sm mt-1">Nach deiner ersten abgeschlossenen Partie steht hier die Crew-Rangliste.</p></div> : <ol className="space-y-2">
          {players.map((p, i) => <li key={p.name} className="stats-crew rounded-md px-3 py-3" data-testid={`stats-player-${p.name}`}>
            <div className="flex items-center gap-2 min-w-0"><span className="stats-place font-display font-bold text-lg w-6 shrink-0">{i + 1}.</span>{i === 0 && <Crown size={18} className="shrink-0" aria-label="Führende Crew" />}<span className="font-display text-lg font-bold truncate">{p.name}</span></div>
            <div className="stats-crew-metrics grid grid-cols-3 gap-2 mt-2 text-xs"><span><strong className="font-mono-stat">{p.wins}</strong> Siege</span><span><strong className="font-mono-stat">{p.games}</strong> Spiele</span><span><strong className="font-mono-stat">{p.avg}</strong> Ø Hitze</span></div>
          </li>)}
        </ol>}
      </section>

      {recent.length > 0 && <section>
        <h3 className="font-display text-xl font-bold mb-1">Die Straße spricht</h3>
        <p className="text-xs mb-2">Zuletzt abgeschlossene Online-Partien, weltweit.</p>
        <div className="space-y-2">{recent.map((game, i) => <div key={game.id || i} className="stats-recent rounded-md px-3 py-2 text-sm">
          <div className="flex items-start gap-2"><Trophy size={15} className="shrink-0 mt-0.5" aria-hidden="true" /><span className="font-semibold break-words min-w-0">{game.winners.join(", ")}</span></div>
          <p className="text-xs mt-1 ml-[23px]">{game.players} Crews · {game.rounds} Runden</p>
        </div>)}</div>
      </section>}

      <button onClick={() => setStats(clearStats())} className="stats-clear rounded-md px-3 py-2 flex items-center justify-center gap-2 text-xs font-semibold mx-auto" data-testid="btn-clear-stats"><Trash2 size={14} aria-hidden="true" />Lokale Akte löschen</button>
    </DialogContent>
  </Dialog>;
}

function Stat({ icon, label, value }) {
  return <div className="stats-metric rounded-md p-2 sm:p-3 text-center">
    <div className="grid place-items-center mb-1" aria-hidden="true">{icon}</div>
    <div className="font-display text-3xl font-bold">{value}</div>
    <div className="text-[10px] sm:text-[11px] uppercase font-bold tracking-wide">{label}</div>
  </div>;
}
