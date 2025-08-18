let audioContext = null;
let currentSources = [];

export function initAudio() {
  if (!audioContext) {
    try { audioContext = new (window.AudioContext || window.webkitAudioContext)(); }
    catch { /* no audio */ }
  }
}
export function getCtx() { return audioContext; }

export function stopAllAudio() {
  currentSources.forEach(s => { try { s.stop(); } catch {} });
  currentSources = [];
}

export function playTone(freq, duration = 0.45) {
  if (!audioContext) return;
  stopAllAudio();
  const osc = audioContext.createOscillator();
  const g = audioContext.createGain();
  osc.type = 'sine';
  osc.frequency.value = freq;
  osc.connect(g); g.connect(audioContext.destination);
  g.gain.setValueAtTime(0, audioContext.currentTime);
  g.gain.linearRampToValueAtTime(0.16, audioContext.currentTime + 0.02);
  g.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);
  osc.start(); osc.stop(audioContext.currentTime + duration);
  currentSources.push(osc);
}

export function playBuffer(buf) {
  if (!audioContext || !buf) return;
  stopAllAudio();
  const src = audioContext.createBufferSource();
  const g = audioContext.createGain();
  src.buffer = buf; src.connect(g); g.connect(audioContext.destination);
  g.gain.value = 0.85; src.start();
  currentSources.push(src);
}

export function normalize(buffer) {
  const out = audioContext.createBuffer(buffer.numberOfChannels, buffer.length, buffer.sampleRate);
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const i = buffer.getChannelData(c);
    const o = out.getChannelData(c);
    let peak = 0;
    for (let k = 0; k < i.length; k++) peak = Math.max(peak, Math.abs(i[k]));
    const g = peak > 0 ? 0.85 / peak : 1;
    for (let k = 0; k < i.length; k++) o[k] = i[k] * g;
  }
  return out;
}

// resume once (mobile), stop on hide
document.addEventListener('click', () => {
  if (audioContext && audioContext.state === 'suspended') audioContext.resume();
}, { once: true });

document.addEventListener('visibilitychange', () => {
  if (document.hidden) stopAllAudio();
});
