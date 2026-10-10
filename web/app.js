const button = document.querySelector('#listen');
const statusEl = document.querySelector('#status');
const speciesEl = document.querySelector('#species');
const metaEl = document.querySelector('#meta');
const player = document.querySelector('#player');
const timerEl = document.querySelector('#timer');
const handsFreeBtn = document.querySelector('#handsfree');
const keepalive = document.querySelector('#keepalive');
const weekSummary = document.querySelector('#weekSummary');
const weekList = document.querySelector('#weekList');
const walkBtn = document.querySelector('#walk');
const walkInfo = document.querySelector('#walkInfo');
const useLocBtn = document.querySelector('#useLoc');
const nearbyNote = document.querySelector('#nearbyNote');
const nearbyList = document.querySelector('#nearbyList');
const nearbySummary = document.querySelector('#nearbySummary');
const inviteWindow = document.querySelector('#inviteWindow');
const inviteTarget = document.querySelector('#inviteTarget');
const inviteDays = document.querySelector('#inviteDays');
const inviteDaysNote = document.querySelector('#inviteDaysNote');
const inviteLocBtn = document.querySelector('#inviteLoc');
const inviteCalBtn = document.querySelector('#inviteCal');
const inviteCalNote = document.querySelector('#inviteCalNote');
const pocketScreen = document.querySelector('#pocketScreen');
const pocketToggle = document.querySelector('#pocketToggle');
const deviceNote = document.querySelector('#deviceNote');
const devicePack = document.querySelector('#devicePack');
const deviceProgress = document.querySelector('#deviceProgress');
const deviceToggle = document.querySelector('#deviceToggle');
const deviceRemove = document.querySelector('#deviceRemove');
const deviceSummary = document.querySelector('#deviceSummary');
const lifeSummary = document.querySelector('#lifeSummary');
const lifeList = document.querySelector('#lifeList');

const MAX_CAPTURE_MS = 5000;
const POCKET_DELAY_MS = 2500; // how long the note's result stays visible before the screen rests
const MIN_CAPTURE_MS = 900;
const HANDS_FREE_CAPTURE_MS = 4000;
const HANDS_FREE_COOLDOWN_MS = 2500;
const MIME_CANDIDATES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
// Tiny silent WAV, played once inside a user gesture so iOS lets us play the field note later.
const SILENCE = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';

// 1 s of silence, looped in hands-free mode so the OS routes headphone buttons to this page.
const KEEPALIVE = 'data:audio/wav;base64,UklGRmQfAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YUAfAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgA==';

let micReady = false;
let handsFree = false;
let lastTrigger = 0;
let noteSpeaking = false;
let userLoc = null; // { lat, lon } rounded to ~1 km, only while the user has opted in
let lastNearby = null; // last /nearby response, used for the weekly listening target
let pocketOn = localStorage.getItem('forestEchoPocket') !== 'off'; // pocket mode is on unless the user turned it off
let pocketTimer = null;
let walk = readWalk(); // active walk, if any
let deviceOn = localStorage.getItem('forestEchoDevice') === '1'; // identify on this phone instead of the server
let missCount = 0; // rotates the practical tip shown when nothing is identified
let audioUnlocked = false;
let session = null; // the one capture in progress, if any
let wakeLock = null;
let observationCount = Number(localStorage.getItem('forestEchoObservations') || 0);

function setState(state, text) {
  document.body.dataset.state = state;
  statusEl.textContent = text;
  // Pocket mode: once the note is over and we are back to silence, let the screen rest.
  clearTimeout(pocketTimer);
  if (state === 'silent' && pocketOn) pocketTimer = setTimeout(restScreen, POCKET_DELAY_MS);
}

