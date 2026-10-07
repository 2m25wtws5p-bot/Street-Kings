import React, { useEffect, useRef, useState } from "react";
import { randomAvatarIndex } from "../game/constants";
import { useI18n } from "../i18n/I18nProvider";
import { useGameLabels } from "../i18n/gameLabels";
import { LanguageSelector } from "./LanguageSelector";
import { Avatar } from "./Avatar";
import { OnlineTable } from "./OnlineTable";
import { ChatPanel } from "./ChatPanel";
import { ChatBubble } from "./ChatBubble";
import { HostCrown } from "./HostCrown";
import { hostSeat } from "../game/chat";
import { copyText, invitationLink } from "../game/clipboard";
import { roomApi, onlineErrorMessage } from "../game/api";
import { useOnlineGame } from "../game/useOnlineGame";
import { sfx } from "../game/sound";
import { loadRoomSession, saveRoomSession, clearRoomSession } from "../game/storage";
import { Wifi, Plus, LogIn, ArrowLeft, Copy, Link, Bot, Play, UserPlus, Loader, Eye, WifiOff } from "lucide-react";

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
  const { t } = useI18n();
  const [session, setSession] = useState(null);
  const [resuming, setResuming] = useState(true);
  const online = useOnlineGame(session?.code, session?.token);

  useEffect(() => {
    const s = loadRoomSession();
    // An invitation to another room must not silently reopen the previous one.
    if (!s || (initialCode && initialCode.toUpperCase() !== s.code)) {
      setResuming(false);
      return;
    }
    let active = true;
    const controller = new AbortController();
      roomApi
        .get(s.code, s.token, { signal: controller.signal })
        .then((v) => {
          if (!active) return;
          const seated = v.yourSeat != null || (v.isSpectator && s.spectator);
          if (seated) {
            setSession(s);
            setUrlRoom(s.code);
          } else {
            clearRoomSession();
          }
        })
        .catch((error) => {
          if (!active) return;
          if ([403, 404].includes(error?.response?.status)) {
            clearRoomSession();
          } else {
            // Keep the reconnect token during temporary server/network failures.
            setSession(s);
            setUrlRoom(s.code);
          }
        })
        .finally(() => { if (active) setResuming(false); });
    return () => { active = false; controller.abort(); };
  }, [initialCode]);

  const beginSession = (s) => {
    setSession(s);
    saveRoomSession(s);
    setUrlRoom(s.code);
  };

  const leave = () => {
    clearRoomSession();
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
    return <CreateJoin initialCode={initialCode} onExit={() => { setUrlRoom(null); onExit(); }} onSession={beginSession} />;
  }

  if (!online.view && online.error) {
    return (
      <div className="min-h-screen coven-bg grid place-items-center px-4">
        <div className="panel rounded-lg p-5 max-w-md text-center">
          <p role="alert" className="text-red-300 mb-4">{online.error}</p>
          <button onClick={leave} className="text-amber-300">{t("online.home")}</button>
        </div>
      </div>
    );
  }

  if (!online.view) {
    return (
      <div className="min-h-screen coven-bg grid place-items-center">
        <Loader className="animate-spin text-amber-400" size={32} />
      </div>
    );
  }

  // A transient failure must not unmount the table and erase a selected deal.
  return <>
    {online.view.status === "lobby"
      ? <Lobby view={online.view} actions={online} onLeave={leave} />
      : <OnlineTable view={online.view} actions={online} onLeave={leave} sound={sound} setSound={setSound} />}
    {(online.error || online.actionError) && <div role="alert" data-testid="online-action-error" className="fixed bottom-3 inset-x-3 z-50 mx-auto max-w-md panel rounded-lg p-3 text-sm">
      <p className="text-red-300">{online.error || online.actionError}</p>
      {online.error ? <p className="text-slate-300 mt-1">{t("online.retrying")}</p>
        : <button type="button" onClick={online.dismissActionError} className="text-amber-300 mt-1">{t("online.close")}</button>}
    </div>}
  </>;
}

