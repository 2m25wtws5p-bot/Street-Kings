import React, { useEffect, useState } from "react";
import { AVATARS } from "../game/constants";
import { HERO_BG } from "../game/assets";
import { Avatar } from "./Avatar";
import { OnlineTable } from "./OnlineTable";
import { roomApi } from "../game/api";
import { useOnlineGame } from "../game/useOnlineGame";
import { sfx } from "../game/sound";
import { Wifi, Plus, LogIn, ArrowLeft, Copy, Crown, Bot, Play, UserPlus, Loader } from "lucide-react";

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
          if (v.yourSeat != null && v.status !== "gameOver") {
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
    localStorage.setItem(LS_KEY, JSON.stringify({ code: s.code, token: s.token }));
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

  const create = async () => {
    setBusy(true);
    setErr("");
    try {
      const s = await roomApi.create(displayName, avatar);
      sfx.fanfare();
      onSession(s);
    } catch (e) {
      setErr("Could not create room. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const join = async () => {
    if (code.trim().length < 4) {
      setErr("Enter a valid room code.");
      return;
    }
    setBusy(true);
    setErr("");
    try {
      const s = await roomApi.join(code.trim().toUpperCase(), displayName, avatar);
      sfx.reveal();
      onSession(s);
    } catch (e) {
      setErr(e?.response?.data?.detail || "Could not join room.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen coven-bg relative">
      <div className="absolute inset-0 opacity-20" style={{ backgroundImage: `url(${HERO_BG})`, backgroundSize: "cover", backgroundPosition: "center", maskImage: "linear-gradient(to bottom, black, transparent 75%)" }} />
      <div className="relative max-w-md mx-auto px-4 py-12">
        <button onClick={onExit} data-testid="btn-back-home" className="text-purple-200/70 hover:text-amber-300 text-sm flex items-center gap-1.5 mb-6 transition-colors">
          <ArrowLeft size={16} /> Back
        </button>

        <div className="text-center mb-6 rise-in">
          <Wifi size={30} className="text-amber-300 mx-auto mb-2" />
          <h1 className="font-display text-3xl gold-text">Play Online</h1>
          <p className="font-serif-fancy text-purple-200/70">Conjure a room or join a friend's coven.</p>
        </div>

        <div className="panel rounded-2xl p-5 rise-in">
          <div className="flex items-center gap-3 mb-4">
            <button onClick={() => { setAvatarIdx((i) => (i + 1) % AVATARS.length); sfx.select(); }} data-testid="btn-cycle-avatar" title="Change avatar">
              <Avatar avatar={avatar} size={48} active />
            </button>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={16} placeholder="Your witch name" data-testid="input-online-name" className="flex-1 bg-black/40 border border-purple-500/25 focus:border-amber-400/60 rounded-lg px-3 py-2.5 text-purple-50 placeholder:text-purple-300/40 outline-none font-serif-fancy text-lg" />
          </div>

          <button onClick={create} disabled={busy} data-testid="btn-create-room" className="w-full rounded-xl py-3.5 font-display text-lg font-bold text-purple-950 bg-gradient-to-r from-amber-300 to-amber-500 glow-ring flex items-center justify-center gap-2 disabled:opacity-60">
            <Plus size={20} /> Create a Room
          </button>

          <div className="flex items-center gap-3 my-4">
            <div className="flex-1 h-px bg-purple-500/20" />
            <span className="font-display text-xs text-purple-300/60 uppercase tracking-wider">or join</span>
            <div className="flex-1 h-px bg-purple-500/20" />
          </div>

          <div className="flex gap-2">
            <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={6} placeholder="ROOM CODE" data-testid="input-room-code" className="flex-1 bg-black/40 border border-purple-500/25 focus:border-amber-400/60 rounded-lg px-3 py-2.5 text-amber-200 placeholder:text-purple-300/40 outline-none font-mono-stat text-lg tracking-widest text-center uppercase" />
            <button onClick={join} disabled={busy} data-testid="btn-join-room" className="rounded-lg px-5 font-display font-bold text-amber-100 bg-black/40 border border-purple-500/30 hover:border-amber-400/50 transition-colors flex items-center gap-2 disabled:opacity-60">
              <LogIn size={18} /> Join
            </button>
          </div>

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
          <ArrowLeft size={16} /> Leave
        </button>

        <div className="text-center mb-6 rise-in">
          <h1 className="font-display text-3xl gold-text mb-2">The Coven Gathers</h1>
          <p className="font-serif-fancy text-purple-200/70 mb-3">Share this code so friends can join:</p>
          <button onClick={copyLink} data-testid="btn-copy-room-link" className="inline-flex items-center gap-2 font-mono-stat text-3xl tracking-[0.3em] gold-text bg-black/40 border border-amber-400/40 rounded-xl px-6 py-3 hover:border-amber-400 transition-colors">
            {view.code} <Copy size={18} className="text-amber-300" />
          </button>
          <p className="text-purple-300/50 text-xs mt-2">Tap the code to copy an invite link</p>
        </div>

        <div className="panel rounded-2xl p-4 rise-in">
          <div className="flex items-center justify-between mb-3">
            <span className="font-display text-amber-300 text-sm">Witches ({n}/6)</span>
            {view.isHost && (
              <div className="flex gap-1.5">
                <button onClick={actions.addBot} disabled={n >= 6} data-testid="btn-add-bot" className="text-xs font-display rounded-lg px-3 py-1.5 bg-purple-500/15 border border-purple-400/50 text-purple-100 hover:bg-purple-500/25 transition-colors disabled:opacity-40 flex items-center gap-1">
                  <Bot size={14} /> Add Bot
                </button>
                <button onClick={actions.removeBot} data-testid="btn-remove-bot" className="text-xs font-display rounded-lg px-3 py-1.5 bg-black/30 border border-purple-500/25 text-purple-200 hover:border-purple-400/50 transition-colors">
                  Remove
                </button>
              </div>
            )}
          </div>

          <div className="space-y-2">
            {view.players.map((p) => (
              <div key={p.seat} data-testid={`lobby-player-${p.seat}`} className="flex items-center gap-3 rounded-lg bg-black/30 px-3 py-2 border border-purple-500/15">
                <Avatar avatar={p.avatar} size={36} />
                <span className="font-display text-purple-100 flex-1">{p.name}{p.seat === view.yourSeat && <span className="text-amber-300/80 text-xs ml-1">(you)</span>}</span>
                {p.isBot && <span className="text-[10px] font-display uppercase tracking-wider text-purple-300/70 flex items-center gap-1"><Bot size={12} /> AI</span>}
                {p.seat === 0 && <Crown size={15} className="text-amber-400" />}
              </div>
            ))}
            {Array.from({ length: Math.max(0, 3 - n) }).map((_, i) => (
              <div key={`empty-${i}`} className="flex items-center gap-3 rounded-lg bg-black/20 px-3 py-2 border border-dashed border-purple-500/20 text-purple-300/40">
                <UserPlus size={20} /> <span className="font-serif-fancy italic">Waiting for a witch…</span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6">
          {view.isHost ? (
            <button onClick={actions.start} disabled={!canStart} data-testid="btn-start-online-game" className={`w-full rounded-xl py-4 font-display text-lg font-bold flex items-center justify-center gap-2 transition-all ${canStart ? "text-purple-950 bg-gradient-to-r from-amber-300 to-amber-500 glow-ring" : "text-purple-300/40 bg-black/30 border border-purple-500/20 cursor-not-allowed"}`}>
              <Play size={20} /> {canStart ? "Begin the Ritual" : "Need at least 3 witches"}
            </button>
          ) : (
            <p className="text-center font-serif-fancy text-purple-200/70 italic py-3">Waiting for the host to begin the ritual…</p>
          )}
        </div>
      </div>
    </div>
  );
}
