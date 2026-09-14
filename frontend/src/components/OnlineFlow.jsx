import React, { useEffect, useState } from "react";
import { AVATARS } from "../game/constants";
import { Avatar } from "./Avatar";
import { OnlineTable } from "./OnlineTable";
import { roomApi } from "../game/api";
import { useOnlineGame } from "../game/useOnlineGame";
import { sfx } from "../game/sound";
import { Wifi, Plus, LogIn, ArrowLeft, Copy, Crown, Bot, Play, UserPlus, Loader, Eye, WifiOff } from "lucide-react";

const LS_KEY = "witches_room";

function setUrlRoom(code) {
  try {
    const u = new URL(window.location);
    if (code) u.searchParams.set("room", code);
    else u.searchParams.delete("room");
    window.history.replaceState({}, "", u);
  } catch {
    /* ignore */
  }
}

export function OnlineFlow({ initialCode, onExit, sound, setSound }) {
  const [session, setSession] = useState(null);
  const [resuming, setResuming] = useState(true);
  const online = useOnlineGame(session?.code, session?.token);

  useEffect(() => {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) {
      setResuming(false);
      return;
    }
    try {
      const s = JSON.parse(raw);
      roomApi
        .get(s.code, s.token)
        .then((v) => {
          const seated = v.yourSeat != null || s.spectator;
          if (seated && v.status !== "gameOver") {
            setSession(s);
            setUrlRoom(s.code);
          } else {
            localStorage.removeItem(LS_KEY);
          }
        })
        .catch(() => localStorage.removeItem(LS_KEY))
        .finally(() => setResuming(false));
    } catch {
      setResuming(false);
    }
  }, []);

  const beginSession = (s) => {
    setSession(s);
    localStorage.setItem(LS_KEY, JSON.stringify({ code: s.code, token: s.token, spectator: !!s.spectator }));
    setUrlRoom(s.code);
  };

  const leave = () => {
    localStorage.removeItem(LS_KEY);
    setUrlRoom(null);
    setSession(null);
    onExit();
  };

  if (resuming) {
    return (
      <div className="min-h-screen coven-bg grid place-items-center">
        <Loader className="animate-spin text-amber-400" size={32} />
      </div>
    );
  }

  if (!session) {
    return <CreateJoin initialCode={initialCode} onExit={onExit} onSession={beginSession} />;
  }

  if (!online.view) {
    return (
      <div className="min-h-screen coven-bg grid place-items-center">
        <Loader className="animate-spin text-amber-400" size={32} />
      </div>
    );
  }

  if (online.view.status === "lobby") {
    return <Lobby view={online.view} actions={online} onLeave={leave} />;
  }

  return <OnlineTable view={online.view} actions={online} onLeave={leave} sound={sound} setSound={setSound} />;
}