// ---------- Pocket mode: after the note, the screen goes black so you look up, not down ----------
// A web page cannot switch the display off; a black overlay is the honest equivalent. It saves power on
// OLED phones, removes glare, and a tap brings everything back. Headphone-button capture still works.
function restScreen() {
  if (!pocketOn || session) return;
  pocketScreen.classList.add('on');
  pocketScreen.setAttribute('aria-hidden', 'false');
  pocketScreen.tabIndex = 0;
  syncScreenClock();
}
function wakeScreen() {
  clearTimeout(pocketTimer);
  pocketScreen.classList.remove('on');
  pocketScreen.setAttribute('aria-hidden', 'true');
  pocketScreen.tabIndex = -1;
  syncScreenClock();
}
function togglePocket() {
  pocketOn = !pocketOn;
  if (pocketOn) localStorage.removeItem('forestEchoPocket'); else localStorage.setItem('forestEchoPocket', 'off');
  if (!pocketOn) wakeScreen();
  renderPocket();
}
function renderPocket() {
  pocketToggle.textContent = 'Pocket';
  pocketToggle.setAttribute('aria-pressed', pocketOn ? 'true' : 'false');
}

function pickMime() {
  return MIME_CANDIDATES.find((m) => window.MediaRecorder?.isTypeSupported(m));
}

// Consecutive-day streak, stored locally. Counts days with at least one observation.
function todayKey(d = new Date()) {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}
function readStreak() {
  try { return JSON.parse(localStorage.getItem('forestEchoStreak')) || { last: '', days: 0 }; }
  catch { return { last: '', days: 0 }; }
}
function currentStreak() {
  const s = readStreak();
  const yesterday = new Date(Date.now() - 86400000);
  return s.last === todayKey() || s.last === todayKey(yesterday) ? Math.max(1, s.days) : 1;
}
function recordObservationDay() {
  const s = readStreak();
  const today = todayKey();
  if (s.last === today) return;
  const yesterday = todayKey(new Date(Date.now() - 86400000));
  localStorage.setItem('forestEchoStreak', JSON.stringify({ last: today, days: s.last === yesterday ? s.days + 1 : 1 }));
}

function updateTimer(startedAt) {
  timerEl.textContent = `${Math.min(5, (Date.now() - startedAt) / 1000).toFixed(1)}s`;
}

function unlockAudio() {
  if (audioUnlocked) return;
  audioUnlocked = true;
  player.src = SILENCE;
  player.play().catch(() => { audioUnlocked = false; });
}

function releaseStream(stream) {
  // Stop the tracks so the browser's microphone indicator goes off between holds.
  stream?.getTracks().forEach((t) => t.stop());
}

async function enableMic() {
  try {
    const probe = await navigator.mediaDevices.getUserMedia({ audio: true });
    releaseStream(probe);
    micReady = true;
    button.textContent = 'Hold to listen';
    setState('idle', 'Ready when you are.');
  } catch (error) {
    setState('idle', 'Microphone permission is required.');
    console.error(error);
  }
}

async function start(event) {
  event?.preventDefault();
  if (session) return;
  if (!micReady) { await enableMic(); return; } // first tap only grants permission
  unlockAudio();
  await beginCapture(MAX_CAPTURE_MS);
}

async function beginCapture(maxMs) {
  if (session) return;
  const s = { stream: null, recorder: null, startedAt: 0, chunks: [], timeout: null, ticker: null, ended: false, mime: '' };
  session = s;
  button.classList.add('active');
  button.textContent = 'Release to explain';

  try {
    s.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    if (s.ended) { releaseStream(s.stream); return; } // finger lifted while the mic was opening
    const mime = pickMime();
    s.recorder = new MediaRecorder(s.stream, mime ? { mimeType: mime } : undefined);
    s.mime = s.recorder.mimeType || mime || 'audio/webm';
    s.recorder.ondataavailable = (e) => { if (e.data.size) s.chunks.push(e.data); };
    s.recorder.onstop = () => finish(s);
    s.startedAt = Date.now();
    s.recorder.start();
    if (handsFree) cue(880);
    setState('listening', 'Listening…');
    updateTimer(s.startedAt);
    s.ticker = setInterval(() => updateTimer(s.startedAt), 100);
    s.timeout = setTimeout(() => stop(), maxMs);
    navigator.wakeLock?.request('screen').then((l) => { wakeLock = l; }).catch(() => {});
    navigator.vibrate?.(18);
  } catch (error) {
    abort(s);
    setState('idle', 'Could not start the microphone.');
    console.error(error);
  }
}

