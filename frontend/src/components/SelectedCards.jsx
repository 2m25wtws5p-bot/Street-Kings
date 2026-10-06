import React from "react";
import { CardView } from "./CardView";

// A non-overlapping copy makes every selected card readable, even in a fan.
export function SelectedCards({ hand, selected, count, onRemove }) {
  return <div className="selected-cards" data-testid="selected-card-preview" aria-label="Ausgewählte Karten">
    <span className="selected-cards-label">Auswahl {selected.length}/{count}</span>
    <div className="selected-cards-row">
      {selected.map((id) => <CardView key={id} card={hand.find((c) => c.id === id)} size="xs" onClick={() => onRemove(id)} testId={`selected-card-${id}`} />)}
      {!selected.length && <span className="text-xs text-slate-400">Tippe Karten zum Auswählen an</span>}
    </div>
  </div>;
}
