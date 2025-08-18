import { $ } from './utils.js';
import { getFunnyMessages } from './admin.js';

let messageTimer = null;

export function startMessageRotation(){
  stopMessageRotation();
  const el = $('rotatingMessage');
  if (!el) return;

  // 10s greeting
  el.textContent = 'Welcome to the audio memory challenge!';
  setTimeout(()=>{
    // 10s how-to
    el.textContent = 'Click buttons to hear sounds, find matching pairs!';
    setTimeout(()=>{
      // 20s wait then loop
      setTimeout(()=>{
        if (!getFunnyMessages().length) {
          el.textContent = 'Welcome to the audio memory challenge!';
          return;
        }
        showRandomMessage();
        messageTimer = setInterval(showRandomMessage, 20000);
      }, 20000);
    }, 10000);
  }, 10000);
}

export function stopMessageRotation(){
  if (messageTimer) { clearInterval(messageTimer); messageTimer = null; }
}

function showRandomMessage(){
  const el = $('rotatingMessage');
  const msgs = getFunnyMessages();
  if (!el || !msgs.length) return;
  const i = Math.floor(Math.random()*msgs.length);
  el.textContent = msgs[i];
  setTimeout(()=>{ if (el.textContent === msgs[i]) el.textContent = ''; }, 10000);
}
