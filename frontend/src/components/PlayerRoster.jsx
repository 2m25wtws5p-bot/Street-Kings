import React from "react";
import { ArrowRight, RotateCw, Check, Clock3, Eye, WifiOff, Bot } from "lucide-react";
import { Avatar } from "./Avatar";
import { PlayerIdentity } from "./PlayerIdentity";
import { HostCrown } from "./HostCrown";
import { ChatBubble } from "./ChatBubble";
import { useI18n } from "../i18n/I18nProvider";
import "./Roster.css";

// One roster owns identity, turn order and passing progress. Never repeat names
// in a second order/status strip, especially on a small phone screen.
export function PlayerRoster({
  players = [], scores = [], handCounts = [], currentSeat = null, winner = null,
  ownSeat = null, ownTurn = false, hostSeat = null, passing = false, passedSeats = [],
  chatMessages, online = false, onReplaceSeat, busy = false,
}) {
  const { t } = useI18n();
  return <div className="game-roster crew-roster" data-player-count={players.length}
    data-passing={passing ? "true" : undefined} role="list"
    aria-label={t(passing ? "roster.passingLabel" : "improvements.order.title")}>
    {players.map((player, index) => {
      const seat = player.seat ?? index;
      const active = seat === currentSeat;
      const won = seat === winner;
      const passed = !!passedSeats[seat];
      const offline = online && !player.isBot && !player.connected;
      const Arrow = index === players.length - 1 ? RotateCw : ArrowRight;
      const status = t(passed ? "game.ready" : "improvements.passing");
      const aria = `${t("improvements.order.seat", { seat: index + 1, name: player.name })}${active ? ` · ${t("improvements.order.current", { name: player.name })}` : ""}${passing ? ` · ${status}` : ""}`;
      return <div key={seat} className="crew-player" role="listitem" aria-label={aria}
        data-testid={`opponent-seat-player-${seat}`} data-order-seat={seat}
        data-current={active ? "true" : undefined} aria-current={active ? "step" : undefined}
        data-own-turn={ownTurn && seat === ownSeat ? "true" : undefined}
        data-winner={won ? "true" : undefined} data-offline={offline ? "true" : undefined}>
        <Avatar avatar={player.avatar} size={30} active={active} />
        <div className="crew-chat-identity">
          <PlayerIdentity name={player.name} heat={scores[seat]} cards={handCounts[seat]}>
            {seat === hostSeat && <HostCrown />}
            {seat === ownSeat && <span className="crew-own-label">{t("online.you")}</span>}
            {offline && <WifiOff size={11} className="crew-offline-icon" aria-label={t("online.offline")} data-testid={`player-offline-${seat}`} />}
            {player.reviewingLastTrick && <Eye size={12} className="crew-review-icon" aria-label={t("online.reviewing")} />}
            {!passing && <span className="crew-order-marker" title={t("roster.nextSeat", { name: players[(index + 1) % players.length]?.name })} aria-hidden="true">
              <b>{index + 1}</b><Arrow size={10} />
            </span>}
          </PlayerIdentity>
          {passing && <span className={`crew-pass-status ${passed ? "is-ready" : "is-waiting"}`}
            data-testid={`passing-status-${seat}`} data-ready={passed ? "true" : "false"}>
            {passed ? <Check size={10} aria-hidden="true" /> : <Clock3 size={10} aria-hidden="true" />}
            <span>{status}</span>
          </span>}
          {chatMessages && <ChatBubble messages={chatMessages} seat={seat} />}
        </div>
        {offline && onReplaceSeat && seat !== ownSeat && <button type="button" disabled={busy}
          onClick={() => onReplaceSeat(seat)} data-testid={`btn-replace-bot-${seat}`}
          title={t("online.replaceBot")} aria-label={t("online.replaceBot")} className="crew-replace-button">
          <Bot size={13} />
        </button>}
      </div>;
    })}
  </div>;
}