function resetButton() {
  button.classList.remove('active');
  button.textContent = 'Hold to listen';
  timerEl.textContent = '';
}

function abort(s) {
  s.ended = true;
  clearInterval(s.ticker);
  clearTimeout(s.timeout);
  releaseStream(s.stream);
  if (session === s) session = null;
  resetButton();
}

function stop(event) {
  event?.preventDefault();
  const s = session;
  if (!s || s.ended) return;
  s.ended = true;
  clearInterval(s.ticker);
  clearTimeout(s.timeout);
  resetButton();
  if (!s.recorder || s.recorder.state !== 'recording') { abort(s); return; } // released before recording began
  if (handsFree) cue(520);
  s.duration = Date.now() - s.startedAt;
  setState('analyzing', 'Working it out…');
  s.recorder.stop(); // -> onstop -> finish()
}

async function finish(s) {
  releaseStream(s.stream);
  if (session === s) session = null;
  if (s.duration < MIN_CAPTURE_MS) {
    setState('idle', 'That was brief — hold for 1–5 seconds.');
    return;
  }
  walkAddHold(s.duration);
  const blob = new Blob(s.chunks, { type: s.mime });
  if (blob.size === 0) { setState('idle', 'Nothing was captured — try again.'); return; }
  await sendSample(blob, s.mime);
}

// Shared by the server path and the on-device path: both produce the same result shape.
function handleJsonResult(data) {
  if (data.detected === false) {
    // Nothing clearly identified: stay quiet instead of guessing.
    speciesEl.textContent = 'Nothing identified';
    metaEl.textContent = `${data.message || "Couldn't pin that one down."} ${ForestTrail.missTip(missCount++)}`;
    setState('silent', 'Silence restored. Keep walking.');
    return;
  }
  const isNew = countObservation(data.species?.species_name, data.species?.source);
  walkAddIdent();
  const source = data.species?.source === 'demo' ? 'demo mode · ' : '';
  const note = data.narration?.spoken_text || '';
  showResult(data.species?.species_name || 'Nature observed', source + (note || data.message || ''), data.narration?.badge_title, isNew);
  // No ElevenLabs key: speak with the device's own voice, so the loop still works (and works offline).
  if (note && speak(note)) return;
  setState('silent', 'Silence restored. Keep walking.');
}

async function sendSample(blob, mime) {
  if (deviceOn) return sendSampleOnDevice(blob);
  const ext = mime.includes('mp4') ? 'm4a' : mime.includes('ogg') ? 'ogg' : 'webm';
  const form = new FormData();
  form.append('audio', blob, `trail-sample.${ext}`);
  form.append('streak', String(currentStreak()));
  form.append('local_hour', String(new Date().getHours()));
  if (userLoc) { form.append('lat', String(userLoc.lat)); form.append('lon', String(userLoc.lon)); }
  const waitStarted = Date.now();

  try {
    const response = await fetch('/api/v1/analyze', { method: 'POST', body: form });
    if (!response.ok) throw Error(await response.text());
    walkAddInteraction(Date.now() - waitStarted);

    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      handleJsonResult(await response.json());
      return;
    }

    const species = decodeURIComponent(response.headers.get('X-Species') || 'Nature observed');
    const badge = decodeURIComponent(response.headers.get('X-Badge') || 'Trail Tracker');
    const source = response.headers.get('X-Source') || 'unknown';
    const isNew = countObservation(species, source);
    walkAddIdent();
    showResult(species, `Observation ${observationCount} · ${source === 'demo' ? 'demo mode' : source}`, badge, isNew);

    const url = URL.createObjectURL(await response.blob());
    player.src = url;
    player.onended = () => { URL.revokeObjectURL(url); setState('silent', 'Silence restored. Keep walking.'); };
    try {
      await player.play();
      setState('responding', 'A little field note…');
    } catch (playError) {
      console.error(playError);
      setState('silent', 'Could not play audio — check your volume.');
    }
  } catch (error) {
    // fetch() rejects with a TypeError when the server cannot be reached at all.
    setState('idle', error instanceof TypeError
      ? "Can't reach your Forest Echo server. Stay within Wi-Fi range of the computer running it."
      : 'Could not analyze that sample. Nature is still there — try again.');
    console.error(error);
  } finally {
    try { await wakeLock?.release(); } catch (_) {}
    wakeLock = null;
  }
}

