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
  customBuffers: [[],[]],     // AudioBuffers fo
