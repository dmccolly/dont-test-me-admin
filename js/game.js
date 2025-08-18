import { $, shuffle, formatTime } from './utils.js';
import { initAudio, getCtx, playTone, playBuffer, stopAllAudio } from './audio.js';
import { loadBest, saveBest } from './storage.js';

export const PASSWORD = 'MUSIC';
export const frequencies = [220,246,261,293,329,349,392,440,493,523,587,659,698,783,880,987,1046,1174];

let currentGame = 0;          // 0=Tones, 1=Custom1, 2=Custom2
let customBuffers = [[],[]];  // 18 each
let gameNames = ["Custom Set 1","Custom Set 2"]; // set by app.js
let sounds = [];
let matched = new Set();
let firstClick = null;
let matches = 0;
let attempts = 0;
let muted = false;

let bestRecords = loadBest();
let gameStartTime = null;
let gameTimer = null;
let currentTime = 0;

export function setGameNames(names){ gameNames = names; }
export function getGameNames(){ return gameNames; }
export function getCustomBuffers(){ return customBuffers; }
export function setCustomBuffers(slot, arr){ customBuffers[slot] = arr; }
export function getCurrentGame(){ return currentGame; }

function updateStats() {
  $('matches').textContent = matches;
  $('attempts').textContent = attempts;
  const acc = attempts === 0 ? 100 : Math.round((matches / attempts) * 100);
  $('accuracy').textContent = acc + '%';
  updateTimerDisplay();
}

export function createGrid() {
  if (currentGame === 0) {
    const pairs = [];
    frequencies.forEach(f => pairs.push(f, f));
    sounds = shuffle(pairs);
  } else {
    const slot = currentGame - 1;
    if (customBuffers[slot].length !== 18) {
      alert(`${gameNames[slot]} is not ready. Please upload 18 audio files first.`);
      switchGame(0);
      return;
    }
    const pairs = [];
    customBuffers[slot].forEach(b => pairs.push(b, b));
    sounds = shuffle(pairs);
  }

  const grid = $('grid');
  grid.innerHTML = '';
  for (let i = 0; i < 36; i++) {
    const btn = document.createElement('button');
    btn.className = `btn row-${Math.floor(i / 6)}`;
    btn.innerHTML = '<svg viewBox="0 0 24 24" style="width:28px;height:28px;fill:currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/></svg>';
    btn.onclick = () => handleClick(i);
    grid.appendChild(btn);
  }
}

function sameSound(a, b) { return a === b; }

function handleClick(i) {
  if (matched.has(i)) return;
  if (!gameStartTime) startTimer();
  initAudio();
  const v = sounds[i];
  currentGame === 0 ? playTone(v) : playBuffer(v);

  const btn = $('grid').children[i];
  btn.style.transform = 'translateY(-1px) scale(.97)';
  setTimeout(() => btn.style.transform = '', 120);

  if (firstClick === null) { firstClick = i; return; }
  if (firstClick === i)     { firstClick = null; return; }

  attempts++; updateStats();
  if (sameSound(sounds[firstClick], sounds[i])) markMatched(firstClick, i);
  firstClick = null;
}

function markMatched(i1, i2) {
  const btns = $('grid').children;
  matched.add(i1); matched.add(i2);
  const check = '<svg viewBox="0 0 24 24" style="width:28px;height:28px;fill:currentColor"><path d="M9 16.17 4.83 12l-1.42 1.41L9 19l12-12-1.41-1.41z"/></svg>';
  btns[i1].innerHTML = check; btns[i2].innerHTML = check;
  btns[i1].classList.add('matched'); btns[i2].classList.add('matched');

  matches++; updateStats();
  if (!muted && getCtx()) {
    setTimeout(() => playTone(880, .18), 90);
    setTimeout(() => playTone(1100, .18), 230);
  }
  if (matches === 18) {
    stopTimer();
    const acc = attempts === 0 ? 100 : Math.round((matches / attempts) * 100);
    $('winStats').textContent = `Completed in ${formatTime(currentTime)} with ${attempts} attempts (${acc}% accuracy)`;
    checkNewRecords();
    setTimeout(() => $('win').classList.add('show'), 350);
    [523,659,784,1047].forEach((n,k)=>setTimeout(()=>playTone(n,.28), 140*k));
  }
}

export function resetGame() {
  stopAllAudio();
  stopTimer();
  sounds = [];
  matched = new Set();
  firstClick = null;
  matches = 0;
  attempts = 0;
  currentTime = 0;
  gameStartTime = null;
  $('win').classList.remove('show');
  createGrid();
  updateStats();
  updateBestStats();
}

export function scrambleGame() {
  if (!sounds.length) { resetGame(); return; }
  stopAllAudio();
  stopTimer();
  sounds = shuffle(sounds);
  matched = new Set();
  firstClick = null;
  matches = 0;
  attempts = 0;
  currentTime = 0;
  gameStartTime = null;
  const grid = $('grid');
  [...grid.children].forEach((btn,i)=>{
    const row = Math.floor(i/6);
    btn.className = `btn row-${row}`;
    btn.innerHTML = '<svg viewBox="0 0 24 24" style="width:28px;height:28px;fill:currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/></svg>';
  });
  updateStats();
  updateBestStats();
}

export function toggleAudio() {
  muted = !muted;
  $('muteBtn').innerHTML = muted ? '🔇 Audio Off' : '🔊 Audio On';
}

export function switchGame(idx) {
  if (idx > 0 && customBuffers[idx-1].length !== 18) {
    alert(`${gameNames[idx-1]} is not ready. Please upload 18 audio files first.`);
    return;
  }
  currentGame = idx;
  document.querySelectorAll('.tab').forEach((t,k)=>t.classList.toggle('active', k===idx));
  resetGame();
}

export function startTimer() {
  if (gameStartTime) return;
  gameStartTime = Date.now();
  gameTimer = setInterval(() => {
    currentTime = Math.floor((Date.now() - gameStartTime) / 1000);
    updateTimerDisplay();
  }, 1000);
}
function stopTimer() {
  if (gameTimer) { clearInterval(gameTimer); gameTimer = null; }
}
function updateTimerDisplay() {
  $('currentStats').textContent = `Time: ${formatTime(currentTime)} | Attempts: ${attempts}`;
}
export function updateBestStats() {
  const r = bestRecords[String(getCurrentGame())];
  const t = r?.time == null ? '--' : formatTime(r.time);
  const a = r?.attempts == null ? '--' : r.attempts;
  $('bestStats').textContent = `Best Time: ${t} | Best Attempts: ${a}`;
}
function checkNewRecords() {
  const key = String(getCurrentGame());
  const r = bestRecords[key] || {time:null, attempts:null};
  let changed = false;
  if (r.time == null || currentTime < r.time) { r.time = currentTime; changed = true; }
  if (r.attempts == null || attempts < r.attempts) { r.attempts = attempts; changed = true; }
  bestRecords[key] = r;
  if (changed) saveBest(bestRecords);
  updateBestStats();
}

// expose to other modules
export const _priv = { updateStats, markMatched, handleClick };
