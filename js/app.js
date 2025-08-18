import { $, qsa } from './utils.js';
import { openDB, loadMeta, loadAudioSet, saveMeta } from './storage.js';
import { decodeBlobsToBuffers, setAudioCallbacks } from './audio.js';
import {
  state, switchGame, resetGame, scrambleGame, toggleAudio,
  playAgain, showOtherGames, updateBestStats, updateTimerDisplay
} from './game.js';
import { wireAdmin } from './admin.js';
import { startTicker } from './ticker.js';

const SERVER_SYNC = false;        // flip to true if you wire a backend
const API_BASE = '/api/dtm';

function setPlayerUI(status, playing) {
  const led = $('led'), text = $('playerText');
  if (playing) led.classList.add('on'); else led.classList.remove('on');
  text.textContent = status;
}

async function pullFromServer() {
  if (!SERVER_SYNC) return;
  try {
    const r = await fetch(`${API_BASE}/state`, { credentials: 'include' });
    if (!r.ok) throw new Error('state fetch failed');
    const data = await r.json();
    if (Array.isArray(data.names) && data.names.length === 2) state.gameNames = data.names;
    if (data.records) state.bestRecords = data.records;
    if (Array.isArray(data.messages)) state.funnyMessages = data.messages;

    if (data.audio) {
      for (const k of ['1', '2']) {
        if (Array.isArray(data.audio[k]) && data.audio[k].length) {
          const blobs = [];
          for (const url of data.audio[k].slice(0,18)) {
            const resp = await fetch(url); blobs.push(await resp.blob());
          }
          const bufs = await decodeBlobsToBuffers(blobs);
          state.customBuffers[parseInt(k,10)-1] = bufs;
        }
      }
    }
  } catch (e) {
    console.warn('Server pull skipped:', e.message);
  }
}

function pushToServerDebounced() {
  if (!SERVER_SYNC) return;
  clearTimeout(pushToServerDebounced.t);
  pushToServerDebounced.t = setTimeout(pushToServer, 
