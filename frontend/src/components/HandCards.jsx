import React, { useEffect, useMemo, useRef, useState } from "react";
import { CardView } from "./CardView";
import { useHandLayout } from "../game/useHandLayout";
import { handRowCounts, handRowGeometry } from "../game/handLayout";
import { canDropHandCard, handReorderTarget, moveHandCard, readHandPreferences, reconcileManualHand, saveHandPreferences, sortHand } from "../game/handPreferences";
import { useI18n } from "../i18n/I18nProvider";
import { useGameLabels } from "../i18n/gameLabels";
import "./HandCards.css";

function storage() {
  try { return window.localStorage; } catch { return null; }
}
const asSet = value => value instanceof Set ? value : new Set(value || []);

export function HandCards({ cards, initialCount, selectedIds = [], legalIds = [], dimIds = [], faceDown = false,
  onCardClick, onCardDrop, canDrag = false, canArrange = true, handScopeKey, interactionKey,
  testIdPrefix = "hand-card-item-", receivedIds = [], showSort = true }) {
  const { t } = useI18n();
  const { specials } = useGameLabels();
  const layout = useHandLayout(initialCount);
  const [preferences, setPreferences] = useState(() => readHandPreferences(storage()));
  const [drag, setDrag] = useState(null);
  const [manualOrders, setManualOrders] = useState({});
  const [arrangingScope, setArrangingScope] = useState(null);
  const [pickedCard, setPickedCard] = useState(null);
  const [reorderMessage, setReorderMessage] = useState(null);
  const shell = useRef(null);
  const focusCard = useRef(null);
  const pointer = useRef(null);
  const suppressClick = useRef(null);
  const selected = asSet(selectedIds);
  const legal = asSet(legalIds);
  const dimmed = asSet(dimIds);
  const received = asSet(receivedIds);
  const detailCard = [...selected].map(id => cards.find(card => card.id === id)).filter(card => card?.special).at(-1);
  const orderScope = JSON.stringify([handScopeKey ?? testIdPrefix, preferences.seed]);
  const arrangeAvailable = preferences.mode === "chaos" && showSort && canArrange && !faceDown;
  const arranging = arrangeAvailable && arrangingScope === orderScope;
  const sorted = useMemo(() => preferences.mode === "chaos"
    ? reconcileManualHand(cards, manualOrders[orderScope], preferences)
    : sortHand(cards, preferences), [cards, preferences, manualOrders, orderScope]);
  let offset = 0;
  const rows = handRowCounts(sorted.length).map(count => {
    const row = sorted.slice(offset, offset + count);
    offset += count;
    return row;
  });

  const clearDropCue = () => {
    document.querySelectorAll("[data-card-drop-zone]").forEach(node => node.removeAttribute("data-drag-over"));
  };
  useEffect(() => {
    // A turn/phase change cancels an in-flight gesture before it can submit.
    pointer.current = null;
    setDrag(null);
    clearDropCue();
    return clearDropCue;
  }, [interactionKey, canDrag, faceDown, arranging, orderScope]);
  useEffect(() => {
    setPickedCard(null);
    setReorderMessage(null);
    if (!arrangeAvailable) setArrangingScope(null);
  }, [orderScope, arrangeAvailable]);
  useEffect(() => {
    if (!focusCard.current) return;
    const id = focusCard.current;
    focusCard.current = null;
    [...(shell.current?.querySelectorAll("[data-testid]") || [])]
      .find(node => node.dataset.testid === `${testIdPrefix}${id}`)?.focus();
  }, [manualOrders, testIdPrefix]);

  const updatePreferences = next => {
    setPickedCard(null);
    setReorderMessage(null);
    setArrangingScope(null);
    setPreferences(saveHandPreferences(storage(), next));
  };
  const arrangeCard = (id, targetId, keyboard = false) => {
    const next = moveHandCard(sorted.map(card => card.id), id, targetId);
    // Bound memory across rooms/rounds; identities are never persisted.
    setManualOrders(previous => ({ ...Object.fromEntries(Object.entries(previous).slice(-11)), [orderScope]: next }));
    setPickedCard(null);
    setReorderMessage("hand.arrangeMoved");
    if (keyboard) focusCard.current = id;
  };
  const captureSlots = () => [...(shell.current?.querySelectorAll(".spread-hand-row") || [])].flatMap(row => {
    const nodes = [...row.children];
    const rectangles = nodes.map(node => node.getBoundingClientRect());
    return nodes.map((node, index) => ({
      id: sorted.find(card => node.dataset.testid === `${testIdPrefix}${card.id}`)?.id,
      left: rectangles[index].left,
      right: rectangles[index + 1]?.left ?? rectangles[index].right,
      top: rectangles[index].top,
      bottom: rectangles[index].bottom,
    }));
  });
  const startPointer = (event, card) => {
    if ((!arranging && (!canDrag || !legal.has(card.id))) || faceDown || (event.button !== 0 && event.button !== undefined) || event.isPrimary === false) return;
    pointer.current = { id: card.id, pointerId: event.pointerId, x: event.clientX, y: event.clientY,
      startedKey: interactionKey, startedScope: orderScope, kind: arranging ? "arrange" : "play",
      slots: arranging ? captureSlots() : [], moved: false };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };
  const movePointer = event => {
    const active = pointer.current;
    if (!active || active.pointerId !== event.pointerId) return;
    const dx = event.clientX - active.x;
    const dy = event.clientY - active.y;
    if (!active.moved && Math.hypot(dx, dy) < 9) return;
    active.moved = true;
    suppressClick.current = { id: active.id, until: Date.now() + 800 };
    event.preventDefault();
    setDrag({ id: active.id, x: dx, y: dy,
      overId: active.kind === "arrange" ? handReorderTarget({ x: event.clientX, y: event.clientY }, active.slots) : null });
    if (active.kind === "arrange") return;
    document.querySelectorAll("[data-card-drop-zone]").forEach(node => {
      const valid = canDropHandCard({ canDrag, legalIds: legal, cardId: active.id, interactionKey, startedKey: active.startedKey,
        point: { x: event.clientX, y: event.clientY }, rectangle: node.getBoundingClientRect() });
      node.setAttribute("data-drag-over", valid ? "true" : "false");
    });
  };
  const endPointer = (event, card, cancelled = false) => {
    const active = pointer.current;
    if (!active || active.pointerId !== event.pointerId) return;
    pointer.current = null;
    setDrag(null);
    clearDropCue();
    if (!active.moved) return;
    event.preventDefault();
    suppressClick.current = { id: active.id, until: Date.now() + 800 };
    if (active.kind === "arrange") {
      const targetId = handReorderTarget({ x: event.clientX, y: event.clientY }, active.slots);
      if (!cancelled && arranging && active.startedScope === orderScope && active.startedKey === interactionKey && targetId) {
        arrangeCard(card.id, targetId);
      }
      return;
    }
    const rectangle = document.querySelector("[data-card-drop-zone]")?.getBoundingClientRect();
    if (!cancelled && canDropHandCard({ canDrag, legalIds: legal, cardId: card.id, interactionKey, startedKey: active.startedKey,
      point: { x: event.clientX, y: event.clientY }, rectangle })) onCardDrop?.(card);
  };
  const clickCard = (event, card) => {
    // Pointer browsers can emit click after pointerup. Keyboard activation
    // (detail === 0) remains available even immediately after a gesture.
    if (event.detail !== 0 && suppressClick.current?.id === card.id && Date.now() < suppressClick.current.until) {
      event.preventDefault();
      return;
    }
    if (arranging) {
      if (!pickedCard) {
        setPickedCard(card.id);
        setReorderMessage("hand.arrangePicked");
      } else if (pickedCard === card.id) {
        setPickedCard(null);
        setReorderMessage(null);
      } else arrangeCard(pickedCard, card.id, event.detail === 0);
      return;
    }
    onCardClick?.(card);
  };

  const arrangementHint = arranging ? t(reorderMessage || "hand.arrangeHint") : null;
  return <div ref={shell} className="hand-cards-shell" data-arranging={arranging ? "true" : undefined}>
    {showSort && <div className={`hand-sort-toolbar${preferences.mode === "chaos" ? " has-chaos-tools" : ""}`}>
      <label><span>{t("hand.sortLabel")}</span>
        <select aria-label={t("hand.sortLabel")} value={preferences.mode} data-testid="hand-sort-select"
          onChange={event => updatePreferences({ ...preferences, mode: event.target.value })}>
          <option value="suit">{t("hand.sortSuit")}</option>
          <option value="value">{t("hand.sortValue")}</option>
          <option value="chaos">{t("hand.sortChaos")}</option>
        </select>
      </label>
      {preferences.mode === "chaos" && <>
        <button type="button" className="hand-shuffle-button" disabled={!canArrange || faceDown}
          onClick={() => { setManualOrders({}); updatePreferences({ mode: "chaos", seed: (preferences.seed + 1 + Math.floor(Math.random() * 0x7ffffffe)) % 0x7fffffff }); }}>{t("hand.reshuffle")}</button>
        <button type="button" className="hand-arrange-button" data-testid="hand-arrange-toggle"
          aria-pressed={arranging} disabled={!arrangeAvailable} title={t("hand.arrangeTitle")}
          onClick={() => { setPickedCard(null); setReorderMessage(null); setArrangingScope(arranging ? null : orderScope); }}>
          {t(arranging ? "hand.arrangeDone" : "hand.arrange")}
        </button>
      </>}
    </div>}
    <div className="hand-card-detail" role="status" aria-live="polite" data-testid="hand-card-detail"
      title={arrangementHint || (detailCard && !faceDown ? `${specials[detailCard.special]?.label}: ${t(`hand.effect.${detailCard.special}`)}` : undefined)}>
      {arrangementHint || (detailCard && !faceDown ? <><strong>{specials[detailCard.special]?.label}:</strong> {t(`hand.effect.${detailCard.special}`)}</> : null)}
    </div>
    <div ref={layout.ref} style={layout.style} className="turn-hand-grid compact-hand spread-hand"
      data-initial-count={initialCount} data-testid="own-hand-grid" data-sort-mode={preferences.mode}>
      {rows.map((row, rowIndex) => {
        const geometry = handRowGeometry({ count: row.length, ...layout.geometry });
        return <div className="spread-hand-row" key={rowIndex} style={{ width: geometry.width || "100%" }} data-card-count={row.length}>
          {row.map((card, index) => {
            const dragging = drag?.id === card.id;
            const draggable = !faceDown && (arranging || (canDrag && legal.has(card.id)));
            const cardClasses = [received.has(card.id) ? "hand-card-received" : "",
              arranging && pickedCard === card.id ? "hand-card-arrange-picked" : "",
              arranging && drag?.overId === card.id && !dragging ? "hand-card-arrange-target" : ""].filter(Boolean).join(" ");
            return <CardView key={card.id} card={card} size="md" faceDown={faceDown}
              selected={selected.has(card.id)} dim={!arranging && dimmed.has(card.id)}
              className={cardClasses}
              onClick={!faceDown && (arranging || onCardClick) ? event => clickCard(event, card) : undefined}
              testId={`${testIdPrefix}${card.id}`} dragging={dragging}
              onPointerDown={draggable ? event => startPointer(event, card) : undefined}
              onPointerMove={draggable ? movePointer : undefined}
              onPointerUp={draggable ? event => endPointer(event, card) : undefined}
              onPointerCancel={draggable ? event => endPointer(event, card, true) : undefined}
              onLostPointerCapture={event => endPointer(event, card, true)}
              style={{ marginLeft: index ? geometry.step - layout.geometry.cardWidth : 0,
                touchAction: draggable ? "none" : undefined,
                ...(dragging ? { transform: `translate(${drag.x}px, ${drag.y}px)`, zIndex: 100, transition: "none" } : {}) }} />;
          })}
        </div>;
      })}
    </div>
  </div>;
}