function CreateJoin({ initialCode, onExit, onSession }) {
  const { t } = useI18n();
  const { avatars } = useGameLabels();
  const [name, setName] = useState("");
  const [avatarIdx, setAvatarIdx] = useState(() => Math.floor(Math.random() * avatars.length));
  const [code, setCode] = useState(initialCode || "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const busyRef = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  const avatar = avatars[avatarIdx];
  const displayName = name.trim() || avatar.label;
  const invited = !!initialCode;

  const run = async (fn, okSfx) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setErr("");
    try {
      const s = await fn();
      if (!mounted.current) return;
      okSfx();
      onSession(s);
    } catch (e) {
      if (mounted.current) setErr(e);
    } finally {
      busyRef.current = false;
      if (mounted.current) setBusy(false);
    }
  };

  const validCode = () => {
    if (!/^[A-Z0-9]{4,6}$/.test(code.trim().toUpperCase())) {
      setErr({ translationKey: "online.invalidCode" });
      return false;
    }
    return true;
  };

  const create = () => run(() => roomApi.create(displayName, avatar), sfx.fanfare);
  const join = () => validCode() && run(() => roomApi.join(code.trim().toUpperCase(), displayName, avatar), sfx.reveal);
  const watch = () => validCode() && run(() => roomApi.watch(code.trim().toUpperCase(), name.trim() || t('online.defaultSpectator')), sfx.select);

  return (
    <div className="min-h-screen coven-bg relative">
      <div className="relative max-w-md mx-auto px-4 py-12">
        <button onClick={onExit} data-testid="btn-back-home" className="text-slate-300/70 hover:text-amber-300 text-sm flex items-center gap-1.5 mb-6 transition-colors">
          <ArrowLeft size={16} /> {t("online.back")}
        </button>

        <div className="text-center mb-6 rise-in">
          <Wifi size={30} className="text-amber-300 mx-auto mb-2" />
          <h1 className="font-display text-3xl gold-text">{t(invited ? "online.invitation" : "online.play")}</h1>
          <p className="font-serif-fancy text-slate-300/70">
            {invited ? t("online.invited", { code: initialCode }) : t("online.intro")}
          </p>
        </div>

        <div className="panel rounded-lg p-5 rise-in">
          <LanguageSelector testId="online-language-select" />
          <div className="flex items-center gap-3 mb-4">
            <button onClick={() => { const chosen = randomAvatarIndex(avatarIdx); setAvatarIdx(chosen); sfx.select(); }} data-testid="btn-cycle-avatar" title={t("online.randomAvatar")} aria-label={t("online.randomAvatar")}>
              <Avatar avatar={avatar} size={48} active />
            </button>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={24} placeholder={t("online.name")} aria-label={t("online.name")} data-testid="input-online-name" className="flex-1 min-w-0 bg-black/40 border border-white/10 focus:border-amber-400/60 rounded-lg px-3 py-2.5 text-slate-50 placeholder:text-slate-400/40 outline-none font-serif-fancy text-lg" />
          </div>

          <p className="text-slate-300/70 text-xs -mt-2 mb-4">{t("online.avatarHint")}</p>

          {!invited && (
            <>
              <button onClick={create} disabled={busy} data-testid="btn-create-room" className="w-full rounded-md py-3.5 font-display text-lg font-bold text-black bg-gradient-to-r from-yellow-300 to-amber-400 glow-ring flex items-center justify-center gap-2 disabled:opacity-60">
                <Plus size={20} /> {t("online.create")}
              </button>

              <div className="flex items-center gap-3 my-4">
                <div className="flex-1 h-px bg-white/10" />
                <span className="font-display text-xs text-slate-400/60 uppercase tracking-wider">{t("online.orJoin")}</span>
                <div className="flex-1 h-px bg-white/10" />
              </div>
            </>
          )}

          <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={6} placeholder={t("online.code")} aria-label={t("online.code")} data-testid="input-room-code" className="w-full bg-black/40 border border-white/10 focus:border-amber-400/60 rounded-lg px-3 py-2.5 text-amber-200 placeholder:text-slate-400/40 outline-none font-mono-stat text-lg tracking-widest text-center uppercase" />
          <div className="grid grid-cols-2 gap-2 mt-2">
            <button onClick={join} disabled={busy} data-testid="btn-join-room" className={`rounded-lg py-3 font-display font-bold flex items-center justify-center gap-2 disabled:opacity-60 transition-colors ${invited ? "text-black bg-gradient-to-r from-yellow-300 to-amber-400 glow-ring" : "text-amber-100 bg-black/40 border border-white/15 hover:border-amber-400/50"}`}>
              <LogIn size={18} /> {t("online.join")}
            </button>
            <button onClick={watch} disabled={busy} data-testid="btn-watch-room" className="rounded-lg py-3 font-display font-bold text-slate-100 bg-black/40 border border-white/15 hover:border-amber-400/50 transition-colors flex items-center justify-center gap-2 disabled:opacity-60">
              <Eye size={18} /> {t("online.watch")}
            </button>
          </div>
          <p className="text-slate-400/50 text-[11px] mt-2 text-center">
            {t("online.recovery")}
          </p>

          {err && <p className="text-red-300 text-sm mt-3 text-center" data-testid="online-error">{onlineErrorMessage(err, t)}</p>}
        </div>
      </div>
    </div>
  );
}

