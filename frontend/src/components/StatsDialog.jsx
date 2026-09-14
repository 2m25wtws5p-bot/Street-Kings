import React, { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { loadStats, clearStats } from "../game/storage";
import { Trophy, Siren, ScrollText, Trash2, Crown } from "lucide-react";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export function StatsDialog({ open, onOpenChange }) {
  const [stats, setStats] = useState(loadStats());
  const [recent, setRecent] = useState([]);

  useEffect(() => {
    if (open) {
      setStats(loadStats());
      axios
        .get(`${API}/games/recent?limit=8`)
        .then((r) => setRecent(r.data || []))
        .catch(() => setRecent([]));
    }
  }, [open]);

  const players = Object.entries(stats.players || {})
    .map(([name, r]) => ({ name, ...r, avg: r.games ? (r.totalFire / r.games).toFixed(1) : 0 }))
    .sort((a, b) => b.wins - a.wins || a.avg - b.avg);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="panel max-w-xl max-h-[85vh] overflow-y-auto border-amber-500/30" data-testid="stats-dialog">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl gold-text flex items-center gap-2">
            <ScrollText className="text-amber-400" /> Die Akte
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-3 my-2">
          <Stat icon={<Trophy size={18} />} label="Spiele" value={stats.gamesPlayed || 0} />
          <Stat icon={<ScrollText size={18} />} label="Runden" value={stats.roundsPlayed || 0} />
          <Stat icon={<Siren size={18} />} label="Wenigste Hitze" value={stats.lowestScore ?? "—"} />
        </div>

        <h3 className="font-display text-amber-300 text-sm mt-3 mb-1">Rangliste der Crews</h3>
        {players.length === 0 ? (
          <p className="text-slate-300/60 text-sm py-3 text-center">Noch keine Spiele in der Akte. Spiel eine Partie!</p>
        ) : (
          <div className="space-y-1.5">
            {players.map((p, i) => (
              <div key={p.name} className="flex items-center justify-between rounded-lg bg-black/30 px-3 py-2 border border-white/10" data-testid={`stats-player-${p.name}`}>
                <div className="flex items-center gap-2">
                  {i === 0 && <Crown size={15} className="text-amber-400" />}
                  <span className="font-display text-slate-100 text-sm">{p.name}</span>
                </div>
                <div className="flex items-center gap-4 font-mono-stat text-xs text-slate-300/80">
                  <span className="text-amber-300">{p.wins} Siege</span>
                  <span>{p.games} Spiele</span>
                  <span>Ø {p.avg} Hitze</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {recent.length > 0 && (
          <>
            <h3 className="font-display text-amber-300 text-sm mt-4 mb-1">Polizeibericht (letzte Spiele weltweit)</h3>
            <div className="space-y-1">
              {recent.map((g, i) => (
                <div key={i} className="text-[12px] text-slate-300/70 flex justify-between rounded bg-black/20 px-2 py-1">
                  <span className="text-amber-200">{g.winners.join(", ")}</span>
                  <span>{g.players} Spieler · {g.rounds} Runden</span>
                </div>
              ))}
            </div>
          </>
        )}

        <button
          onClick={() => setStats(clearStats())}
          className="mt-4 flex items-center gap-1.5 text-xs text-slate-400/60 hover:text-red-300 transition-colors mx-auto"
          data-testid="btn-clear-stats"
        >
          <Trash2 size={13} /> Lokale Akte löschen
        </button>
      </DialogContent>
    </Dialog>
  );
}

function Stat({ icon, label, value }) {
  return (
    <div className="rounded-md bg-black/30 border border-amber-500/20 p-3 text-center">
      <div className="text-amber-400 grid place-items-center mb-1">{icon}</div>
      <div className="font-display text-xl text-amber-100">{value}</div>
      <div className="text-[11px] uppercase tracking-wider text-slate-300/60">{label}</div>
    </div>
  );
}
