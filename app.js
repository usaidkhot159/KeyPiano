/* =============================================
   KEYBOARD PIANO — app.js
   ============================================= */

'use strict';

// ─── Audio Context ────────────────────────────
let audioCtx = null;
let analyserNode = null;
let masterGain = null;
let reverbNode = null;
let reverbGain = null;
let dryGain = null;

function getAudioCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    setupAudioGraph();
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function setupAudioGraph() {
  masterGain = audioCtx.createGain();
  masterGain.gain.value = 0.8;

  analyserNode = audioCtx.createAnalyser();
  analyserNode.fftSize = 2048;
  analyserNode.smoothingTimeConstant = 0.85;

  // Simple reverb via convolver
  reverbNode = audioCtx.createConvolver();
  reverbNode.buffer = makeReverbIR(audioCtx, 2.0, 2.0, false);

  reverbGain = audioCtx.createGain();
  reverbGain.gain.value = 0.2;

  dryGain = audioCtx.createGain();
  dryGain.gain.value = 1.0;

  masterGain.connect(dryGain);
  masterGain.connect(reverbNode);
  reverbNode.connect(reverbGain);

  dryGain.connect(analyserNode);
  reverbGain.connect(analyserNode);
  analyserNode.connect(audioCtx.destination);
}

function makeReverbIR(ctx, duration, decay, reverse) {
  const rate = ctx.sampleRate;
  const length = rate * duration;
  const buf = ctx.createBuffer(2, length, rate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < length; i++) {
      const n = reverse ? length - i : i;
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - n / length, decay);
    }
  }
  return buf;
}

// ─── Instrument Definitions ───────────────────
const instruments = {
  piano: {
    name: 'Piano',
    makeSound(ctx, freq, gain) {
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const env  = ctx.createGain();
      osc1.type = 'triangle';
      osc2.type = 'sine';
      osc1.frequency.value = freq;
      osc2.frequency.value = freq * 2.002;
      env.gain.setValueAtTime(0, ctx.currentTime);
      env.gain.linearRampToValueAtTime(gain, ctx.currentTime + 0.008);
      env.gain.exponentialRampToValueAtTime(gain * 0.6, ctx.currentTime + 0.1);
      env.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 2.2);
      osc1.connect(env);
      osc2.connect(env);
      osc1.start(); osc2.start();
      osc1.stop(ctx.currentTime + 2.5);
      osc2.stop(ctx.currentTime + 2.5);
      return { env, nodes: [osc1, osc2] };
    }
  },
  organ: {
    name: 'Organ',
    makeSound(ctx, freq, gain) {
      const oscs = [1, 2, 3, 4].map(h => {
        const o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.value = freq * h;
        return o;
      });
      const env = ctx.createGain();
      env.gain.setValueAtTime(0, ctx.currentTime);
      env.gain.linearRampToValueAtTime(gain, ctx.currentTime + 0.02);
      oscs.forEach((o, i) => {
        const g = ctx.createGain();
        g.gain.value = 1 / (i + 1);
        o.connect(g);
        g.connect(env);
        o.start();
        o.stop(ctx.currentTime + 3);
      });
      return { env, nodes: oscs };
    }
  },
  synth: {
    name: 'Synth',
    makeSound(ctx, freq, gain) {
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const env  = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      osc1.type = 'sawtooth';
      osc2.type = 'sawtooth';
      osc1.frequency.value = freq;
      osc2.frequency.value = freq * 1.006;
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(300, ctx.currentTime);
      filter.frequency.exponentialRampToValueAtTime(4000, ctx.currentTime + 0.3);
      filter.Q.value = 6;
      env.gain.setValueAtTime(0, ctx.currentTime);
      env.gain.linearRampToValueAtTime(gain, ctx.currentTime + 0.01);
      env.gain.exponentialRampToValueAtTime(gain * 0.7, ctx.currentTime + 0.3);
      env.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 2.0);
      osc1.connect(filter); osc2.connect(filter);
      filter.connect(env);
      osc1.start(); osc2.start();
      osc1.stop(ctx.currentTime + 2.5);
      osc2.stop(ctx.currentTime + 2.5);
      return { env, nodes: [osc1, osc2] };
    }
  },
  guitar: {
    name: 'Guitar',
    makeSound(ctx, freq, gain) {
      // Karplus-Strong-inspired pluck
      const bufSize = Math.round(ctx.sampleRate / freq);
      const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      const env = ctx.createGain();
      env.gain.setValueAtTime(gain, ctx.currentTime);
      env.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 2.5);
      src.connect(env);
      src.start();
      src.stop(ctx.currentTime + 2.8);
      return { env, nodes: [src] };
    }
  },
  bells: {
    name: 'Bells',
    makeSound(ctx, freq, gain) {
      const partials = [1, 2.756, 5.404, 8.933, 13.35];
      const env = ctx.createGain();
      env.gain.setValueAtTime(0, ctx.currentTime);
      env.gain.linearRampToValueAtTime(gain, ctx.currentTime + 0.005);
      env.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 4.0);
      partials.forEach((p, i) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'sine';
        o.frequency.value = freq * p;
        g.gain.value = 1 / (i + 1) * 0.8;
        o.connect(g);
        g.connect(env);
        o.start();
        o.stop(ctx.currentTime + 4.5);
      });
      return { env, nodes: [] };
    }
  },
  bass: {
    name: 'Bass',
    makeSound(ctx, freq, gain) {
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const env = ctx.createGain();
      osc1.type = 'sawtooth';
      osc2.type = 'square';
      // Bass plays one octave lower
      osc1.frequency.value = freq * 0.5;
      osc2.frequency.value = freq * 0.5;
      filter.type = 'lowpass';
      filter.frequency.value = 600;
      filter.Q.value = 2;
      env.gain.setValueAtTime(0, ctx.currentTime);
      env.gain.linearRampToValueAtTime(gain, ctx.currentTime + 0.01);
      env.gain.exponentialRampToValueAtTime(gain * 0.8, ctx.currentTime + 0.1);
      env.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 1.5);
      const g2 = ctx.createGain();
      g2.gain.value = 0.3;
      osc1.connect(filter);
      osc2.connect(g2); g2.connect(filter);
      filter.connect(env);
      osc1.start(); osc2.start();
      osc1.stop(ctx.currentTime + 2.0);
      osc2.stop(ctx.currentTime + 2.0);
      return { env, nodes: [osc1, osc2] };
    }
  }
};

