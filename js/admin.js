import { $ } from './utils.js';
import { PASSWORD, state, switchGame } from './game.js';
import { openDB, saveMeta, loadAudioSet, saveAudioSet, clearAudioSet } from './storage.js';
import { decodeBlobsToBuffers } from './audio.js';

export function wireAdmin() {
  $('#openAdmin').addEventListener('click', openAdmin);
  $('#closeAdmin').addEventListener('click', closeAdmin);

  // Names
  $('#name1').addEventListener('input', () => { state.gameNames[0] = $('#name1').value || 'Custom Set 1'; $('#tab1').textContent = state.gameNames[0]; persist(); });
  $('#name2').addEventListener('input', () => { state.gameNames[1] = $('#name2').value || 'Custom Set 2'; $('#tab2').textContent = state.gameNames[1]; persist(); });

  // Audio uploads
  bindDrop('drop1', 'files1', 1);
  bindDrop('drop2', 'files2', 2);
  $('#clear1').addEventListener('click', () => clearSlot(1));
  $('#clear2').addEventListener('click', () => clearSlot(2));
  $('#test1').addEventListener('click', () => testGame(1));
  $('#test2').addEventListener('click', () => testGame(2));

  // Funny messages
  bindMessageUpload();

  updateStatuses();
}

function openAdmin() {
  const pass = prompt('Enter admin password:');
  if (pass === null) return;
  if (pass !== PASSWORD) { alert('Incorrect password'); return; }
  $('#adminBackdrop').classList.add('show');
  $('#adminBackdrop').setAttribute('aria-hidden', 'false');
  refreshAdminUI();
}

function closeAdmin() {
  $('#adminBackdrop').classList.remove('show');
  $('#adminBackdrop').setAttribute('aria-hidden', 'true');
  $('#tab1').textContent = state.gameNames[0];
  $('#tab2').textContent = state.gameNames[1];
  persist();
}

function refreshAdminUI() {
  $('#name1').value = state.gameNames[0];
  $('#name2').value = state.gameNames[1];
  updateStatuses();
  updateMessageStatus();
}

function setStatus(slot, count) {
  const el = slot === 1 ? $('#status1') : $('#status2');
  el.className = 'slot-status' + (count === 18 ? ' ready' : (count > 0 ? ' partial' : ''));
  el.textContent = count === 18 ? 'Ready (18/18)' : (count > 0 ? `Partial (${count}/18)` : 'Empty (0/18)');
}

function updateStatuses() {
  setStatus(1, state.customBuffers[0].length);
  setStatus(2, state.customBuffers[1].length);
}

/* Audio upload helpers */
function bindDrop(dropId, inputId, slot) {
  const drop = $(dropId), input = $(inputId);
  drop.addEventListener('click', () => input.click());
  drop.addEventListener('dragover', (e)=>{e.preventDefault(); drop.classList.add('dragover');});
  drop.addEventListener('dragleave', (e)=>{e.preventDefault(); drop.classList.remove('dragover');});
  drop.addEventListener('drop', (e)=>{
    e.preventDefault(); drop.classList.remove('dragover');
    const files = [...e.dataTransfer.files].filter(f=>f.type.startsWith('audio/'));
    if (!files.length) { alert('Please drop audio files only.'); return; }
    processFiles(files, slot);
  });
  input.addEventListener('change', (e)=>{
    const files = [...e.target.files];
    if (!files.length) return;
    processFiles(files, slot);
    input.value = '';
  });
}

async function processFiles(files, slot) {
  await openDB();
  const idx = slot - 1;
  const take = Math.min(files.length, 18);
  if (files.length !== 18 && !confirm(`You selected ${files.length}. Continue with ${take}?`)) return;

  const statusEl = slot === 1 ? $('#status1') : $('#status2');
  statusEl.textContent = 'Processing...';
  statusEl.className = 'slot-status partial';

  // Save blobs first (persistence), then decode
  await saveAudioSet(slot, files.slice(0, take).map(f => f));
  const buffers = await decodeBlobsToBuffers(files.slice(0, take));
  state.customBuffers[idx] = buffers;

  updateStatuses();
  alert(`Loaded ${buffers.length} files for ${state.gameNames[idx]}.`);
  persist();
}

async function clearSlot(slot) {
  if (!confirm(`Clear all files from Custom Set ${slot}?`)) return;
  const idx = slot - 1;
  state.customBuffers[idx] = [];
  await clearAudioSet(slot);
  updateStatuses();
  persist();
}

function testGame(slot) {
  const idx = slot - 1;
  if (state.customBuffers[idx].length !== 18) {
    alert(`Custom Set ${slot} needs exactly 18 files. Currently has ${state.customBuffers[idx].length}.`);
    return;
  }
  closeAdmin();
  switchGame(slot);
}

/* Funny messages */
function bindMessageUpload() {
  const drop = $('#messageDrop');
  const input = $('#messageFile');
  drop.addEventListener('click', () => input.click());
  drop.addEventListener('dragover', (e)=>{e.preventDefault(); drop.classList.add('dragover');});
  drop.addEventListener('dragleave', (e)=>{e.preventDefault(); drop.classList.remove('dragover');});
  drop.addEventListener('drop', async (e)=>{
    e.preventDefault(); drop.classList.remove('dragover');
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    await loadMessageText(await file.text());
  });
  input.addEventListener('change', async e=>{
    const file = e.target.files?.[0];
    if (!file) return;
    await loadMessageText(await file.text());
    input.value = '';
  });

  $('#previewMessages').addEventListener('click', ()=>{
    if (!state.funnyMessages?.length) { alert('No messages loaded.'); return; }
    const preview = state.funnyMessages.slice(0,10).join('\n');
    const more = state.funnyMessages.length > 10 ? `\n\n...and ${state.funnyMessages.length-10} more` : '';
    alert(`Preview:\n\n${preview}${more}`);
  });
  $('#clearMessages').addEventListener('click', ()=>{
    if (!state.funnyMessages?.length) { alert('Nothing to clear.'); return; }
    if (confirm('Clear all funny messages?')) {
      state.funnyMessages = [];
      updateMessageStatus();
      persist();
    }
  });
}

async function loadMessageText(text) {
  const lines = text.split('\n').map(s=>s.trim()).filter(s=>s && s.length<=150);
  if (!lines.length) { alert('No valid messages found. Each line 1–150 chars.'); return; }
  state.funnyMessages = lines;
  updateMessageStatus();
  alert(`Loaded ${lines.length} messages.`);
  persist();
}

function updateMessageStatus() {
  $('#messageStatus').textContent = state.funnyMessages?.length ? `${state.funnyMessages.length} messages loaded` : 'No messages loaded';
}

/* persistence */
async function persist() {
  await openDB();
  await saveMeta({
    names: state.gameNames,
    records: state.bestRecords,
    messages: state.funnyMessages || [],
  });
}