// ---------- On-device mode: BirdNET runs in this browser (WebAssembly), no server involved ----------
async function sendSampleOnDevice(blob) {
  const started = Date.now();
  try {
    if (!(await ForestOnDevice.status() === 'downloaded')) {
      setState('idle', 'On-device mode needs the offline pack. Open "On-device mode" below to download it.');
      return;
    }
    const data = await ForestOnDevice.analyze(blob, {
      lat: userLoc ? userLoc.lat : null,
      lon: userLoc ? userLoc.lon : null,
      week: ForestInvite.birdnetWeek(new Date()),
      streak: currentStreak(),
      localHour: new Date().getHours(),
    });
    walkAddInteraction(Date.now() - started);
    handleJsonResult(data);
  } catch (error) {
    setState('idle', 'Could not identify that on this phone. Try again, or switch back to your server.');
    console.error(error);
  } finally {
    try { await wakeLock?.release(); } catch (_) {}
    wakeLock = null;
  }
}

function renderDevice(state) {
  const supported = ForestOnDevice.supported();
  const have = state === 'downloaded';
  devicePack.hidden = !supported || have;
  deviceRemove.hidden = !have;
  deviceToggle.hidden = !have;
  deviceToggle.textContent = `Identify on this phone: ${deviceOn && have ? 'on' : 'off'}`;
  deviceToggle.setAttribute('aria-pressed', deviceOn && have ? 'true' : 'false');
  deviceSummary.textContent = deviceOn && have ? 'On-device mode: on' : 'On-device mode';
  if (!supported) deviceNote.textContent = 'This browser cannot run BirdNET on the phone (it needs Web Workers and WebAssembly).';
  else if (!have) deviceNote.textContent = 'Download the BirdNET models once, then identification runs on this phone with no server and no signal. Needs about 75 MB of space.';
  else deviceNote.textContent = deviceOn
    ? 'Sounds are identified on this phone. Nothing is sent anywhere.'
    : 'Offline pack ready. Switch it on to identify without your server.';
}

async function refreshDevice() {
  renderDevice(await ForestOnDevice.status());
}

async function downloadDevicePack() {
  devicePack.disabled = true;
  deviceProgress.hidden = false;
  deviceProgress.value = 0;
  deviceNote.textContent = 'Downloading… keep this page open.';
  try {
    if ('serviceWorker' in navigator && !navigator.serviceWorker.controller) {
      deviceNote.textContent = 'Reload the page once so offline caching is active, then try again.';
      return;
    }
    await ForestOnDevice.downloadPack((f) => { deviceProgress.value = Math.round(f * 100); });
    deviceOn = true;
    localStorage.setItem('forestEchoDevice', '1');
    deviceNote.textContent = 'Loading the models on this phone…';
    await ForestOnDevice.init();
  } catch (error) {
    deviceNote.textContent = `Download failed: ${error.message}`;
    console.error(error);
  } finally {
    devicePack.disabled = false;
    deviceProgress.hidden = true;
    await refreshDevice();
  }
}

