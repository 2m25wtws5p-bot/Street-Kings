import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { SUITS, SUIT_ORDER, SPECIALS } from "../game/constants";
import { WITCH_ART } from "../game/assets";
import { Flame, Sun, MountainSnow, Leaf } from "lucide-react";

const SUIT_ICON = { RED: Flame, YELLOW: Sun, BLUE: MountainSnow, GREEN: Leaf };
const CODEX = ["fire", "water", "earth", "air", "pygmy", "wizard"];

export function RulesDialog({ open, onOpenChange }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="panel max-w-2xl max-h-[85vh] overflow-y-auto border-purple-500/30" data-testid="rules-dialog">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl gold-text">The Grimoire — How to Play</DialogTitle>
        </DialogHeader>
        <div className="space-y-5 text-purple-100/90 text-sm leading-relaxed font-serif-fancy">
          <section>
            <h3 className="font-display text-amber-300 text-base mb-1">The Goal</h3>
            <p>
              Witches is a trick-taking game of avoidance. You want the <b className="text-red-300">fewest</b> fire
              points. The game ends when someone reaches <b>70</b> — and the witch with the lowest score is crowned
              Arch-Witch.
            </p>
          </section>

          <section>
            <h3 className="font-display text-amber-300 text-base mb-1">The Four Realms (Suits)</h3>
            <div className="grid grid-cols-2 gap-2">
              {SUIT_ORDER.map((k) => {
                const s = SUITS[k];
                const Icon = SUIT_ICON[k];
                return (
                  <div key={k} className="flex items-center gap-2 rounded-lg p-2" style={{ background: `${s.primary}18`, border: `1px solid ${s.primary}44` }}>
                    <Icon size={20} color={s.accent} />
                    <div>
                      <div className="font-display text-xs" style={{ color: s.accent }}>{s.people}</div>
                      <div className="text-[11px] text-purple-200/70">{s.realm} · 1–14</div>
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="mt-2 text-[13px]">
              Every <b className="text-red-300">Red (Goblin)</b> card is a fire card worth <b>1 fire point</b>. Try not
              to win tricks that contain them!
            </p>
          </section>

          <section>
            <h3 className="font-display text-amber-300 text-base mb-1">Playing a Trick</h3>
            <ul className="list-disc pl-5 space-y-1 text-[13px]">
              <li>The leader plays any card. Everyone else must <b>follow the led colour</b> if they can.</li>
              <li>No card of the led colour? Play anything — a great chance to dump fire cards or witches!</li>
              <li>The <b>highest card of the led colour</b> wins the trick and takes all its cards.</li>
              <li>The winner leads the next trick.</li>
            </ul>
          </section>

          <section>
            <h3 className="font-display text-amber-300 text-base mb-1">The Witches & Wizards</h3>
            <div className="grid gap-2">
              {CODEX.map((key) => {
                const s = SPECIALS[key];
                return (
                  <div key={key} className="flex gap-3 items-center rounded-lg p-2 bg-black/30" style={{ border: `1px solid ${s.tag}55` }}>
                    <img src={WITCH_ART[key]} alt={s.label} className="w-12 h-12 rounded-md object-cover object-top shrink-0" />
                    <div>
                      <div className="font-display text-sm" style={{ color: s.tag }}>
                        {s.label} <span className="font-mono-stat text-[10px] text-white/70">· {s.short}</span>
                      </div>
                      <div className="text-[12px] text-purple-200/80">{s.desc}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section>
            <h3 className="font-display text-amber-300 text-base mb-1">The Fire Spell (Shooting the Moon)</h3>
            <p className="text-[13px]">
              Collect <b>all 14 red fire cards</b> in one round and you score <b>0</b> — instead every opponent takes{" "}
              <b>20</b> fire points (25 if you also grabbed the Water Witch, up to 30 with the Pygmy Queen too)!
            </p>
          </section>

          <section>
            <h3 className="font-display text-amber-300 text-base mb-1">Passing Cards</h3>
            <p className="text-[13px]">
              At the start of each round players secretly pass cards to a neighbour (3p pass 3, 4p pass 3, 5p pass 2,
              6p pass 1), rotating direction each round. Curse a rival with your worst cards!
            </p>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
