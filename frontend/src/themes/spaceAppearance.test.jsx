import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { I18nScope } from "../i18n/I18nProvider";
import { ThemeProvider } from "./ThemeProvider";
import { CardView } from "../components/CardView";
import { LeadSuitIndicator } from "../components/LeadSuitIndicator";
import { Avatar } from "../components/Avatar";
import { AVATARS } from "../game/constants";

let container,root;
beforeEach(()=>{global.IS_REACT_ACT_ENVIRONMENT=true;container=document.createElement("div");document.body.append(container);root=createRoot(container);});
afterEach(()=>{act(()=>root.unmount());container.remove();});
const render=(children,theme="space")=>act(()=>root.render(<I18nScope language="en"><ThemeProvider theme={theme}>{children}</ThemeProvider></I18nScope>));

test.each([["RED","radar"],["YELLOW","gem"],["BLUE","orbit"],["GREEN","boxes"]])("space %s keeps suit/rank/callback and uses its own artwork and icons",(suit,icon)=>{
  const card=Object.freeze({id:`${suit}-8`,suit,value:8}),onClick=jest.fn();
  render(<><CardView card={card} onClick={onClick}/><LeadSuitIndicator suit={suit}/></>);
  const node=container.querySelector(".street-card");
  expect(node.dataset.suit).toBe(suit);expect(node.querySelector(".card-pip-top > span").textContent).toBe("8");
  expect(node.querySelector("[data-space-art]").dataset.spaceArt).toBe(suit);
  expect(node.querySelector(`.lucide-${icon}`)).not.toBeNull();
  expect(container.querySelector(`.lead-suit-indicator .lucide-${icon}`)).not.toBeNull();
  expect(container.querySelector("[data-animal-art],img.card-art")).toBeNull();
  act(()=>node.click());expect(onClick).toHaveBeenCalledTimes(1);expect(card.value).toBe(8);
});

test.each([["informant","GREEN",11,"+5"],["godmother","GREEN",12,"+10"],["runner",null,0,"0"],["kingpin","RED",11,"×2"],["briber","YELLOW",11,"−5"],["fixer","BLUE",11,"Ø"]])("%s rank and points share a nonoverlapping flow in illustrated themes",(special,suit,value,effect)=>{
  const card=Object.freeze({id:suit?`${suit}-${value}`:"W1",suit,value,special});
  for(const theme of ["animal","space"]){
    render(<CardView card={card}/>,theme);
    expect(container.querySelectorAll(".card-hand-effect")).toHaveLength(1);
    const pip=container.querySelector(".card-pip-top");
    expect(pip.firstElementChild.textContent).toBe(String(value));
    expect(pip.lastElementChild.matches(".card-effect-in-pip")).toBe(true);
    expect(pip.lastElementChild.querySelector("b").textContent).toBe(effect);
  }
  render(<CardView card={card}/>,"street");
  expect(container.querySelector(".card-pip-top .card-hand-effect")).toBeNull();
  expect(container.querySelector(".card-hand-effect b").textContent).toBe(effect);
});

test("eighteen space portraits retain stable identities and separate sprite positions",()=>{
  render(<>{AVATARS.map(a=><Avatar key={a.key} avatar={a}/>)}</>);
  const nodes=[...container.querySelectorAll('[data-avatar-theme="space"]')];
  expect(nodes.map(n=>n.dataset.avatarKey)).toEqual(AVATARS.map(a=>a.key));
  expect(new Set(nodes.map(n=>n.firstElementChild.style.backgroundPosition)).size).toBe(18);
  expect(nodes.every(n=>n.firstElementChild.style.backgroundSize==="600% 300%")).toBe(true);
});