async function toggleDevice() {
  deviceOn = !deviceOn;
  localStorage.setItem('forestEchoDevice', deviceOn ? '1' : '0');
  if (deviceOn) {
    deviceNote.textContent = 'Loading the models on this phone…';
    try { await ForestOnDevice.init(); } catch (error) { deviceNote.textContent = `Could not load the models: ${error.message}`; console.error(error); }
  }
  await refreshDevice();
  if (userLoc) loadNearby(); // the near-you list switches source too
}

async function removeDevicePack() {
  deviceOn = false;
  localStorage.setItem('forestEchoDevice', '0');
  await ForestOnDevice.removePack();
  await refreshDevice();
}

function countObservation(species, source) {
  observationCount += 1;
  localStorage.setItem('forestEchoObservations', String(observationCount));
  recordObservationDay();
  logSpecies(species, source);
  return recordLife(species, source); // true the first time this species is ever identified
}

// ---------- Life list: every real species you've ever identified (shown on screen only) ----------
function readLife() {
  try { return JSON.parse(localStorage.getItem('forestEchoLife')) || {}; } catch { return {}; }
}
function recordLife(species, source) {
  if (!species || source === 'demo') return false; // demo birds are placeholders, never counted
  const { list, isNew } = ForestTrail.addToLife(readLife(), species, Date.now());
  localStorage.setItem('forestEchoLife', JSON.stringify(list));
  renderLife();
  return isNew;
}
function renderLife() {
  const entries = ForestTrail.lifeEntries(readLife());
  lifeSummary.textContent = entries.length ? `Life list: ${entries.length} species` : 'Life list';
  lifeList.replaceChildren(...entries.map((e) => {
    const li = document.createElement('li');
    li.textContent = e.species;
    li.title = `First heard ${new Date(e.first).toLocaleDateString()}${e.n > 1 ? `, ${e.n} times` : ''}`;
    return li;
  }));
}

// "Heard this week" is shown on screen only, after the walk. Demo results are never counted.
const WEEK_MS = 7 * 86400000;
function readLog() {
  try { return JSON.parse(localStorage.getItem('forestEchoLog')) || []; } catch { return []; }
}
function logSpecies(species, source) {
  if (!species || source === 'demo') return;
  const log = readLog().filter((e) => Date.now() - e.t < WEEK_MS).slice(-199);
  log.push({ species, t: Date.now() });
  localStorage.setItem('forestEchoLog', JSON.stringify(log));
  renderWeek();
  if (userLoc) loadNearby();
}
function renderWeek() {
  const counts = new Map();
  for (const e of readLog()) if (Date.now() - e.t < WEEK_MS) counts.set(e.species, (counts.get(e.species) || 0) + 1);
  weekSummary.textContent = counts.size ? `Heard this week: ${counts.size} species` : 'Heard this week';
  weekList.replaceChildren(...[...counts].map(([name, n]) => {
    const li = document.createElement('li');
    li.textContent = n > 1 ? `${name} ×${n}` : name;
    return li;
  }));
  renderInvite();
}

// On-device speech fallback. Returns true if it started speaking.
function speak(text) {
  if (!('speechSynthesis' in window)) return false;
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 0.95;
  u.onend = u.onerror = () => { noteSpeaking = false; setState('silent', 'Silence restored. Keep walking.'); };
  noteSpeaking = true;
  setState('responding', 'A little field note…');
  speechSynthesis.speak(u);
  return true;
}

// One soft tick marks capture start (high) and end (low) in hands-free mode: the only non-speech sound.
let audioCtx = null;
function cue(freq) {
  try {
    audioCtx ||= new AudioContext();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.frequency.value = freq;
    gain.gain.value = 0.04;
    osc.connect(gain).connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.06);
  } catch (_) { /* cue is best-effort */ }
}

// Headphone play/pause starts a fixed capture, so the phone can stay in a pocket.
function onMediaButton() {
  keepalive.play().catch(() => {});
  navigator.mediaSession.playbackState = 'playing';
  const now = Date.now();
  if (session || noteSpeaking || !player.paused || now - lastTrigger < HANDS_FREE_COOLDOWN_MS) return;
  lastTrigger = now;
  beginCapture(HANDS_FREE_CAPTURE_MS);
}

