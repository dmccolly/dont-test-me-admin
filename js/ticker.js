import { $ } from './utils.js';

let timer = null;

export function startTicker(getMessages) {
  stopTicker();
  const el = $('rotatingMessage');

  // staged intro
  el.textContent = 'Welcome to the audio memory challenge!';
  setTimeout(() => {
    el.textContent = 'Click buttons to hear sounds, find matching pairs!';
    setTimeout(() => {
      const msgs = getMessages();
      if (msgs && msgs.length) {
        showRandom(el, msgs);
        timer = setInterval(() => showRandom(el, getMessages()), 20000);
      } else {
        el.textContent = 'Welcome to the audio memory challenge!';
      }
    }, 20000);
  }, 10000);
}

export function stopTicker() {
  if (timer) { clearInterval(timer); timer = null; }
}

function showRandom(el, msgs) {
  if (!msgs || !msgs.length) return;
  const i = Math.floor(Math.random() * msgs.length);
  el.textContent = msgs[i];
  setTimeout(() => { el.textContent = ''; }, 10000);
}
