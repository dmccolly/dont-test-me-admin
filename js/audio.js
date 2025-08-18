let audioContext = null;
let currentSources = [];
let onStart = null;
let onStop = null;

export function getContext() {
  if (!audioContext) {
    try {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
    } catch {}
  }
  return audioContext;
}

export function setAudioCallbacks(startCb, stopCb) {
  onStart = startCb;
  onStop = stopCb;
}

function notifyStart(label) { if (onStart) onStart(label); }
function notifyStop() { if (onStop) onStop(); }

export function stopAll() {
  currentSources.forEach(s => { try { s.stop(); } catch {} });
  currentSources = [];
  notifyStop();
}

export function playTone(freq, muted, duration = 0.45) {
  if (muted) return;
  const ac = getContext(); if (!ac) return;
  stopAll();
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = 'sine';
  osc.frequency.value = freq;
  osc.connect(g); g.connect(ac.destination);
  g.gain.setValueAtTime(0, ac.currentTime);
  g.gain.linearRampToValueAtTime(0.16, ac.currentTime + 0.02);
  g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + duration);
  notifyStart(`Tone ${Math.round(freq)} Hz`);
  osc.start(); osc.stop(ac.currentTime + duration);
  osc.onended = () => notifyStop();
  currentSources.push(osc);
}

export function normalize(buffer) {
  const ac = getContext(); if (!ac) return buffer;
  const out = ac.createBuffer(buffer.numberOfChannels, buffer.length, buffer.sampleRate);
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const i = buffer.getChannelData(c), o = out.getChannelData(c);
    let peak = 0; for (let k = 0; k < i.length; k++) peak = Math.max(peak, Math.abs(i[k]));
    const g = peak > 0 ? 0.85 / peak : 1;
    for (let k = 0; k < i.length; k++) o[k] = i[k] * g;
  }
  return out;
}

export async function decodeBlobsToBuffers(blobs) {
  const ac = getContext(); if (!ac) return [];
  const out = [];
  for (const b of blobs.slice(0, 18)) {
    try {
      const ab = await b.arrayBuffer();
      const buf = await ac.decodeAudioData(ab);
      out.push(normalize(buf));
    } catch { /* ignore */ }
  }
  return out;
}

export function playBuffer(buf, muted) {
  if (muted) return;
  const ac = getContext(); if (!ac || !buf) return;
  stopAll();
  const src = ac.createBufferSource();
  const g = ac.createGain();
  src.buffer = buf;
  src.connect(g); g.connect(ac.destination);
  g.gain.value = 0.9;
  notifyStart('Custom sample');
  src.start();
  src.onended = () => notifyStop();
  currentSources.push(src);
}