function CreateJoin({ initialCode, onExit, onSession }) {
  const [name, setName] = useState("");
  const [avatarIdx, setAvatarIdx] = useState(() => Math.floor(Math.random() * AVATARS.length));
  const [code, setCode] = useState(initialCode || "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const avatar = AVATARS[avatarIdx];
  const displayName = name.trim() || avatar.label;
  const invited = !!initialCode;

  const run = async (fn, okSfx) => {
    setBusy(true);
    setErr("");
    try {
      const s = await fn();
      okSfx();
      onSession(s);
    } catch (e) {
      setErr(e?.response?.data?.detail || "Das hat nicht geklappt. Versuch es noch einmal.");
    } finally {
      setBusy(false);
    }
  };

  const validCode = () => {
    if (code.trim().length < 4) {
      setErr("Gib einen gültigen Raum-Code ein.");
      return false;
    }
    return true;
  };

  const create = () => run(() => roomApi.create(displayName, avatar), sfx.fanfare);
  const join = () => validCode() && run(() => roomApi.join(code.trim().toUpperCase(), displayName, avatar), sfx.reveal);
  const watch = () => validCode() && run(() => roomApi.watch(code.trim().toUpperCase(), name.trim()), sfx.select);

  return (
    <div className="min-h-screen coven-bg relative">
      <div className="relative max-w-md mx-auto px-4 py-12">
        <button onClick={onExit} data-testid="btn-back-home" className="text-purple-200/70 hover:text-amber-300 text-sm flex items-center gap-1.5 mb-6 transition-colors">
          <ArrowLeft size={16} /> Zurück
        </button>

        <div className="text-center mb-6 rise-in">
          <Wifi size={30} className="text-amber-300 mx-auto mb-2" />
          <h1 className="font-display text-3xl gold-text">{invited ? "Einladung in die Unterwelt" : "Online spielen"}</h1>
          <p className="font-serif-fancy text-purple-200/70">
            {invited ? `Du wurdest zu Raum ${initialCode} eingeladen. Mitspielen oder zuschauen?` : "Eröffne einen Raum oder schließ dich einer Crew an."}
          </p>
        </div>

        <div className="panel rounded-2xl p-5 rise-in">
          <div className="flex items-center gap-3 mb-4">
            <button onClick={() => { setAvatarIdx((i) => (i + 1) % AVATARS.length); sfx.select(); }} data-testid="btn-cycle-avatar" title="Avatar wechseln">
              <Avatar avatar={avatar} size={48} active />
            </button>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={16} placeholder="Dein Straßenname" data-testid="input-online-name" className="flex-1 bg-black/40 border border-purple-500/25 focus:border-amber-400/60 rounded-lg px-3 py-2.5 text-purple-50 placeholder:text-purple-300/40 outline-none font-serif-fancy text-lg" />
          </div>

          {!invited && (
            <>
              <button onClick={create} disabled={busy} data-testid="btn-create-room" className="w-full rounded-xl py-3.5 font-display text-lg font-bold text-purple-950 bg-gradient-to-r from-amber-300 to-amber-500 glow-ring flex items-center justify-center gap-2 disabled:opacity-60">
                <Plus size={20} /> Raum eröffnen
              </button>

              <div className="flex items-center gap-3 my-4">
                <div className="flex-1 h-px bg-purple-500/20" />
                <span className="font-display text-xs text-purple-300/60 uppercase tracking-wider">oder beitreten</span>
                <div className="flex-1 h-px bg-purple-500/20" />
              </div>
            </>
          )}

          <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={6} placeholder="RAUM-CODE" data-testid="input-room-code" className="w-full bg-black/40 border border-purple-500/25 focus:border-amber-400/60 rounded-lg px-3 py-2.5 text-amber-200 placeholder:text-purple-300/40 outline-none font-mono-stat text-lg tracking-widest text-center uppercase" />
          <div className="grid grid-cols-2 gap-2 mt-2">
            <button onClick={join} disabled={busy} data-testid="btn-join-room" className={`rounded-lg py-3 font-display font-bold flex items-center justify-center gap-2 disabled:opacity-60 transition-colors ${invited ? "text-purple-950 bg-gradient-to-r from-amber-300 to-amber-500 glow-ring" : "text-amber-100 bg-black/40 border border-purple-500/30 hover:border-amber-400/50"}`}>
              <LogIn size={18} /> Mitspielen
            </button>
            <button onClick={watch} disabled={busy} data-testid="btn-watch-room" className="rounded-lg py-3 font-display font-bold text-purple-100 bg-black/40 border border-purple-500/30 hover:border-amber-400/50 transition-colors flex items-center justify-center gap-2 disabled:opacity-60">
              <Eye size={18} /> Zuschauen
            </button>
          </div>
          <p className="text-purple-300/50 text-[11px] mt-2 text-center">
            Rausgeflogen? Tritt mit demselben Namen wieder bei und du übernimmst deinen Platz.
          </p>

          {err && <p className="text-red-300 text-sm mt-3 text-center" data-testid="online-error">{err}</p>}
        </div>
      </div>
    </div>
  );
}

function Lobby({ view, actions, onLeave }) {
  const copyLink = () => {
    const url = `${window.location.origin}${window.location.pathname}?room=${view.code}`;
    navigator.clipboard?.writeText(url);
    sfx.select();
  };
  const n = view.players.length;
  const canStart = n >= 3 && n <= 6;

  return (
    <div className="min-h-screen coven-bg px-4 py-10">
      <div className="max-w-md mx-auto">
        <button onClick={onLeave} data-testid="btn-leave-room" className="text-purple-200/70 hover:text-amber-300 text-sm flex items-center gap-1.5 mb-6 transition-colors">
          <ArrowLeft size={16} /> Verlassen
        </button>

        <div className="text-center mb-6 rise-in">
          <h1 className="font-display text-3xl gold-text mb-2">Die Crew sammelt sich</h1>
          <p className="font-serif-fancy text-purple-200/70 mb-3">Teile diesen Code, damit Freunde beitreten können:</p>
          <button onClick={copyLink} data-testid="btn-copy-room-link" className="inline-flex items-center gap-2 font-mono-stat text-3xl tracking-[0.3em] gold-text bg-black/40 border border-amber-400/40 rounded-xl px-6 py-3 hover:border-amber-400 transition-colors">
            {view.code} <Copy size={18} className="text-amber-300" />
          </button>
          <p className="text-purple-300/50 text-xs mt-2">Tippe auf den Code, um den Einladungslink zu kopieren</p>
        </div>

        <div className="panel rounded-2xl p-4 rise-in">
          <div className="flex items-center justify-between mb-3">
            <span className="font-display text-amber-300 text-sm">Gangster ({n}/6)</span>
            {view.isHost && (
              <div className="flex gap-1.5">
                <button onClick={actions.addBot} disabled={n >= 6} data-testid="btn-add-bot" className="text-xs font-display rounded-lg px-3 py-1.5 bg-purple-500/15 border border-purple-400/50 text-purple-100 hover:bg-purple-500/25 transition-colors disabled:opacity-40 flex items-center gap-1">
                  <Bot size={14} /> Bot hinzufügen
                </button>
                <button onClick={actions.removeBot} data-testid="btn-remove-bot" className="text-xs font-display rounded-lg px-3 py-1.5 bg-black/30 border border-purple-500/25 text-purple-200 hover:border-purple-400/50 transition-colors">
                  Entfernen
                </button>
              </div>
            )}
          </div>

          <div className="space-y-2">
            {view.players.map((p) => (
              <div key={p.seat} data-testid={`lobby-player-${p.seat}`} className="flex items-center gap-3 rounded-lg bg-black/30 px-3 py-2 border border-purple-500/15">
                <Avatar avatar={p.avatar} size={36} />
                <span className="font-display text-purple-100 flex-1">{p.name}{p.seat === view.yourSeat && <span className="text-amber-300/80 text-xs ml-1">(du)</span>}</span>
                {p.isBot && <span className="text-[10px] font-display uppercase tracking-wider text-purple-300/70 flex items-center gap-1"><Bot size={12} /> KI</span>}
                {!p.isBot && !p.connected && <WifiOff size={13} className="text-red-400" title="Offline" data-testid={`lobby-player-offline-${p.seat}`} />}
                {p.seat === 0 && <Crown size={15} className="text-amber-400" />}
              </div>
            ))}
            {Array.from({ length: Math.max(0, 3 - n) }).map((_, i) => (
              <div key={`empty-${i}`} className="flex items-center gap-3 rounded-lg bg-black/20 px-3 py-2 border border-dashed border-purple-500/20 text-purple-300/40">
                <UserPlus size={20} /> <span className="font-serif-fancy italic">Warte auf einen Gangster…</span>
              </div>
            ))}
          </div>

          {view.spectators?.length > 0 && (
            <div className="mt-3 flex items-center gap-2 text-xs text-purple-300/70 font-serif-fancy" data-testid="lobby-spectators">
              <Eye size={13} className="text-amber-300" /> {view.spectators.length} Zuschauer: {view.spectators.join(", ")}
            </div>
          )}
        </div>

        <div className="mt-6">
          {view.isHost ? (
            <button onClick={actions.start} disabled={!canStart} data-testid="btn-start-online-game" className={`w-full rounded-xl py-4 font-display text-lg font-bold flex items-center justify-center gap-2 transition-all ${canStart ? "text-purple-950 bg-gradient-to-r from-amber-300 to-amber-500 glow-ring" : "text-purple-300/40 bg-black/30 border border-purple-500/20 cursor-not-allowed"}`}>
              <Play size={20} /> {canStart ? "Auf die Straße" : "Mindestens 3 Gangster nötig"}
            </button>
          ) : view.isSpectator ? (
            <p className="text-center font-serif-fancy text-purple-200/70 italic py-3 flex items-center justify-center gap-2" data-testid="spectator-lobby-note">
              <Eye size={16} className="text-amber-300" /> Du schaust zu. Warten, bis der Host startet…
            </p>
          ) : (
            <p className="text-center font-serif-fancy text-purple-200/70 italic py-3">Warten, bis der Host das Spiel startet…</p>
          )}
        </div>
      </div>
    </div>
  );
}
