import assert from "node:assert/strict";
import test from "node:test";
import { CHAT_SOUNDS } from "../src/game/chat.js";
import { getChatSoundPresentation } from "../src/themes/chatPresentation.js";
test("all themes share the same twelve chat IDs and translations while using distinct icons",()=>{
  for(const theme of ["street","animal","space"]){
    const sounds=getChatSoundPresentation(theme);
    assert.equal(sounds.length,12);
    assert.deepEqual(sounds.map(({id,labelKey})=>({id,labelKey})),CHAT_SOUNDS.map(({id,labelKey})=>({id,labelKey})));
    assert.equal(new Set(sounds.map(s=>s.icon)).size,12);
    if(theme!=="street")assert.notDeepEqual(sounds.map(s=>s.icon),CHAT_SOUNDS.map(s=>s.icon));
  }
  assert.deepEqual(getChatSoundPresentation("unknown"),CHAT_SOUNDS);
});
