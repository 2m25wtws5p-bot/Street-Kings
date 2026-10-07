import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { SUITS, SUIT_ORDER, SPECIALS } from "../game/constants";
import { SPECIAL_ICON, SUIT_ICON } from "./CardView";
const CODEX = ["fire", "water", "pygmy", "earth", "air", "wizard"];

export function RulesDialog({ open, onOpenChange }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="panel max-w-2xl max-h-[85vh] overflow-y-auto border-white/15" data-testid="rules-dialog">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl gold-text">Der Kodex — So wird gespielt</DialogTitle>
        </DialogHeader>
        <div className="space-y-5 text-slate-100/90 text-sm leading-relaxed font-serif-fancy">
          <section>
            <h3 className="font-display text-amber-300 text-base mb-1">Das Ziel</h3>
            <p>
              Street Kings ist ein Stichspiel, bei dem du Stiche <b>vermeiden</b> willst. Du willst so{" "}
              <b className="text-red-300">wenig Hitze</b> wie möglich kassieren. Das Spiel endet, sobald jemand{" "}
              <b>70</b> Hitze erreicht — die Crew mit der niedrigsten Hitze wird zum Street King gekrönt.
            </p>
          </section>

          <section>
            <h3 className="font-display text-amber-300 text-base mb-1">Die vier Bereiche (Farben)</h3>
            <div className="grid grid-cols-2 gap-2">
              {SUIT_ORDER.map((k) => {
                const s = SUITS[k];
                const Icon = SUIT_ICON[k];
                return (
                  <div key={k} className="flex items-center gap-2 rounded-lg p-2" style={{ background: `${s.primary}18`, border: `1px solid ${s.primary}44` }}>
                    <Icon size={20} color={s.accent} />
                    <div>
                      <div className="font-display text-xs" style={{ color: s.accent }}>{s.people}</div>
                      <div className="text-[11px] text-slate-300/70">{s.realm} · 1–14</div>
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="mt-2 text-[13px]">
              Jede normale <b className="text-red-300">rote Karte (Hitze)</b> bringt <b>1 Hitze</b>.
              Für den Kingpin (rote 11) gilt die unten erklärte Sonderregel.
              Versuche, keine Stiche mit Hitze-Karten zu kassieren!
            </p>
          </section>

          <section>
            <h3 className="font-display text-amber-300 text-base mb-1">Ein Stich</h3>
            <ul className="list-disc pl-5 space-y-1 text-[13px]">
              <li>Wer anspielt, legt eine beliebige Karte. Alle anderen müssen die <b>angespielte Farbe bedienen</b>, wenn sie können.</li>
              <li>Keine Karte der angespielten Farbe? Spiel irgendetwas — die perfekte Gelegenheit, Hitze-Karten oder Gangsterfiguren abzuladen!</li>
              <li>Die <b>höchste Karte der angespielten Farbe</b> gewinnt den Stich und kassiert alle Karten darin.</li>
              <li>Der Stichgewinner spielt als Nächster an.</li>
            </ul>
          </section>

          <section>
            <h3 className="font-display text-amber-300 text-base mb-1">Die Gangsterfiguren & Laufjungen</h3>
            <div className="grid gap-2">
              {CODEX.map((key) => {
                const s = SPECIALS[key];
                const Icon = SPECIAL_ICON[key];
                return (
                  <div key={key} className="flex gap-3 items-center rounded-lg p-2 bg-black/30" style={{ border: `1px solid ${s.tag}55` }}>
                    <div
                      className="w-12 h-12 rounded-md grid place-items-center shrink-0"
                      style={{ background: `radial-gradient(circle, ${s.tag}33, transparent 70%)`, border: `1px solid ${s.tag}66` }}
                    >
                      <Icon size={24} color={s.tag} style={{ filter: `drop-shadow(0 0 6px ${s.tag}99)` }} />
                    </div>
                    <div>
                      <div className="font-display text-sm" style={{ color: s.tag }}>
                        {s.label} <span className="font-mono-stat text-[10px] text-white/70">· {s.short}</span>
                      </div>
                      <div className="text-[12px] text-slate-300/80">{s.desc}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section>
            <h3 className="font-display text-amber-300 text-base mb-1">Der Takeover</h3>
            <p className="text-[13px]">
              Kassiere <b>alle 14 Hitze-Karten</b> in einer Runde <b>und zusätzlich den Informanten und/oder die Patin</b>,
              dann übernimmst du die Kontrolle: Du bekommst <b>0</b> Hitze — stattdessen zieht jede gegnerische Crew{" "}
              <b>20</b> Hitze auf sich (Informant), <b>25</b> (Patin) oder <b>30</b> (beide). Ohne Informant oder Patin gibt
              es keinen Takeover und die Hitze wird normal gezählt.
            </p>
          </section>

          <section>
            <h3 className="font-display text-amber-300 text-base mb-1">Karten weitergeben & Bots</h3>
            <p className="text-[13px]">
              Beim Kartentausch geben alle Spieler verdeckt Karten weiter (3 Spieler: 4 Karten, 4 Spieler: 3,
              5 Spieler: 2, 6 Spieler: 2). Bei 3 oder 5 Spielern wechseln links und rechts; bei 4 oder 6 Spielern
              folgen links, rechts, gegenüber und eine Runde ohne Tausch. Jeder freie Platz kann mit einem{" "}
              <b>KI-Gangster</b> besetzt werden — nutze „Solo gegen KI“ oder schalte einzelne Plätze im Setup um.
            </p>
          </section>

          <section>
            <h3 className="font-display text-amber-300 text-base mb-1">Online: Zuschauen & Zurückkehren</h3>
            <p className="text-[13px]">
              Über den Raum-Link kannst du <b>mitspielen</b> oder <b>zuschauen</b>. Zuschauer sehen Tisch, Stiche und Hitze
              live, aber keine Handkarten. Fliegst du aus dem Spiel, bleibt dein Platz reserviert — öffne das Spiel auf{" "}
              <b>demselben Gerät und im selben Browser</b> erneut. Dein gespeicherter Spielerzugang bringt dich zurück
              an deinen Platz. Der Name allein reicht dafür nicht aus.
            </p>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
