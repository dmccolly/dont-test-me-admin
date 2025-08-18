import { $, qsa } from './utils.js';
import { openDB, loadMeta, loadAudioSet, saveMeta } from './storage.js';
import { decodeBlobsToBuffers } from './audio.js';
import {
  state, switchGame, resetGame, scrambleGame, toggleAudio,
  playAgain, showOtherGames, updateBestStats, updateTimerDisplay
} from './game.js';
import { wireAdmin } from './admin.js';
import { startTicker } from './ticker.js';

const SERVER_SYNC = false;        // flip to true if you wire a backend
const API_BASE = '/api/dtm';

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
  pushToServerDebounced.t = setTimeout(pushToServer, 600);
}

async function pushToServer() {
  if (!SERVER_SYNC) return;
  try {
    await fetch(`${API_BASE}/state`, {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      credentials: 'include',
      body: JSON.stringify({
        names: state.gameNames,
        records: state.bestRecords,
        messages: state.funnyMessages || []
      })
    });
  } catch (e) {
    console.warn('Server push skipped:', e.message);
  }
}

/* Boot */
async function init() {
  await openDB();

  // Load meta (names/records/messages) from IDB
  const meta = await loadMeta();
  if (meta.names) state.gameNames = meta.names;
  if (meta.records) state.bestRecords = meta.records;
  if (meta.messages) state.funnyMessages = meta.messages;

  // Optional server pull
  await pullFromServer();

  // Hydrate audio buffers from IndexedDB blobs
  const blobs1 = await loadAudioSet(1);
  const blobs2 = await loadAudioSet(2);
  if (blobs1.length) state.customBuffers[0] = await decodeBlobsToBuffers(blobs1);
  if (blobs2.length) state.customBuffers[1] = await decodeBlobsToBuffers(blobs2);

  // Wire admin, tabs, controls
  wireAdmin();

  qsa('.tab').forEach(btn => {
    btn.addEventListener('click', () => switchGame(parseInt(btn.dataset.game, 10)));
  });

  $('#newGame').addEventListener('click', resetGa