// ─── Piano Layout ─────────────────────────────
// One octave pattern: W B W B W W B W B W B W
// We'll render 2 octaves + a few extra for nice layout
const NOTE_NAMES    = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const WHITE_NOTES   = ['C','D','E','F','G','A','B'];
const BLACK_AFTER   = { 'C':true, 'D':true, 'F':true, 'G':true, 'A':true };

// Keyboard mapping: keyboard key → { note, octaveOffset }
// White keys: Z X C V B N M , . /  (C D E F G A B C D E)
// Black keys: S D   G H J   (C# D# F# G# A#)
const KEY_MAP = {
  'z': { note:'C', octOff:0 },
  's': { note:'C#', octOff:0 },
  'x': { note:'D', octOff:0 },
  'd': { note:'D#', octOff:0 },
  'c': { note:'E', octOff:0 },
  'v': { note:'F', octOff:0 },
  'g': { note:'F#', octOff:0 },
  'b': { note:'G', octOff:0 },
  'h': { note:'G#', octOff:0 },
  'n': { note:'A', octOff:0 },
  'j': { note:'A#', octOff:0 },
  'm': { note:'B', octOff:0 },
  ',': { note:'C', octOff:1 },
  'l': { note:'C#', octOff:1 },
  '.': { note:'D', octOff:1 },
  ';': { note:'D#', octOff:1 },
  '/': { note:'E', octOff:1 },
};

// Reverse map: noteKey → keyboard letter (for display)
const NOTE_KEY_DISPLAY = {};
Object.entries(KEY_MAP).forEach(([k, v]) => {
  const noteKey = `${v.note}_${v.octOff}`;
  NOTE_KEY_DISPLAY[noteKey] = k === ',' ? ',' : k === '.' ? '.' : k === '/' ? '/' : k === ';' ? ';' : k.toUpperCase();
});

