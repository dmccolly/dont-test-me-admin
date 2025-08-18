import { $, shuffle } from './utils.js';
import { initAudio, getCtx, normalize } from './audio.js';
import { loadMessages, saveMessages, clearMessages as clearMsgsStore, loadNames, saveNames } from './storage.js';
import { PASSWORD, getCustomBuffers, setCustomBuffers, switchGame, getCurrentGame, setGameNames } from './game.js';

let funnyMessages = loadMessages();
function updateMessageStatus(){
  $('messageStatus').textContent = funnyMessages.length ? `${funnyMessages.length} messages loaded` : 'No messages loaded';
  $('messageStatus').className = 'slot-status ' + (funnyMessages.length ? 'ready' : '');
}

// open/close
export function showAdmin() {
  const pass = prompt('Enter admin password:');
  if (pass !== PASSWORD) { if (pass !== null) alert('Incorrect password'); return; }
  $('adminBackdrop').classList.add('show');
  $('adminBackdrop').setAttribute('aria-hidden','false');
  refreshAdmin();
}
export function hideAdmin() {
  $('adminBackdrop').classList.remove('show');
  $('adminBackdrop').setAttribute('aria-hidden','true');
}

// refresh fields
function refreshAdmin(){
  const [n1, n2] = loadNames();
  $('name1').value = n1; $('name2').value = n2;
  updateSlotStatus(1); updateSlotStatus(2);
  updateMessageStatus();
}

// slot status
function updateSlotStatus(slot){
  const count = getCustomBuffers()[slot-1].length;
  const el = slot===1 ? $('status1') : $('status2');
  if (count === 18) { el.textContent = 'Ready (18/18)'; el.className = 'slot-status ready'; }
  else if (count > 0) { el.textContent = `Partial (${count}/18)`; el.className = 'slot-status partial'; }
  else { el.textContent = 'Empty (0/18)'; el.className = 'slot-status'; }
}

// names
function bindNameInputs(){
  $('name1').addEventListener('input', ()=>{
    const names = [ $('name1').value || 'Custom Set 1', $('name2').value || 'Custom Set 2' ];
    saveNames(names); setGameNames(names);
    document.getElementById('tab1').textContent = names[0];
  });
  $('name2').addEventListener('input', ()=>{
    const names = [ $('name1').value || 'Custom Set 1', $('name2').value || 'Custom Set 2' ];
    saveNames(names); setGameNames(names);
    document.getElementById('tab2').textContent = names[1];
  });
}

// audio file processing
async function processFiles(files, slot){
  initAudio(); if (!getCtx()) { alert('Audio context not available. Please try again.'); return; }
  const idx = slot - 1;
  const statusEl = slot===1 ? $('status1') : $('status2');
  const take = Math.min(files.length, 18);
  if (files.length !== 18 && !confirm(`You selected ${files.length} files, but 18 are needed. Continue with ${take}?`)) return;

  const buffers = [];
  try{
    for(let i=0;i<take;i++){
      statusEl.textContent = `Processing ${i+1}/${take}...`; statusEl.className = 'slot-status partial';
      const ab = await files[i].arrayBuffer();
      const decoded = await getCtx().decodeAudioData(ab);
      buffers.push(normalize(decoded));
      await new Promise(r=>setTimeout(r,40));
    }
    setCustomBuffers(idx, buffers);
    updateSlotStatus(slot);
    alert(`Successfully loaded ${buffers.length} audio files for Custom Set ${slot}`);
  }catch(e){
    console.error(e);
    alert('Error processing some audio files. Please check file formats.');
    updateSlotStatus(slot);
  }
}

// bind admin DOM
export function bindAdminUI(){
  $('adminBtn').addEventListener('click', showAdmin);
  $('closeAdminBtn').addEventListener('click', hideAdmin);

  // funny messages
  $('messageFile').addEventListener('change', async (e)=>{
    const f = e.target.files?.[0]; if (!f) return;
    const text = await f.text();
    const lines = text.split('\n').map(s=>s.trim()).filter(s=>s && s.length<=150);
    if (!lines.length) { alert('No valid messages (1–150 chars each).'); return; }
    funnyMessages = lines; saveMessages(funnyMessages); updateMessageStatus(); alert(`Loaded ${funnyMessages.length} messages.`); e.target.value='';
  });
  $('messageDrop').addEventListener('dragover', (ev)=>{ ev.preventDefault(); ev.currentTarget.classList.add('dragover'); });
  $('messageDrop').addEventListener('dragleave', (ev)=>{ ev.preventDefault(); ev.currentTarget.classList.remove('dragover'); });
  $('messageDrop').addEventListener('drop', async (ev)=>{
    ev.preventDefault(); ev.currentTarget.classList.remove('dragover');
    const f = ev.dataTransfer.files?.[0]; if (!f) return;
    const text = await f.text();
    const lines = text.split('\n').map(s=>s.trim()).filter(s=>s && s.length<=150);
    if (!lines.length) { alert('No valid messages (1–150 chars each).'); return; }
    funnyMessages = lines; saveMessages(funnyMessages); updateMessageStatus(); alert(`Loaded ${funnyMessages.length} messages.`);
  });
  $('previewMsgBtn').addEventListener('click', ()=>{
    if (!funnyMessages.length) return alert('No messages loaded.');
    const sample = funnyMessages.slice(0,10).join('\n');
    const more = funnyMessages.length>10 ? `\n\n...and ${funnyMessages.length-10} more` : '';
    alert(`Preview:\n\n${sample}${more}`);
  });
  $('clearMsgBtn').addEventListener('click', ()=>{
    if (!funnyMessages.length) return alert('Nothing to clear.');
    if (!confirm('Clear all funny messages?')) return;
    funnyMessages = []; clearMsgsStore(); updateMessageStatus(); alert('Messages cleared.');
  });

  // custom sets
  const bindDrop = (dropId, fileId, slot, clearBtnId, testBtnId) => {
    $(fileId).addEventListener('change', (e)=>{ const files=[...e.target.files]; if(files.length) processFiles(files, slot); e.target.value=''; });
    $(dropId).addEventListener('dragover', (ev)=>{ ev.preventDefault(); ev.currentTarget.classList.add('dragover'); });
    $(dropId).addEventListener('dragleave',(ev)=>{ ev.preventDefault(); ev.currentTarget.classList.remove('dragover'); });
    $(dropId).addEventListener('drop', (ev)=>{ ev.preventDefault(); ev.currentTarget.classList.remove('dragover'); const files=[...ev.dataTransfer.files].filter(f=>f.type.startsWith('audio/')); if(!files.length) return alert('Drop audio files only.'); processFiles(files, slot); });
    $(clearBtnId).addEventListener('click', ()=>{ if(!confirm(`Clear all files from Custom Set ${slot}?`)) return; setCustomBuffers(slot-1, []); updateSlotStatus(slot); });
    $(testBtnId).addEventListener('click', ()=>{ switchGame(slot); hideAdmin(); });
  };
  bindDrop('drop1','files1',1,'clear1Btn','test1Btn');
  bindDrop('drop2','files2',2,'clear2Btn','test2Btn');

  bindNameInputs();
}

// expose funny messages to ticker
export function getFunnyMessages(){ return funnyMessages; }