async function toggleHandsFree() {
  if (handsFree) {
    handsFree = false;
    keepalive.pause();
    for (const a of ['play', 'pause', 'nexttrack', 'previoustrack']) { try { navigator.mediaSession.setActionHandler(a, null); } catch (_) {} }
    handsFreeBtn.textContent = 'Hands-free';
    handsFreeBtn.setAttribute('aria-pressed', 'false');
    return;
  }
  if (!micReady) await enableMic();
  if (!micReady || !('mediaSession' in navigator)) { setState('idle', 'Hands-free is not supported in this browser.'); return; }
  try {
    keepalive.loop = true;
    keepalive.src = KEEPALIVE;
    await keepalive.play();
    navigator.mediaSession.metadata = new MediaMetadata({ title: 'Forest Echo', artist: 'Press play/pause to identify a sound' });
    navigator.mediaSession.playbackState = 'playing';
    for (const a of ['play', 'pause', 'nexttrack', 'previoustrack']) { try { navigator.mediaSession.setActionHandler(a, onMediaButton); } catch (_) {} }
    handsFree = true;
    handsFreeBtn.textContent = 'Hands-free';
    handsFreeBtn.setAttribute('aria-pressed', 'true');
    setState('idle', 'Hands-free is on. Press your headphone button when something catches your ear.');
  } catch (error) {
    setState('idle', 'Hands-free needs audio playback to be allowed.');
    console.error(error);
  }
}

function showResult(species, meta, badge, isNew = false) {
  speciesEl.textContent = species;
  const parts = [meta, badge, isNew ? 'New to your life list' : ''].filter(Boolean);
  metaEl.textContent = parts.join(' · ');
}

// ---------- Walks: how much of a walk was the screen actually on? ----------
// Screen-on time = the page is visible AND the pocket-mode black overlay is not showing. It is measured
// with the Page Visibility API, so it covers everything you did on this page (holding, reading, browsing
// the lists), not just button holds. It cannot see what you do in other apps.
function readWalk() {
  try { return JSON.parse(localStorage.getItem('forestEchoActiveWalk')); } catch { return null; }
}
function saveWalk() {
  if (walk) localStorage.setItem('forestEchoActiveWalk', JSON.stringify(walk));
  else localStorage.removeItem('forestEchoActiveWalk');
}
function readWalks() {
  try { return JSON.parse(localStorage.getItem('forestEchoWalks')) || []; } catch { return []; }
}
function screenLit() { return document.visibilityState === 'visible' && !pocketScreen.classList.contains('on'); }
function syncScreenClock() {
  if (!walk) return;
  Object.assign(walk, ForestTrail.setLit(walk, screenLit(), Date.now()));
  saveWalk();
}
function walkAddHold(ms) { if (walk) { walk.holds += 1; walk.interactMs += ms || 0; saveWalk(); } }
function walkAddInteraction(ms) { if (walk) { walk.interactMs += ms; saveWalk(); } }
function walkAddIdent() { if (walk) { walk.idents += 1; saveWalk(); } }

function summarize(w) { return ForestTrail.walkSummary(w); }
function renderWalk() {
  walkBtn.textContent = walk ? 'End walk' : 'Start walk';
  walkBtn.setAttribute('aria-pressed', walk ? 'true' : 'false');
  if (walk) { walkInfo.textContent = 'Walking. Phone away.'; return; }
  const last = readWalks().at(-1);
  walkInfo.textContent = last ? `Last: ${summarize(last)}` : '';
}
function toggleWalk() {
  if (walk) {
    walk = { ...walk, ...ForestTrail.setLit(walk, false, Date.now()) }; // flush the screen clock
    const done = { ...walk, end: Date.now() };
    const walks = readWalks().slice(-19);
    walks.push(done);
    localStorage.setItem('forestEchoWalks', JSON.stringify(walks));
    walk = null;
  } else {
    walk = { start: Date.now(), holds: 0, idents: 0, interactMs: 0, litMs: 0, litSince: null };
    syncScreenClock();
  }
  saveWalk();
  renderWalk();
  renderInvite();
}

