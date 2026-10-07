import React from "react";
import { CardView } from "./CardView";

// Reserve the same preview space before and after selecting exchange cards.
export function SelectedCards({ hand, selected, count, onRemove }) {
  return <div className="selected-cards" data-testid="selected-card-preview" aria-label="Ausgewählte Karten">
    <span className="selected-cards-label">Auswahl {selected.length}/{count}</span>
    <div className="selected-cards-row">
      {Array.from({ length: count }, (_, index) => {
        const id = selected[index];
        return <div className="selected-card-slot" key={index}>
          {id ? <CardView card={hand.find((c) => c.id === id)} size="xs" onClick={() => onRemove(id)} testId={`selected-card-${id}`} /> : <span className="selected-card-placeholder" aria-hidden="true" />}
        </div>;
      })}
    </div>
  </div>;
}