function Lobby({ view, actions, onLeave }) {
  const { t } = useI18n();
  const [copyMessage, setCopyMessage] = useState("");
  useEffect(() => {
    if (!copyMessage) return;
    const timer = setTimeout(() => setCopyMessage(""), 3000);
    return () => clearTimeout(timer);
  }, [copyMessage]);
  const copyRoom = async (link = false) => {
    const copied = await copyText(link ? invitationLink(view.code) : view.code);
    setCopyMessage(copied ? (link ? "online.copiedLink" : "online.copiedCode") : "online.copyBlocked");
    if (copied) sfx.select();
  };
  const n = view.players.length;
  const canStart = n >= 3 && n <= 6;

  return (
    <div className="min-h-screen coven-bg px-4 py-10">
      <div className="max-w-md mx-auto">
        <button onClick={onLeave} data-testid="btn-leave-room" className="text-slate-300/70 hover:text-amber-300 text-sm flex items-center gap-1.5 mb-6 transition-colors">
          <ArrowLeft size={16} /> {t("online.leave")}
        </button>

        <div className="text-center mb-6 rise-in">
          <h1 className="font-display text-3xl gold-text mb-2">{t("online.lobbyTitle")}</h1>
          <p className="font-serif-fancy text-slate-300/70 mb-3">{t("online.shareCode")}</p>
          <button onClick={() => copyRoom()} data-testid="btn-copy-room-code" aria-label={t("online.copyCode", { code: view.code })} className="inline-flex items-center gap-2 font-mono-stat text-3xl tracking-[0.3em] gold-text bg-black/40 border border-amber-400/40 rounded-md px-6 py-3 hover:border-amber-400 transition-colors">
            {view.code} <Copy size={18} className="text-amber-300" />
          </button>
          <p className="text-slate-400/50 text-xs mt-2">{t("online.copyHint")}</p>
          <button type="button" onClick={() => copyRoom(true)} data-testid="btn-copy-room-link" className="room-invite-link-button"><Link size={13} aria-hidden="true" /> {t("online.copyLink")}</button>
          <p role="status" className="room-copy-feedback" data-testid="room-copy-status">{copyMessage && t(copyMessage, { code: view.code })}</p>
        </div>

        <div className="panel rounded-lg p-4 rise-in">
          <div className="flex items-center justify-between mb-3">
            <span className="font-display text-amber-300 text-sm">{t("online.crewCount", { count: n })}</span>
            {view.isHost && (
              <div className="flex gap-1.5">
                <button onClick={actions.addBot} disabled={n >= 6 || actions.busy} data-testid="btn-add-bot" className="text-xs font-display rounded-lg px-3 py-1.5 bg-white/5 border border-slate-400/60 text-slate-100 hover:bg-white/10 transition-colors disabled:opacity-40 flex items-center gap-1">
                  <Bot size={14} /> {t("online.addBot")}
                </button>
                <button onClick={actions.removeBot} disabled={actions.busy || !view.players.some(player => player.isBot)} data-testid="btn-remove-bot" className="text-xs font-display rounded-lg px-3 py-1.5 bg-black/30 border border-white/10 text-slate-300 hover:border-slate-400/60 transition-colors disabled:opacity-40">
                  {t("online.removeBot")}
                </button>
              </div>
            )}
          </div>

          <div className="space-y-2">
            {view.players.map((p) => (
              <div key={p.seat} data-testid={`lobby-player-${p.seat}`} className="flex items-center gap-3 rounded-lg bg-black/30 px-3 py-2 border border-white/10">
                <Avatar avatar={p.avatar} size={36} />
                <div className="lobby-player-identity">
                  <span className="lobby-player-name font-display text-slate-100"><span title={p.name}>{p.name}</span>{p.seat === hostSeat(view) && <HostCrown />}{p.seat === view.yourSeat && <span className="text-amber-300/80 text-xs ml-1">{t("online.you")}</span>}</span>
                  <ChatBubble messages={view.chatMessages} seat={p.seat} />
                </div>
                {p.isBot && <span className="text-[10px] font-display uppercase tracking-wider text-slate-400/70 flex items-center gap-1"><Bot size={12} /> {t("online.ai")}</span>}
                {!p.isBot && !p.connected && <WifiOff size={13} className="text-red-400" aria-label={t("online.offline")} data-testid={`lobby-player-offline-${p.seat}`} />}
              </div>
            ))}
            {Array.from({ length: Math.max(0, 3 - n) }).map((_, i) => (
              <div key={`empty-${i}`} className="flex items-center gap-3 rounded-lg bg-black/20 px-3 py-2 border border-dashed border-white/10 text-slate-400/40">
                <UserPlus size={20} /> <span className="font-serif-fancy italic">{t("online.waitPlayer")}</span>
              </div>
            ))}
          </div>

          {view.spectators?.length > 0 && (
            <div className="mt-3 flex items-center gap-2 text-xs text-slate-400/70 font-serif-fancy" data-testid="lobby-spectators">
              <Eye size={13} className="text-amber-300" /> {t("online.spectators", { count: view.spectators.length, names: view.spectators.join(", ") })}
            </div>
          )}
        </div>

        <div className="mt-6">
          {view.isHost ? (
            <button onClick={actions.start} disabled={!canStart || actions.busy} data-testid="btn-start-online-game" className={`w-full rounded-md py-4 font-display text-lg font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-60 ${canStart ? "text-black bg-gradient-to-r from-yellow-300 to-amber-400 glow-ring" : "text-slate-400/40 bg-black/30 border border-white/10 cursor-not-allowed"}`}>
              <Play size={20} /> {t(canStart ? "online.start" : "online.minimumPlayers")}
            </button>
          ) : view.isSpectator ? (
            <p className="text-center font-serif-fancy text-slate-300/70 italic py-3 flex items-center justify-center gap-2" data-testid="spectator-lobby-note">
              <Eye size={16} className="text-amber-300" /> {t("online.spectatorWait")}
            </p>
          ) : (
            <p className="text-center font-serif-fancy text-slate-300/70 italic py-3">{t("online.waitHost")}</p>
          )}
        </div>
        <ChatPanel view={view} actions={actions} />
      </div>
    </div>
  );
}