// ─── State ────────────────────────────────────
let currentOctave    = 4;
let currentInstrument = 'piano';
let volume           = 0.8;
let reverbAmount     = 0.2;

let isRecording = false;
let isPlaying   = false;
let recordedNotes = [];
let recordStartTime = 0;
let playbackTimer   = null;
let recTimerInterval = null;
let activeNodes     = new Map(); // noteKey → audio nodes for sustained (organ)

// ─── Build Piano UI ───────────────────────────
function buildPiano() {
  const piano = document.getElementById('piano');
  piano.innerHTML = '';

  // Render octaves 3, 4, 5 (3 octaves for playable range)
  for (let oct = 3; oct <= 5; oct++) {
    NOTE_NAMES.forEach((note, i) => {
      const isBlack = note.includes('#');
      const key = document.createElement('div');
      key.className = `key ${isBlack ? 'black' : 'white'}`;
      key.dataset.note = note;
      key.dataset.octave = oct;

      const octOff = oct - currentOctave;
      const kbKey = Object.entries(KEY_MAP).find(
        ([, v]) => v.note === note && v.octOff === octOff
      );

      const labelEl = document.createElement('span');
      labelEl.className = 'key-label';
      labelEl.textContent = kbKey ? kbKey[0] === ',' ? ',' : kbKey[0] === '.' ? '.' : kbKey[0].toUpperCase() : '';

      const noteEl = document.createElement('span');
      noteEl.className = 'key-note';
      noteEl.textContent = `${note}${oct}`;

      key.appendChild(labelEl);
      key.appendChild(noteEl);

      // Mouse events
      key.addEventListener('mousedown', e => {
        e.preventDefault();
        triggerNote(note, oct, key);
      });
      key.addEventListener('mouseenter', e => {
        if (e.buttons === 1) triggerNote(note, oct, key);
      });
      key.addEventListener('mouseup', () => releaseNote(note, oct, key));
      key.addEventListener('mouseleave', () => releaseNote(note, oct, key));

      // Touch events
      key.addEventListener('touchstart', e => {
        e.preventDefault();
        triggerNote(note, oct, key);
      }, { passive: false });
      key.addEventListener('touchend', e => {
        e.preventDefault();
        releaseNote(note, oct, key);
      });

      piano.appendChild(key);
    });
  }
}

// Refresh keyboard labels when octave changes
function refreshKeyLabels() {
  const keys = document.querySelectorAll('.key');
  keys.forEach(key => {
    const note = key.dataset.note;
    const oct  = parseInt(key.dataset.octave);
    const octOff = oct - currentOctave;
    const kbKey = Object.entries(KEY_MAP).find(
      ([, v]) => v.note === note && v.octOff === octOff
    );
    const labelEl = key.querySelector('.key-label');
    if (labelEl) labelEl.textContent = kbKey ? (kbKey[0] === ',' ? ',' : kbKey[0].toUpperCase()) : '';
  });
}

// ─── Note Frequency ───────────────────────────
function noteFreq(note, octave) {
  const idx = NOTE_NAMES.indexOf(note);
  // A4 = 440 Hz → MIDI 69
  const midi = (octave + 1) * 12 + idx;
  return 440 * Math.pow(2, (midi - 69) / 12);
}

// ─── Play Sound ───────────────────────────────
function playNote(note, octave) {
  const ctx  = getAudioCtx();
  const freq = noteFreq(note, octave);
  const inst = instruments[currentInstrument];
  const { env, nodes } = inst.makeSound(ctx, freq, volume * 0.5);
  env.connect(masterGain);

  const noteKey = `${note}${octave}`;
  activeNodes.set(noteKey, { env, nodes });

  // Show label
  const vizLabel = document.getElementById('viz-label');
  if (vizLabel) {
    vizLabel.classList.add('hidden');
    setTimeout(() => vizLabel.classList.remove('hidden'), 2000);
  }
}

