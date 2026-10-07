import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui/dialog";
import { SUITS, SUIT_ORDER, WIN_THRESHOLD } from "../game/constants";
import { SUIT_ICON, SPECIAL_ICON } from "./CardView";
import { SCORE_CARD_META } from "../game/scoreExplanation";
import { Crown, ArrowRight } from "lucide-react";

const SPECIAL_RULES = [
  ["fire", "Zählt selbst 0 Hitze. Verdoppelt die Punkte deiner übrigen roten Karten; zusammen können diese höchstens 15 Hitze bringen. Grüne Zusatzpunkte werden nicht verdoppelt."],
  ["water", "Bringt 5 zusätzliche Hitze, sobald er in deinen gewonnenen Stichen liegt."],
  ["pygmy", "Bringt 10 zusätzliche Hitze. Sie gehört zur grünen Farbe und muss als grüne Karte bedient werden."],
  ["air", "Neutralisiert die gesamte Hitze aus deinen Stichen: rote Punkte sowie Informant und Patin. Die betroffenen Karten dürfen in verschiedenen deiner Stiche liegen."],
  ["earth", "Zieht bis zu 5 Hitze aus dieser Runde ab. Die Rundenwertung kann dabei bis auf 0 sinken; dein bisheriger Gesamtstand wird nicht verringert."],
  ["wizard", "Die vier Laufjungen haben Wert 0 und keine Farbe. Du darfst sie jederzeit spielen, auch wenn du die angespielte Farbe auf der Hand hast."],
];
const PASS_ROWS = [
  [3, 20, 4, "Links → rechts → links …"],
  [4, 15, 3, "Links → rechts → gegenüber → links …"],
  [5, 12, 3, "Links → rechts → links …"],
  [6, 10, 2, "Links → rechts → gegenüber → links …"],
];
const COLOR_NAMES = { RED: "Rot", YELLOW: "Gelb", BLUE: "Blau", GREEN: "Grün" };

function RuleSection({ number, title, children }) {
  return <section className="rule-section">
    <h3 className="font-display text-xl font-bold flex items-center gap-2 mb-2"><span className="rule-step grid place-items-center w-7 h-7 shrink-0 rounded">{number}</span>{title}</h3>
    {children}
  </section>;
}

