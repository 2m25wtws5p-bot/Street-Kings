import React, { useEffect, useState } from "react";
import { HandCards } from "./HandCards";
import { SelectedCards } from "./SelectedCards";
import { PassingProgress } from "./PassingProgress";
import { PlayerRoster } from "./PlayerRoster";
import { targetSeat, dealCount } from "../game/engine";
import { Handshake } from "lucide-react";
import { sfx } from "../game/sound";
import { useI18n } from "../i18n/I18nProvider";

export function PassingScreen({ state, onConfirm, readOnly = false }) {
  const { t } = useI18n();
  const { passSeat, passCount, passDir, players, hands, n } = state;
  const target = players[targetSeat(passSeat, passDir, n)];
  const hand = hands[passSeat];
  const [draftSelected, setSelected] = useState([]);
  const selected = readOnly ? (state.pendingSelections?.[passSeat] || []) : draftSelected;
  useEffect(() => setSelected([]), [passSeat, state.roundIndex]);

  const toggle = (id) => {
    if (readOnly) return;
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= passCount) return prev;
      sfx.select();
      return [...prev, id];
    });
  };

  const done = selected.length === passCount;
  const passedSeats = players.map((_, seat) => Boolean(state.pendingSelections?.[seat]?.length));

  return (
    <div className="game-passing min-h-screen coven-bg flex flex-col px-3 py-5">
      <div className="roster-passing-header">
        <h2 className="font-display gold-text">{t("game.deal")}</h2>
        <PassingProgress players={players} passedSeats={passedSeats} />
      </div>
      <PlayerRoster players={players} scores={state.scores} handCounts={hands.map(cards => cards.length)}
        ownSeat={passSeat} passing passedSeats={passedSeats} />
      <p className="game-hand-instructions roster-pass-instruction" data-testid="passing-phase-instructions">
        {readOnly ? <span data-testid="waiting-indicator">{t("roster.passed", { name: target.name })}</span> : <>
          <span>{t("roster.choosePass", { count: passCount })} <strong data-testid="passing-recipient">{target.name}</strong></span>
          <span className="roster-pass-count" data-testid="passing-phase-selected-count">{selected.length}/{passCount}</span>
        </>}
      </p>

      <div className="game-hand-section flex-1 flex items-center justify-center">
        <HandCards cards={hand} initialCount={dealCount(n)} selectedIds={selected}
          onCardClick={readOnly ? undefined : card => toggle(card.id)} testIdPrefix="pass-card-item-"
          interactionKey={`passing-${state.roundIndex}-${passSeat}`} />
      </div>

      <div className="game-hand-actions flex flex-col items-center">
        <div inert={readOnly || undefined}><SelectedCards hand={hand} selected={selected} count={passCount} onRemove={toggle} /></div>
        <button
          disabled={!done || readOnly}
          onClick={() => {
            if (readOnly || !done) return;
            sfx.playCard();
            onConfirm(selected);
          }}
          data-testid="btn-confirm-card-pass"
          className="game-action-button"
        >
          <Handshake size={18} /> {t(readOnly ? "game.waiting" : "game.sealDeal")}
        </button>
      </div>
    </div>
  );
}

