import { $, qsa, formatTime, shuffle } from './utils.js';
import { playTone, playBuffer, stopAll } from './audio.js';

export const PASSWORD = 'MUSIC';
export const FREQUENCIES = [220,246,261,293,329,349,392,440,493,523,587,659,698,783,880,987,1046,1174];

export const state = {
  currentGame: 0,
  sounds: [],
  matched: new Set(),
  firstClick: null,
  matches: 0,
  attempts: 0,
  muted: false,
  gameStartTime: null,
  gameTimer: null,
  currentTime: 0,
  gameNames: ['Custom Set 1', 'Custom Set 2'],
  bestRecords: {0:{time:null,attempts:null},1:{time:null,attempts:null},2:{time:null,attempts:null}},
  customBuffers: [[],[]],     // AudioBuffers for sets 1 & 2
  funnyMessages: [],          // ticker/admin messages
};

export function buildGrid() {
  const grid = $('grid');
  if (state.currentGame === 0) {
    const pairs = [];
    FREQUENCIES.forEach(f => pairs.push(f, f));
    state.sounds = shuffle(pairs);
  } else {
    const idx = state.currentGame - 1;
    if (state.customBuffers[idx].length !== 18) {
      alert(`${state.gameNames[idx]} is not ready. Please upload 18 files.`);
      switchGame(0);
      return;
    }
    const pairs = [];
    state.customBuffers[idx].forEach(b => pairs.push(b, b));
    state.sounds = shuffle(pairs);
  }

  grid.innerHTML = '';
  for (let i = 0; i < 36; i++) {
    const btn = document.createElement('button');
    btn.className = `btn row-${Math.floor(i/6)}`;
    btn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/></svg>';
    btn.addEventListener('click', () => onTile(i));
    grid.appendChild(btn);
  }
}

export function onTile(i) {
  if (state.matched.has(i)) return;

  if (!state.gameStartTime) startTimer();

  const v = state.sounds[i];
  if (state.currentGame === 0) playTone(v, state.muted);
  else playBuffer(v, state.muted);

  const btn = $('grid').children[i];
  btn.style.transform = 'translateY(-1px) scale(.97)';
  setTimeout(() => btn.style.transform = '', 120);

  if (state.firstClick === null) {
    state.firstClick = i;
    return;
  }
  if (state.firstClick === i) { state.firstClick = null; return; }

  state.attempts++; updateStats();
  if (state.sounds[state.firstClick] === state.sounds[i]) markMatched(state.firstClick, i);
  state.firstClick = null;
}

export function markMatched(i1, i2) {
  const btns = $('grid').children;
  state.matched.add(i1); state.matched.add(i2);
  const check = '<svg viewBox="0 0 24 24"><path d="M9 16.17 4.83 12l-1.42 1.41L9 19l12-12-1.41-1.41z"/></svg>';
  btns[i1].innerHTML = check; btns[i2].innerHTML = check;
  btns[i1].classList.add('matched'); btns[i2].classList.add('matched');
  state.matches++; updateStats();

  if (!state.muted) {
    setTimeout(() => playTone(880, false, .18), 90);
    setTimeout(() => playTone(1100, false, .18), 230);
  }

  if (state.matches === 18) {
    stopTimer();
    const acc = state.attempts === 0 ? 100 : Math.round((state.matches / state.attempts) * 100);
    $('winStats').textContent = `Completed in ${formatTime(state.currentTime)} with ${state.attempts} attempts (${acc}% accuracy)`;
    checkNewRecords();
    setTimeout(() => $('win').classList.add('show'), 350);
    [523,659,784,1047].forEach((n,k)=>setTimeout(()=>playTone(n,false,.28),140*k));
  }
}

export function updateStats() {
  $('matches').textContent = state.matches;
  $('attempts').textContent = state.attempts;
  const acc = state.attempts === 0 ? 100 : Math.round((state.matches / state.attempts) * 100);
  $('accuracy').textContent = acc + '%';
  updateTimerDisplay();
}

export function resetGame() {
  stopAll();
  stopTimer();
  state.sounds = [];
  state.matched = new Set();
  state.firstClick = null;
  state.matches = 0;
  state.attempts = 0;
  state.currentTime = 0;
  state.gameStartTime = null;
  buildGrid();
  updateStats();
  updateBestStats();
  hideWin();
}

export function scrambleGame() {
  if (!state.sounds.length) { resetGame(); return; }
  stopAll(); stopTimer();
  state.sounds = shuffle(state.sounds);
  state.matched = new Set(); state.firstClick = null; state.matches = 0; state.attempts = 0; state.currentTime = 0; state.gameStartTime = null;
  [...$('grid').children].forEach((btn,i) => {
    btn.className = `btn row-${Math.floor(i/6)}`;
    btn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/></svg>';
  });
  updateStats(); updateBestStats(); hideWin();
}

export function toggleAudio() {
  state.muted = !state.muted;
  $('muteBtn').innerHTML = state.muted ? '🔇 Audio Off' : '🔊 Audio On';
}

/* Timer & Records */
export function startTimer() {
  if (state.gameStartTime) return;
  state.gameStartTime = Date.now();
  state.gameTimer = setInterval(() => {
    state.currentTime = Math.floor((Date.now() - state.gameStartTime) / 1000);
    updateTimerDisplay();
  }, 1000);
}

export function stopTimer() {
  if (state.gameTimer) { clearInterval(state.gameTimer); state.gameTimer = null; }
}

export function updateTimerDisplay() {
  $('currentStats').textContent = `Time: ${formatTime(state.currentTime)} | Attempts: ${state.attempts}`;
}

export function updateBestStats() {
  const r = state.bestRecords[state.currentGame];
  const t = r.time == null ? '--' : formatTime(r.time);
  const a = r.attempts == null ? '--' : r.attempts;
  $('bestStats').textContent = `Best Time: ${t} | Best Attempts: ${a}`;
}

export let onNewRecords = () => {}; // set by app.js

export function checkNewRecords() {
  const r = state.bestRecords[state.currentGame];
  let changed = false;
  if (r.time == null || state.currentTime < r.time) { r.time = state.currentTime; changed = true; }
  if (r.attempts == null || state.attempts < r.attempts) { r.attempts = state.attempts; changed = true; }
  if (changed) onNewRecords();
  updateBestStats();
}

/* Win modal */
export function hideWin() { $('win').classList.remove('show'); }
export function playAgain() { hideWin(); resetGame(); }
export function showOtherGames() { hideWin(); alert('Use the tabs above to switch games.'); }

/* Tabs */
export function switchGame(idx) {
  if (idx > 0 && state.customBuffers[idx-1].length !== 18) {
    alert(`${state.gameNames[idx-1]} is not ready. Please upload 18 files first.`);
    return;
  }
  state.currentGame = idx;
  qsa('.tab').forEach((t,k)=>t.classList.toggle('active', k === idx));
  resetGame();
}