export function RulesDialog({ open, onOpenChange }) {
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="street-dialog rule-dialog w-[calc(100vw-1.5rem)] max-w-2xl max-h-[88dvh] overflow-y-auto p-4 sm:p-6" data-testid="rules-dialog">
      <DialogHeader className="street-dialog-header pr-6">
        <p className="street-dialog-kicker font-display text-xs tracking-[0.2em] font-bold">Street Kings · Spielregeln</p>
        <DialogTitle className="street-dialog-title font-display text-3xl flex items-center gap-2"><Crown size={28} aria-hidden="true" />Der Kodex</DialogTitle>
        <DialogDescription className="street-dialog-description text-sm">Die Regeln in eigenen Worten, nach der Witches-Anleitung von AMIGO. Karten und Figuren tragen hier Street-Kings-Namen.</DialogDescription>
      </DialogHeader>
      <div className="space-y-6 text-sm leading-relaxed">
        <RuleSection number="01" title="Wenig Hitze. Große Krone.">
          <p>Ihr spielt mit 3–6 Crews. Gewonnene Stiche können Hitze bringen; wer wenig davon sammelt, liegt vorn. Nach jeder Runde kommt die Rundenhitze zum Gesamtstand. Sobald eine Crew <strong>{WIN_THRESHOLD} oder mehr Hitze</strong> erreicht, endet das Spiel. Die Crew mit dem niedrigsten Gesamtstand gewinnt. Bei Gleichstand teilen sich die niedrigsten Crews den Sieg.</p>
        </RuleSection>

        <RuleSection number="02" title="Austeilen & weitergeben">
          <p>Das Deck enthält <strong>60 Karten</strong>: vier Farben mit jeweils den Werten 1–14 und vier farblose Laufjungen mit Wert 0. Jede Runde werden alle Karten verteilt. Wählt dann gleichzeitig Karten aus und gebt sie verdeckt weiter. Erst danach nehmt ihr eure erhaltenen Karten auf.</p>
          <div className="rule-table overflow-x-auto rounded-md mt-3">
            <table className="w-full text-left text-xs sm:text-sm">
              <caption className="sr-only">Handkarten, Tauschmenge und Richtung je nach Spielerzahl</caption>
              <thead><tr><th scope="col" className="p-2 font-display">Crews</th><th scope="col" className="p-2 font-display">Hand</th><th scope="col" className="p-2 font-display">Tausch</th><th scope="col" className="p-2 font-display">Rundenfolge</th></tr></thead>
              <tbody>{PASS_ROWS.map(([n, hand, pass, direction]) => <tr key={n}><th scope="row" className="p-2 font-mono-stat">{n}</th><td className="p-2">{hand}</td><td className="p-2 font-bold">{pass} Karten</td><td className="p-2 min-w-[140px]">{direction}</td></tr>)}</tbody>
            </table>
          </div>
          <p className="mt-2">Es gibt keine Runde ohne Tausch. Die Person nach dem Geber beginnt den ersten Stich; gespielt wird im Uhrzeigersinn.</p>
          <div className="grid grid-cols-2 gap-2 mt-3">{SUIT_ORDER.map(key => {
            const s = SUITS[key]; const Icon = SUIT_ICON[key];
            const meta = Object.values(SCORE_CARD_META).find(card => card.suit === key);
            return <div key={key} className="rule-suit rounded-md p-2 flex items-center gap-2" style={{ color: meta.ink, background: meta.paper, border: `1px solid ${meta.ink}55` }}>
              <Icon size={22} aria-hidden="true" /><div><div className="font-display font-bold">{COLOR_NAMES[key]} · {s.people}</div><div className="text-xs">Werte 1–14</div></div>
            </div>;
          })}</div>
        </RuleSection>

        <RuleSection number="03" title="So läuft ein Stich">
          <ol className="list-decimal pl-5 space-y-2">
            <li>Die anspielende Crew legt eine beliebige Handkarte. Danach legt jede Crew genau eine Karte.</li>
            <li>Die <strong>erste farbige Karte</strong> bestimmt die Stichfarbe. Hast du diese Farbe, musst du sie spielen. Ein Laufjunge bleibt trotzdem jederzeit erlaubt. Hast du die Farbe nicht, darfst du jede Karte ablegen.</li>
            <li>Die höchste Karte der Stichfarbe gewinnt alle Karten auf dem Tisch. Andere Farben gewinnen nicht, auch mit höherem Wert. Es gibt keinen Trumpf.</li>
            <li>Die Gewinner-Crew sammelt den Stich und beginnt den nächsten. Sind alle Hände leer, wird abgerechnet.</li>
          </ol>
          <div className="rule-note rounded-md p-3 mt-3"><strong>Laufjungen am Anfang:</strong> Sie legen noch keine Farbe fest. Erst die erste farbige Karte tut das. Ein Laufjunge gewinnt nur, wenn der ganze Stich aus Laufjungen besteht — dann gewinnt der zuerst gespielte.</div>
        </RuleSection>

        <RuleSection number="04" title="Die Figuren kennen">
          <p className="mb-3">Sonderfähigkeiten zählen bei der Abrechnung deiner <strong>gewonnenen Stiche</strong>, nicht für den Stichgewinn. Eine 11 bleibt beim Ausspielen eine 11 ihrer Farbe.</p>
          <div className="grid gap-2">{SPECIAL_RULES.map(([key, description]) => {
            const card = SCORE_CARD_META[key]; const Icon = SUIT_ICON[card.suit] || SPECIAL_ICON[key];
            return <div key={key} className="rule-special rounded-md p-3" data-rule-card={key} style={{ color: card.ink, background: card.paper, border: `1px solid ${card.ink}66` }}>
              <div className="flex flex-wrap justify-between gap-1 mb-1"><span className="font-display text-lg font-bold inline-flex items-center gap-2"><Icon size={20} aria-hidden="true" />{card.colorName} {card.rank} · {card.name}</span><span className="text-[10px] font-bold uppercase self-center">{card.role}</span></div>
              <p className="text-xs sm:text-sm leading-relaxed">{description}</p>
            </div>;
          })}</div>
        </RuleSection>

        <RuleSection number="05" title="Die Abrechnung lesen">
          <p>Zuerst zählt jede rote Karte außer dem Kingpin <strong>1 Hitze</strong>. Der Kingpin verdoppelt diesen Anteil, gedeckelt auf 15. Dann kommen Informant (+5) und Patin (+10) dazu. Der Fixer neutralisiert diese gesamte Rundenhitze. Der Schmierer zieht von der verbleibenden Hitze bis zu 5 ab, höchstens bis 0. Das Ergebnis ist deine Rundenhitze.</p>
          <div className="rule-example rounded-md p-3 mt-3 space-y-2 text-xs sm:text-sm">
            <p><strong>Verdoppeln:</strong> Vier rote Punktekarten plus Kingpin ergeben <span className="font-mono-stat font-bold">4 × 2 = 8</span>. Zehn rote Punktekarten plus Kingpin ergeben <span className="font-mono-stat font-bold">20 → 15</span>.</p>
            <p><strong>Zusatzpunkte:</strong> Zwei rote Punktekarten, Informant und Patin ergeben <span className="font-mono-stat font-bold">2 + 5 + 10 = 17</span>. Mit Fixer wird daraus <span className="font-mono-stat font-bold">0</span>.</p>
            <p><strong>Reduzieren:</strong> Drei rote Punktekarten plus Schmierer ergeben <span className="font-mono-stat font-bold">3 − 3 = 0</span>. Die übrigen zwei Schutzpunkte verfallen.</p>
          </div>
          <p className="mt-2 inline-flex items-center gap-1 flex-wrap"><strong>Gesamtstand:</strong> bisherige Hitze <ArrowRight size={14} aria-hidden="true" /> plus Rundenhitze <ArrowRight size={14} aria-hidden="true" /> neuer Gesamtstand.</p>
        </RuleSection>

        <RuleSection number="06" title="Der Takeover">
          <p>Sammelst du <strong>alle 14 roten Karten</strong> und zusätzlich <strong>Informant und/oder Patin</strong>, löst du einen Takeover aus. Du erhältst in dieser Runde 0 Hitze. Jede andere Crew erhält die gleiche Pauschale:</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-3">
            {[["Informant", "15 + 5", 20], ["Patin", "15 + 10", 25], ["Beide", "15 + 5 + 10", 30]].map(([name, math, total]) => <div key={name} className="rule-example rounded-md p-3 text-center"><div className="font-display font-bold">Alle roten + {name}</div><div className="font-mono-stat text-xs mt-1">{math}</div><div className="font-display text-3xl font-bold">{total} Hitze</div></div>)}
          </div>
          <p className="mt-3">Bei einem Takeover sind normale Sonderfähigkeiten ausgeschaltet. Fixer und Schmierer können die Pauschale nicht senken; eine grüne Figur bei einer anderen Crew erhöht sie nicht. Alle roten Karten ohne Informant oder Patin reichen nicht für einen Takeover.</p>
          <div className="rule-note rounded-md p-3 mt-3"><strong>Ausnahme am Spielende:</strong> Würde durch deinen Takeover das Spiel enden und eine andere Crew gewinnen, bekommen die anderen 0 Rundenhitze. Stattdessen ziehst du die Takeover-Pauschale von deinem bisherigen Gesamtstand ab, höchstens bis 0. Dadurch geht das Spiel weiter. Beispiel: Bei Ständen von 40, 0 und 60 würde dein 25er-Takeover die Crew mit 0 zum Sieger machen. Stattdessen sinkt dein Stand von 40 auf 15; die anderen bleiben bei 0 und 60.</div>
        </RuleSection>

        <RuleSection number="07" title="Spielen in Street Kings">
          <p>Freie Plätze kannst du mit KI-Crews füllen; „Solo gegen KI“ startet direkt mit Bots. Über einen Raum-Link können Freunde mitspielen oder zuschauen. Zuschauer sehen den offenen Tisch und die Abrechnung, aber keine Handkarten.</p>
          <p className="mt-2">Bei einer Unterbrechung bleibt dein Online-Platz reserviert. Öffne das Spiel wieder auf demselben Gerät im selben Browser: der gespeicherte Zugang stellt deinen Platz wieder her. Ein gleicher Name allein genügt nicht.</p>
          <p className="rule-note rounded-md p-3 mt-3 text-xs"><strong>Variante der Originalanleitung:</strong> Optional kann ungenutzter Schutz des Schmierers den bisherigen Gesamtstand senken. Diese Zusatzvariante ist in Street Kings nicht aktiviert. Hier reduziert der Schmierer ausschließlich die aktuelle Runde.</p>
        </RuleSection>
      </div>
    </DialogContent>
  </Dialog>;
}
