import React, { useEffect, useRef, useState } from "react";
import { MessageCircle, Send, X } from "lucide-react";
import { CHAT_EMOJIS, CHAT_LIMIT, chatLength, limitChatText } from "../game/chat";

export function ChatPanel({ view, actions, inline = false }) {
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
    <button type="button" onClick={() => setOpen(true)} className={`chat-toggle-button${inline ? " chat-toggle-inline" : ""}`} data-testid="btn-chat" aria-label="Raum-Chat öffnen" title="Raum-Chat öffnen" aria-haspopup="dialog" aria-expanded={open}>
      <MessageCircle size={17} aria-hidden="true" /><span>Chat</span>
    </button>
    <dialog ref={dialog} className="chat-dialog" aria-labelledby="room-chat-title" onCancel={() => setOpen(false)} onClose={() => setOpen(false)} onClick={(event) => { if (event.target === dialog.current) setOpen(false); }} data-testid="chat-dialog">
      <div className="chat-heading">
        <h2 id="room-chat-title" className="font-display">Crew-Chat <span className="chat-room-code">{view.code}</span></h2>
        <button type="button" autoFocus onClick={() => setOpen(false)} aria-label="Chat schließen" className="chat-close-button"><X size={18} /></button>
      </div>
      <div ref={transcript} className="chat-transcript" role="log" aria-label="Letzte Chatnachrichten" aria-live={open ? "polite" : "off"} aria-relevant="additions text" data-testid="chat-transcript">
        {messages.length ? messages.map(message => <div key={message.id} className={`chat-message ${message.seat === view.yourSeat ? "chat-message-own" : ""}`} data-testid={`chat-message-${message.id}`}>
          <div className="chat-message-meta"><span>{message.name}{message.seat === view.yourSeat ? " (du)" : ""}</span><time dateTime={new Date(message.createdAt).toISOString()}>{new Date(message.createdAt).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}</time></div>
          <p>{message.text}</p>
        </div>) : <p className="chat-empty">Noch ruhig im Hinterzimmer. Sag deiner Crew Hallo!</p>}
      </div>
      {canSend ? <>
        <div className="chat-quick-emojis" aria-label="Schnelle Emoji-Nachricht">
          {CHAT_EMOJIS.map(emoji => <button key={emoji} type="button" onClick={() => submit(emoji)} disabled={actions.chatBusy} aria-label={`${emoji} senden`} data-testid={`chat-emoji-${emoji}`}>{emoji}</button>)}
        </div>
        <form className="chat-compose" onSubmit={(event) => { event.preventDefault(); submit(text); }}>
          <label htmlFor="room-chat-text" className="sr-only">Nachricht an die Crew</label>
          <textarea id="room-chat-text" value={text} onChange={(event) => setText(limitChatText(event.target.value))} maxLength={CHAT_LIMIT * 2} placeholder="Nachricht an die Crew…" rows={2} data-testid="input-chat-message" aria-describedby="chat-character-count" onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); submit(text); } }} />
          <div className="chat-compose-footer"><span id="chat-character-count">{count}/{CHAT_LIMIT}</span><button type="submit" disabled={actions.chatBusy || !text.trim()} data-testid="btn-send-chat"><Send size={14} aria-hidden="true" />{actions.chatBusy ? "Sendet…" : "Senden"}</button></div>
        </form>
      </> : <p className="chat-spectator-note" data-testid="chat-spectator-note">Du schaust zu und kannst den Crew-Chat mitlesen.</p>}
      {actions.chatError && <p className="chat-error" role="alert" data-testid="chat-error">{actions.chatError}</p>}
      <p className="chat-retention-note">Die letzten 30 Nachrichten aus diesem Raum.</p>
    </dialog>
  </>;
}