function stopNote(note, octave) {
  const noteKey = `${note}${octave}`;
  const entry = activeNodes.get(noteKey);
  if (entry) {
    const ctx = getAudioCtx();
    entry.env.gain.cancelScheduledValues(ctx.currentTime);
    entry.env.gain.setValueAtTime(entry.env.gain.value, ctx.currentTime);
    entry.env.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.15);
    activeNodes.delete(noteKey);
  }
}

// ─── Trigger / Release ────────────────────────
function triggerNote(note, octave, keyEl) {
  playNote(note, octave);
  if (keyEl) {
    keyEl.classList.add('active');
    addRipple(keyEl);
  }

  if (isRecording) {
    recordedNotes.push({
      note, octave,
      time: Date.now() - recordStartTime,
      type: 'noteOn'
    });
  }
}

function releaseNote(note, octave, keyEl) {
  stopNote(note, octave);
  if (keyEl) keyEl.classList.remove('active');

  if (isRecording) {
    recordedNotes.push({
      note, octave,
      time: Date.now() - recordStartTime,
      type: 'noteOff'
    });
  }
}

function addRipple(keyEl) {
  const r = document.createElement('div');
  r.className = 'key-ripple';
  keyEl.appendChild(r);
  r.addEventListener('animationend', () => r.remove());
}

// ─── Keyboard Input ───────────────────────────
const heldKeys = new Set();

document.addEventListener('keydown', e => {
  if (e.repeat) return;
  const k = e.key.toLowerCase();
  if (heldKeys.has(k)) return;
  const mapping = KEY_MAP[k];
  if (!mapping) return;

  e.preventDefault();
  heldKeys.add(k);

  const oct = currentOctave + mapping.octOff;
  const keyEl = findKeyEl(mapping.note, oct);
  triggerNote(mapping.note, oct, keyEl);
});

document.addEventListener('keyup', e => {
  const k = e.key.toLowerCase();
  heldKeys.delete(k);
  const mapping = KEY_MAP[k];
  if (!mapping) return;
  const oct = currentOctave + mapping.octOff;
  const keyEl = findKeyEl(mapping.note, oct);
  releaseNote(mapping.note, oct, keyEl);
});

function findKeyEl(note, octave) {
  return document.querySelector(`.key[data-note="${note}"][data-octave="${octave}"]`);
}

// ─── Recording ────────────────────────────────
const recordBtn = document.getElementById('record-btn');
const playBtn   = document.getElementById('play-btn');
const stopBtn   = document.getElementById('stop-btn');
const clearBtn  = document.getElementById('clear-btn');
const statusDot  = document.getElementById('status-dot');
const statusText = document.getElementById('status-text');
const recTimer   = document.getElementById('rec-timer');

recordBtn.addEventListener('click', () => {
  if (isPlaying) stopPlayback();

  if (isRecording) {
    // Stop recording
    isRecording = false;
    recordBtn.classList.remove('recording');
    clearInterval(recTimerInterval);
    setStatus('idle', `Recorded ${(Date.now() - recordStartTime / 1) / 1000 | 0}s`);
    if (recordedNotes.length > 0) {
      playBtn.disabled = false;
      clearBtn.disabled = false;
    }
  } else {
    // Start recording
    recordedNotes = [];
    recordStartTime = Date.now();
    isRecording = true;
    recordBtn.classList.add('recording');
    playBtn.disabled = true;
    clearBtn.disabled = true;
    stopBtn.disabled = true;
    setStatus('recording', 'Recording…');
    let secs = 0;
    recTimer.textContent = '0:00';
    recTimerInterval = setInterval(() => {
      secs++;
      recTimer.textContent = `${Math.floor(secs/60)}:${String(secs%60).padStart(2,'0')}`;
    }, 1000);
  }
});

playBtn.addEventListener('click', () => {
  if (isRecording) return;
  if (isPlaying) {
    stopPlayback();
    return;
  }
  startPlayback();
});

stopBtn.addEventListener('click', () => {
  stopPlayback();
});

clearBtn.addEventListener('click', () => {
  stopPlayback();
  recordedNotes = [];
  playBtn.disabled = true;
  stopBtn.disabled = true;
  clearBtn.disabled = true;
  recTimer.textContent = '';
  setStatus('idle', 'Ready');
});

