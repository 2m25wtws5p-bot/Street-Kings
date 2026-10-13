import { CHAT_SOUNDS } from "../game/chat.js";
const icons = {
  animal: ["🐦","🐇","🦉","🐶","🐱","🐤","🫧","🐻","🐸","🔔","🐝","💧"],
  space: ["📡","🌀","✨","🚀","💾","⭐","🛰️","🌙","📶","💎","🪐","📻"],
};
// A shared chat message keeps its canonical ID; its look and sound are local.
export function getChatSoundPresentation(theme) {
  return CHAT_SOUNDS.map((sound,index) => ({ ...sound, icon:icons[theme]?.[index] || sound.icon }));
}