// ---------- Likely near you this week (opt-in location) ----------
function roundCoord(x) { return Math.round(x * 100) / 100; } // ~1 km

// Only the opt-in *preference* is remembered, never the coordinates: they are read fresh each visit.
function acquireLocation() {
  if (!navigator.geolocation) { nearbyNote.textContent = 'Location is not available in this browser.'; return; }
  nearbyNote.textContent = 'Finding where you are…';
  navigator.geolocation.getCurrentPosition(async (pos) => {
    userLoc = { lat: roundCoord(pos.coords.latitude), lon: roundCoord(pos.coords.longitude) };
    localStorage.setItem('forestEchoLocOptIn', '1');
    useLocBtn.textContent = 'Stop using my location';
    useLocBtn.setAttribute('aria-pressed', 'true');
    renderInvite();
    await loadNearby();
  }, () => { nearbyNote.textContent = 'Location permission was not granted.'; }, { maximumAge: 600000, timeout: 15000 });
}

async function toggleLocation() {
  if (userLoc) {
    userLoc = null;
    lastNearby = null;
    localStorage.removeItem('forestEchoLocOptIn');
    useLocBtn.textContent = 'Use my location';
    useLocBtn.setAttribute('aria-pressed', 'false');
    nearbyList.replaceChildren();
    nearbySummary.textContent = 'Near you this week';
    renderInvite();
    return;
  }
  acquireLocation();
}

// If they opted in before and the browser already granted permission, restore quietly (no prompt).
async function restoreLocation() {
  if (localStorage.getItem('forestEchoLocOptIn') !== '1' || !navigator.geolocation || !navigator.permissions) return;
  try {
    const status = await navigator.permissions.query({ name: 'geolocation' });
    if (status.state === 'granted') acquireLocation();
  } catch (_) { /* no silent restore; the button still works */ }
}

async function loadNearby() {
  try {
    let data;
    if (deviceOn && (await ForestOnDevice.status()) === 'downloaded') {
      data = { source: 'on-device', species: await ForestOnDevice.nearby(userLoc.lat, userLoc.lon, ForestInvite.birdnetWeek(new Date())) };
    } else {
      const res = await fetch('/api/v1/nearby', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(userLoc) });
      if (!res.ok) throw Error(await res.text());
      data = await res.json();
    }
    lastNearby = data;
    renderInvite();
    const heard = new Set(readLog().filter((e) => Date.now() - e.t < WEEK_MS).map((e) => e.species.toLowerCase()));
    const items = data.species.map((sp) => {
      const li = document.createElement('li');
      const got = heard.has(sp.species_name.toLowerCase());
      li.className = got ? 'heard' : '';
      li.textContent = `${got ? '✓ ' : ''}${sp.species_name}`;
      return li;
    });
    nearbyList.replaceChildren(...items);
    const got = items.filter((li) => li.className === 'heard').length;
    nearbySummary.textContent = data.source === 'demo' ? 'Near you (demo list)' : `Near you: ${got} of ${items.length} heard`;
    nearbyNote.textContent = data.source === 'demo'
      ? 'Demo mode: this is a placeholder list, not a prediction for your location.'
      : data.source === 'on-device'
        ? 'Predicted on this phone by the open BirdNET geo model for your area and week. Your location never leaves the phone.'
        : 'Predicted by the open BirdNET geo model for your area and week. Your location is rounded and not stored.';
  } catch (error) {
    nearbyNote.textContent = 'Could not load nearby species.';
    console.error(error);
  }
}

