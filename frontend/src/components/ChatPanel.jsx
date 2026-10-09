import React, { useEffect, useRef, useState } from "react";
import { MessageCircle, Send, X, Volume2 } from "lucide-react";
import { CHAT_EMOJIS, CHAT_LIMIT, CHAT_SOUNDS, isChatSound, chatLength, limitChatText } from "../game/chat";
import { useI18n } from "../i18n/I18nProvider";
import { sfx, unlockSound } from "../game/sound";
import "./TableImprovements.css";

export function ChatPanel({ view, actions, inline = false }) {
  const { t, locale } = useI18n();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const dialog = useRef(null);
  const transcript = useRef(null);
  const messages = view.chatMessages || [];
  const lastMessageId = messages[messages.length - 1]?.id;
  const canSend = !view.isSpectator && view.yourSeat != null && !view.players.find(player => player.seat === view.yourSeat)?.isBot;
  const count = chatLength(text);

  useEffect(() => {
    setOpen(false); setText("");
  }, [view.code, view.yourSeat]);
  useEffect(() => {
    const element = dialog.current;
    if (open && element && !element.open) element.showModal();
    if (!open && element?.open) element.close();
  }, [open]);
  useEffect(() => {
    if (open && transcript.current) transcript.current.scrollTop = transcript.current.scrollHeight;
  }, [open, messages.length, lastMessageId]);

  const submit = async (message) => {
    if (!canSend || actions.chatBusy || !message.trim()) return;
    const sent = await actions.sendChat(message.trim());
    if (sent) setText(current => current === message ? "" : current);
  };

  return <>
    <button type="button" onClick={() => setOpen(true)} className={`chat-toggle-button${inline ? " chat-toggle-inline" : ""}`} data-testid="btn-chat" aria-label={t("chat.open")} title={t("chat.open")} aria-haspopup="dialog" aria-expanded={open}>
      <MessageCircle size={17} aria-hidden="true" /><span>{t("chat.label")}</span>
    </button>
    <dialog ref={dialog} className="chat-dialog" aria-labelledby="room-chat-title" onCancel={() => setOpen(false)} onClose={() => setOpen(false)} onClick={(event) => { if (event.target === dialog.current) setOpen(false); }} data-testid="chat-dialog">
      <div className="chat-heading">
        <h2 id="room-chat-title" className="font-display">{t("chat.title")} <span className="chat-room-code">{view.code}</span></h2>
        <button type="button" autoFocus onClick={() => setOpen(false)} aria-label={t("chat.close")} className="chat-close-button"><X size={18} /></button>
      </div>
      <div ref={transcript} className="chat-transcript" role="log" aria-label={t("chat.recent")} aria-live={open ? "polite" : "off"} aria-relevant="additions text" data-testid="chat-transcript">
        {messages.length ? messages.map(message => <div key={message.id} className={`chat-message ${message.seat === view.yourSeat ? "chat-message-own" : ""}`} data-testid={`chat-message-${message.id}`}>
          <div className="chat-message-meta"><span>{message.name}{message.seat === view.yourSeat ? t("chat.you") : ""}</span><time dateTime={new Date(message.createdAt).toISOString()}>{new Date(message.createdAt).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })}</time></div>
          {isChatSound(message.sound) ? <button type="button" className="chat-replay-sound" data-testid={`chat-replay-${message.id}`} onClick={() => { unlockSound(); sfx.chatSound(message.sound); }} aria-label={t("improvements.replaySound", { sound: t(`chat.sound.${message.sound}`) })}><Volume2 size={15} />{t(`chat.sound.${message.sound}`)}</button> : <p>{message.text}</p>}
        </div>) : <p className="chat-empty">{t("chat.empty")}</p>}
      </div>
      {canSend ? <>
        <div className="chat-sound-choices" aria-label={t("improvements.chatSounds")}>
          {CHAT_SOUNDS.map(sound => <button type="button" key={sound.id} disabled={actions.chatBusy} data-testid={`chat-sound-${sound.id}`} onClick={() => { unlockSound(); actions.sendChatSound(sound.id); }}><Volume2 size={14} />{t(sound.labelKey)}</button>)}
        </div>
        <p className="chat-sound-note">{t("improvements.soundNote")}</p>
        <div className="chat-quick-emojis" aria-label={t("chat.quick")}>
          {CHAT_EMOJIS.map(emoji => <button key={emoji} type="button" onClick={() => submit(emoji)} disabled={actions.chatBusy} aria-label={t("chat.sendEmoji", { emoji })} data-testid={`chat-emoji-${emoji}`}>{emoji}</button>)}
        </div>
        <form className="chat-compose" onSubmit={(event) => { event.preventDefault(); submit(text); }}>
          <label htmlFor="room-chat-text" className="sr-only">{t("chat.message")}</label>
          <textarea id="room-chat-text" value={text} onChange={(event) => setText(limitChatText(event.target.value))} maxLength={CHAT_LIMIT * 2} placeholder={t("chat.placeholder")} rows={2} data-testid="input-chat-message" aria-describedby="chat-character-count" onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); submit(text); } }} />
          <div className="chat-compose-footer"><span id="chat-character-count">{count}/{CHAT_LIMIT}</span><button type="submit" disabled={actions.chatBusy || !text.trim()} data-testid="btn-send-chat"><Send size={14} aria-hidden="true" />{t(actions.chatBusy ? "chat.sending" : "chat.send")}</button></div>
        </form>
      </> : <p className="chat-spectator-note" data-testid="chat-spectator-note">{t("chat.spectator")}</p>}
      {actions.chatError && <p className="chat-error" role="alert" data-testid="chat-error">{actions.chatError}</p>}
      <p className="chat-retention-note">{t("chat.retention")}</p>
    </dialog>
  </>;
}