function setStatus(state, text) {
  statusDot.className = 'status-dot';
  if (state === 'recording') statusDot.classList.add('recording');
  if (state === 'playing')   statusDot.classList.add('playing');
  statusText.textContent = text;
}

function startPlayback() {
  if (!recordedNotes.length) return;
  isPlaying = true;
  playBtn.textContent = '⏸ Pause';
  stopBtn.disabled = false;
  setStatus('playing', 'Playing…');

  const events = [...recordedNotes];
  const timers = [];

  events.forEach(ev => {
    const t = setTimeout(() => {
      if (!isPlaying) return;
      const keyEl = findKeyEl(ev.note, ev.octave);
      if (ev.type === 'noteOn') {
        playNote(ev.note, ev.octave);
        keyEl?.classList.add('active');
        addRipple(keyEl);
      } else {
        stopNote(ev.note, ev.octave);
        keyEl?.classList.remove('active');
      }
    }, ev.time);
    timers.push(t);
  });

  const totalDuration = events[events.length - 1]?.time ?? 0;
  playbackTimer = setTimeout(() => {
    stopPlayback();
  }, totalDuration + 500);

  recordBtn._timers = timers;
}

function stopPlayback() {
  isPlaying = false;
  clearTimeout(playbackTimer);
  if (recordBtn._timers) {
    recordBtn._timers.forEach(clearTimeout);
    recordBtn._timers = [];
  }
  // Release all visually active keys
  document.querySelectorAll('.key.active').forEach(k => k.classList.remove('active'));
  playBtn.innerHTML = '<span>▶</span> Play';
  stopBtn.disabled = true;
  if (recordedNotes.length) setStatus('idle', `${recordedNotes.filter(e=>e.type==='noteOn').length} notes recorded`);
  else setStatus('idle', 'Ready');
}

// ─── Instrument Selection ─────────────────────
document.querySelectorAll('.instrument-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.instrument-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentInstrument = btn.dataset.instrument;
  });
});

// ─── Octave ───────────────────────────────────
document.getElementById('oct-down').addEventListener('click', () => {
  if (currentOctave > 2) {
    currentOctave--;
    document.getElementById('oct-display').textContent = currentOctave;
    refreshKeyLabels();
  }
});

document.getElementById('oct-up').addEventListener('click', () => {
  if (currentOctave < 6) {
    currentOctave++;
    document.getElementById('oct-display').textContent = currentOctave;
    refreshKeyLabels();
  }
});

// ─── Volume & Reverb ──────────────────────────
const volSlider = document.getElementById('volume-slider');
const revSlider = document.getElementById('reverb-slider');
const volVal    = document.getElementById('vol-val');
const revVal    = document.getElementById('rev-val');

volSlider.addEventListener('input', () => {
  volume = volSlider.value / 100;
  volVal.textContent = `${volSlider.value}%`;
  if (masterGain) masterGain.gain.value = volume;
});

revSlider.addEventListener('input', () => {
  reverbAmount = revSlider.value / 100;
  revVal.textContent = `${revSlider.value}%`;
  if (reverbGain) reverbGain.gain.value = reverbAmount;
  if (dryGain) dryGain.gain.value = 1 - reverbAmount * 0.5;
});

// ─── Visualizer ───────────────────────────────
const vizCanvas = document.getElementById('visualizer');
const vizCtx    = vizCanvas.getContext('2d');
let   vizRAF    = null;
let   lastDataTime = 0;

