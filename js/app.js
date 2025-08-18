import { $ } from './utils.js';
import { initAudio } from './audio.js';
import { loadNames } from './storage.js';
import { createGrid, resetGame, scrambleGame, toggleAudio, switchGame, updateBestStats, setGameNames } from './game.js';
import { bindAdminUI } from './admin.js';
import { startMessageRotation } from './ticker.js';

function bindUI(){
  // Names on tabs (persisted)
  const names = loadNames();
  setGameNames(names);
  document.getElementById('tab1').textContent = names[0];
  document.getElementById('tab2').textContent = names[1];

  // Tabs
  document.getElementById('tab0').addEventListener('click', ()=>switchGame(0));
  document.getElementById('tab1').addEventListener('click', ()=>switchGame(1));
  document.getElementById('tab2').addEventListener('click', ()=>switchGame(2));

  // Controls
  $('newGameBtn').addEventListener('click', resetGame);
  $('scrambleBtn').addEventListener('click', scrambleGame);
  $('muteBtn').addEventListener('click', toggleAudio);

  // Win modal
  $('playAgainBtn').addEventListener('click', ()=>{ $('win').classList.remove('show'); resetGame(); });
  $('scrambleInWinBtn').addEventListener('click', ()=>{ $('win').classList.remove('show'); scrambleGame(); });
  $('gameOptionsBtn').addEventListener('click', ()=>{ $('win').classList.remove('show'); alert('Use the tabs to switch games.'); });

  // Admin
  bindAdminUI();
}

function boot(){
  initAudio();
  bindUI();
  createGrid();        // render 6×6 grid
  updateBestStats();
  startMessageRotation();
}

document.addEventListener('DOMContentLoaded', boot);