// ---------- Quiet invitations: reasons to step out, on screen only, never spoken or pushed ----------
// Shown only when the app is opened. No notifications, no sounds, no streak guilt.
function heardThisWeek() {
  return new Set(readLog().filter((e) => Date.now() - e.t < WEEK_MS).map((e) => e.species.toLowerCase()));
}

function renderInvite() {
  const now = new Date();
  inviteWindow.textContent = ForestInvite.windowLine(now, userLoc?.lat, userLoc?.lon);

  const target = lastNearby ? ForestInvite.pickTarget(lastNearby.species, ForestInvite.weekKey(now)) : null;
  inviteLocBtn.hidden = Boolean(userLoc);
  if (target) {
    const name = target.species_name;
    const demo = lastNearby.source === 'demo' ? ' (demo list)' : '';
    inviteTarget.textContent = heardThisWeek().has(name.toLowerCase())
      ? `✓ You heard the ${name} this week.${demo}`
      : `This week, listen for: ${name}.${demo}`;
  } else {
    inviteTarget.textContent = userLoc ? '' : 'A short walk is plenty.';
  }

  const days = ForestInvite.outdoorDays(readWalks(), readLog(), now);
  const count = days.filter(Boolean).length;
  inviteDays.replaceChildren(...days.map((d, i) => {
    const dot = document.createElement('i');
    if (d) dot.className = 'on';
    dot.style.setProperty('--i', i);
    return dot;
  }));
  inviteDays.setAttribute('aria-label', `Outdoors on ${count} of the last 7 days`);
  inviteDaysNote.textContent = count ? `Outdoors ${count} of the last 7 days.` : 'Even ten minutes outside counts.';
}

function addQuietReminder() {
  const now = new Date();
  let w = ForestInvite.bestWindow(now, userLoc?.lat, userLoc?.lon);
  if (now >= w.start) w = ForestInvite.bestWindow(new Date(now.getTime() + 86400000), userLoc?.lat, userLoc?.lon);
  const start = ForestInvite.roundMinutes(w.start, 5);
  const ics = ForestInvite.buildIcs({
    title: 'Step out and listen',
    description: 'A quiet listen outdoors. Leave the phone in your pocket and let the real sounds do the talking.',
    start,
    durationMin: 30,
    weekly: true,
  });
  const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = 'forest-echo-reminder.ics';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  const when = start.toLocaleDateString([], { weekday: 'long' });
  inviteCalNote.textContent = `Saved: weekly ${when}, ${ForestInvite.fmtTime(start)}. Edit or delete it in your calendar.`;
}

inviteCalBtn.addEventListener('click', addQuietReminder);
inviteLocBtn.addEventListener('click', toggleLocation);
document.addEventListener('visibilitychange', () => { syncScreenClock(); if (document.visibilityState === 'visible') renderInvite(); });

handsFreeBtn.addEventListener('click', toggleHandsFree);
pocketToggle.addEventListener('click', togglePocket);
pocketScreen.addEventListener('click', wakeScreen);
pocketScreen.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); wakeScreen(); } });
walkBtn.addEventListener('click', toggleWalk);
useLocBtn.addEventListener('click', toggleLocation);
if (walk) { walk.litSince = null; saveWalk(); syncScreenClock(); } // a reload mid-walk: time while closed is not screen time
devicePack.addEventListener('click', downloadDevicePack);
deviceToggle.addEventListener('click', toggleDevice);
deviceRemove.addEventListener('click', removeDevicePack);
refreshDevice();
renderLife();
renderWalk();
renderWeek();
button.textContent = 'Enable microphone';
setState('idle', 'Tap once to allow the microphone.');
button.addEventListener('pointerdown', start);
button.addEventListener('pointerup', stop);
button.addEventListener('pointercancel', stop);
button.addEventListener('pointerleave', stop);
window.addEventListener('blur', () => stop());
restoreLocation();
renderPocket();

// Cache the app shell so the page itself opens with no connection (needs HTTPS or localhost).
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