function drawVisualizer() {
  vizRAF = requestAnimationFrame(drawVisualizer);

  const W = vizCanvas.width;
  const H = vizCanvas.height;

  vizCtx.clearRect(0, 0, W, H);

  if (!analyserNode) {
    drawIdle(W, H);
    return;
  }

  const buf = new Uint8Array(analyserNode.frequencyBinCount);
  analyserNode.getByteTimeDomainData(buf);

  // Check if there's signal
  let hasSignal = false;
  for (let i = 0; i < buf.length; i++) {
    if (Math.abs(buf[i] - 128) > 2) { hasSignal = true; break; }
  }

  if (!hasSignal) {
    drawIdle(W, H);
    return;
  }

  lastDataTime = Date.now();

  // Draw waveform
  vizCtx.lineWidth = 2;
  const grad = vizCtx.createLinearGradient(0, 0, W, 0);
  grad.addColorStop(0,   'rgba(167, 139, 250, 0.4)');
  grad.addColorStop(0.5, 'rgba(167, 139, 250, 1.0)');
  grad.addColorStop(1,   'rgba(167, 139, 250, 0.4)');
  vizCtx.strokeStyle = grad;
  vizCtx.shadowColor = 'rgba(167, 139, 250, 0.6)';
  vizCtx.shadowBlur  = 8;

  vizCtx.beginPath();
  const sliceW = W / buf.length;
  let x = 0;
  for (let i = 0; i < buf.length; i++) {
    const v = buf[i] / 128.0;
    const y = (v * H) / 2;
    if (i === 0) vizCtx.moveTo(x, y);
    else         vizCtx.lineTo(x, y);
    x += sliceW;
  }
  vizCtx.stroke();
  vizCtx.shadowBlur = 0;
}

function drawIdle(W, H) {
  // Gentle idle line
  const t = Date.now() / 1000;
  vizCtx.lineWidth = 1.5;
  vizCtx.strokeStyle = 'rgba(74, 72, 96, 0.6)';
  vizCtx.beginPath();
  for (let x = 0; x < W; x++) {
    const y = H / 2 + Math.sin((x / W) * Math.PI * 6 + t * 0.8) * 3;
    if (x === 0) vizCtx.moveTo(x, y);
    else         vizCtx.lineTo(x, y);
  }
  vizCtx.stroke();
}

function resizeVisualizer() {
  const rect = vizCanvas.getBoundingClientRect();
  vizCanvas.width  = rect.width  * devicePixelRatio;
  vizCanvas.height = rect.height * devicePixelRatio;
  vizCtx.scale(devicePixelRatio, devicePixelRatio);
}

window.addEventListener('resize', resizeVisualizer);
setTimeout(resizeVisualizer, 100);

// ─── Background Canvas ────────────────────────
const bgCanvas = document.getElementById('bg-canvas');
const bgCtx    = bgCanvas.getContext('2d');

function resizeBg() {
  bgCanvas.width  = window.innerWidth;
  bgCanvas.height = window.innerHeight;
}

const particles = Array.from({ length: 40 }, () => ({
  x: Math.random(),
  y: Math.random(),
  r: Math.random() * 1.5 + 0.5,
  vx: (Math.random() - 0.5) * 0.0002,
  vy: (Math.random() - 0.5) * 0.0002,
  alpha: Math.random() * 0.4 + 0.1,
}));

function drawBg() {
  requestAnimationFrame(drawBg);
  const W = bgCanvas.width, H = bgCanvas.height;
  bgCtx.clearRect(0, 0, W, H);
  particles.forEach(p => {
    p.x += p.vx; p.y += p.vy;
    if (p.x < 0) p.x = 1; if (p.x > 1) p.x = 0;
    if (p.y < 0) p.y = 1; if (p.y > 1) p.y = 0;
    bgCtx.beginPath();
    bgCtx.arc(p.x * W, p.y * H, p.r, 0, Math.PI * 2);
    bgCtx.fillStyle = `rgba(167, 139, 250, ${p.alpha})`;
    bgCtx.fill();
  });
}

window.addEventListener('resize', resizeBg);
resizeBg();
drawBg();

// ─── Init ─────────────────────────────────────
buildPiano();
drawVisualizer();

// Scroll piano to center (octave 4)
setTimeout(() => {
  const pianoSection = document.querySelector('.piano-section');
  const allWhiteKeys = document.querySelectorAll('.key.white');
  // Octave 4 C is around key index 7 (after 3rd octave 7 white keys)
  if (allWhiteKeys[7]) {
    const offset = allWhiteKeys[7].offsetLeft - pianoSection.offsetWidth / 2 + 100;
    pianoSection.scrollLeft = Math.max(0, offset);
  }
}, 200);

console.log('%c🎹 KeyPiano loaded — press Z to start!', 'color: #A78BFA; font-size: 14px; font-weight: bold;');