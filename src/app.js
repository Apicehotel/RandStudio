import { createProject, addClip, addTrack, moveClip, splitClip, removeClip, projectDuration, validateProject } from './core/composition.js';
import { HistoryStore } from './core/history.js';
import { compileProject } from './core/ffmpeg-compiler.js';
import { renderWithFFmpeg } from './adapters/ffmpeg-wasm.js';
import { applyPreset, cssFilter } from './effects/effects-engine.js';

const $ = (s) => document.querySelector(s);
const media = new Map();
let store = new HistoryStore(createProject());
let selected = null;
let currentTime = 0;
let playing = false;
let raf = null;
const pxPerSecond = 80;

const ui = {
  mediaInput: $('#mediaInput'), projectInput: $('#projectInput'), mediaList: $('#mediaList'), dropZone: $('#dropZone'), tracks: $('#timelineTracks'), ruler: $('#ruler'), duration: $('#durationLabel'), playhead: $('#playhead'), time: $('#timeLabel'), previewLabel: $('#previewLabel'), image: $('#imagePreview'), video: $('#videoPreview'), audio: $('#audioPreview'), empty: $('#emptyPreview'), inspector: $('#clipInspector'), inspectorEmpty: $('#inspectorEmpty'), clipName: $('#clipName'), clipStart: $('#clipStart'), clipDuration: $('#clipDuration'), clipIn: $('#clipIn'), clipOut: $('#clipOut'), clipScale: $('#clipScale'), clipRotation: $('#clipRotation'), undo: $('#undoBtn'), redo: $('#redoBtn'), engine: $('#engineStatus'), progress: $('#exportProgress'),
};

ui.mediaInput.onchange = (e) => importFiles([...e.target.files]);
for (const ev of ['dragenter', 'dragover']) ui.dropZone.addEventListener(ev, (e) => { e.preventDefault(); ui.dropZone.classList.add('drag'); });
for (const ev of ['dragleave', 'drop']) ui.dropZone.addEventListener(ev, (e) => { e.preventDefault(); ui.dropZone.classList.remove('drag'); });
ui.dropZone.addEventListener('drop', (e) => importFiles([...e.dataTransfer.files]));
ui.undo.onclick = () => { store.undo(); selected = null; render(); };
ui.redo.onclick = () => { store.redo(); selected = null; render(); };
$('#addVideoTrackBtn').onclick = () => commit(addTrack(store.value, 'visual'));
$('#addAudioTrackBtn').onclick = () => commit(addTrack(store.value, 'audio'));
$('#splitBtn').onclick = () => { if (selected) commit(splitClip(store.value, selected.trackId, selected.clipId, currentTime)); };
$('#deleteClipBtn').onclick = () => { if (selected) { commit(removeClip(store.value, selected.trackId, selected.clipId)); selected = null; } };
$('#saveProjectBtn').onclick = saveProject;
ui.projectInput.onchange = (e) => openProject(e.target.files[0]);
$('#exportVideoBtn').onclick = exportVideo;
ui.playhead.oninput = (e) => { currentTime = +e.target.value; syncPreviewToPlayhead(); updateTransport(); };
$('#playBtn').onclick = togglePlay;
for (const input of [ui.clipName, ui.clipStart, ui.clipDuration, ui.clipIn, ui.clipOut, ui.clipScale, ui.clipRotation]) input.addEventListener('change', updateSelectedFromInspector);

document.querySelectorAll('[data-effect-preset]').forEach((button) => button.addEventListener('click', () => applyEffectPreset(button.dataset.effectPreset)));
document.querySelectorAll('[data-ai-motion]').forEach((button) => button.addEventListener('click', () => {
  ui.engine.textContent = `AI Lab predisposto: ${button.dataset.aiMotion}. Collega ComfyUI/Wan per generare.`;
}));
$('#largeModeBtn')?.addEventListener('click', () => {
  const enabled = document.documentElement.classList.toggle('large-mode');
  localStorage.setItem('randstudio-large-mode', enabled ? '1' : '0');
});
if (localStorage.getItem('randstudio-large-mode') === '1') document.documentElement.classList.add('large-mode');

async function importFiles(files) {
  for (const file of files) {
    const type = mediaType(file);
    if (!type) continue;
    const id = crypto.randomUUID();
    const duration = await getDuration(file, type);
    media.set(id, { id, file, type, name: file.name, duration, url: URL.createObjectURL(file), virtualName: `${id}.${extension(file.name) || defaultExt(type)}` });
  }
  ui.mediaInput.value = '';
  renderMedia();
}

function addMediaToTimeline(id) {
  const item = media.get(id); if (!item) return;
  const p = store.value;
  const t = p.tracks.find((x) => x.kind === (item.type === 'audio' ? 'audio' : 'visual'));
  const start = Math.max(0, ...t.clips.map((c) => c.end), 0);
  const duration = item.type === 'image' ? 5 : Math.max(.1, item.duration || 5);
  commit(addClip(p, t.id, { sourceId: id, sourceName: item.name, name: item.name, type: item.type, start, in: 0, out: duration, duration }));
}

function render() {
  const p = store.value;
  ui.undo.disabled = !store.canUndo; ui.redo.disabled = !store.canRedo;
  const duration = Math.max(1, projectDuration(p));
  ui.duration.textContent = `${duration.toFixed(1)} s`; ui.playhead.max = String(duration);
  ui.ruler.style.width = `${Math.max(800, duration * pxPerSecond)}px`; ui.tracks.innerHTML = '';
  for (const track of p.tracks) {
    const row = document.createElement('div'); row.className = `track-row ${track.kind === 'audio' ? 'audio' : ''}`;
    const label = document.createElement('div'); label.className = 'track-label'; label.textContent = track.name;
    const lane = document.createElement('div'); lane.className = 'track-lane'; lane.style.width = `${Math.max(800, duration * pxPerSecond)}px`;
    for (const clip of track.clips) lane.appendChild(renderClip(track, clip));
    row.append(label, lane); ui.tracks.append(row);
  }
  renderInspector(); syncPreviewToPlayhead(); updateTransport();
}

function renderClip(track, clip) {
  const el = document.createElement('div'); el.className = 'clip';
  if (selected?.clipId === clip.id) el.classList.add('selected'); if (!media.has(clip.sourceId)) el.classList.add('missing');
  el.style.left = `${clip.start * pxPerSecond}px`; el.style.width = `${Math.max(28, (clip.end - clip.start) * pxPerSecond)}px`;
  const fx = clip.effects?.length ? ` · ${clip.effects.length} FX` : '';
  el.innerHTML = `<strong>${escapeHtml(clip.name)}</strong><span>${clip.start.toFixed(1)} → ${clip.end.toFixed(1)}${fx}</span>`;
  el.onclick = (e) => { e.stopPropagation(); selected = { trackId: track.id, clipId: clip.id }; currentTime = Math.max(clip.start, Math.min(currentTime, clip.end)); render(); };
  el.onpointerdown = (e) => beginDrag(e, el, track.id, clip.id, clip.start);
  return el;
}

function beginDrag(event, el, trackId, clipId, start) {
  if (event.button !== 0) return; const origin = event.clientX; el.setPointerCapture(event.pointerId); el.dataset.dragging = 'true';
  const move = (e) => { const d = (e.clientX - origin) / pxPerSecond; el.style.left = `${Math.max(0, start + d) * pxPerSecond}px`; };
  const end = (e) => { el.releasePointerCapture?.(e.pointerId); el.dataset.dragging = 'false'; el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', end); commit(moveClip(store.value, trackId, clipId, round2(Math.max(0, start + (e.clientX - origin) / pxPerSecond)))); };
  el.addEventListener('pointermove', move); el.addEventListener('pointerup', end);
}

function renderMedia() {
  ui.mediaList.innerHTML = '';
  for (const item of media.values()) {
    const div = document.createElement('div'); div.className = 'media-item';
    div.innerHTML = `<div class="media-thumb">${item.type === 'video' ? '▶' : item.type === 'audio' ? '♫' : '▧'}</div><div class="media-meta"><strong>${escapeHtml(item.name)}</strong><span>${item.type} · ${(item.duration || 0).toFixed(1)} s</span></div>`;
    const actions = document.createElement('div'); actions.className = 'media-actions';
    const add = document.createElement('button'); add.textContent = '+'; add.onclick = () => addMediaToTimeline(item.id);
    const preview = document.createElement('button'); preview.textContent = '▶'; preview.onclick = () => showMedia(item);
    actions.append(preview, add); div.append(actions); ui.mediaList.append(div);
  }
}

function renderInspector() {
  const f = selected && findClip(store.value, selected.trackId, selected.clipId);
  ui.inspector.hidden = !f; ui.inspectorEmpty.hidden = !!f; if (!f) return;
  const c = f.clip; ui.clipName.value = c.name; ui.clipStart.value = c.start.toFixed(2); ui.clipDuration.value = (c.end - c.start).toFixed(2); ui.clipIn.value = c.in.toFixed(2); ui.clipOut.value = c.out.toFixed(2); ui.clipScale.value = c.transform?.scale ?? 1; ui.clipRotation.value = c.transform?.rotation ?? 0;
  document.querySelectorAll('[data-effect-preset]').forEach((b) => b.classList.toggle('selected-preset', b.dataset.effectPreset === c.effectPreset));
}

function updateSelectedFromInspector() {
  if (!selected) return; const p = store.value, f = findClip(p, selected.trackId, selected.clipId); if (!f) return; const c = f.clip;
  c.name = ui.clipName.value || c.name; const start = Math.max(0, +ui.clipStart.value || 0), duration = Math.max(.05, +ui.clipDuration.value || .05), i = Math.max(0, +ui.clipIn.value || 0), o = Math.max(i + .05, +ui.clipOut.value || duration);
  c.start = start; c.end = start + duration; c.in = i; c.out = o; c.transform = { ...(c.transform || {}), scale: +ui.clipScale.value || 1, rotation: +ui.clipRotation.value || 0 }; commit(p);
}

function applyEffectPreset(presetId) {
  if (!selected) { ui.engine.textContent = 'Seleziona una clip prima di applicare un effetto.'; return; }
  const p = store.value, f = findClip(p, selected.trackId, selected.clipId); if (!f) return;
  const updated = applyPreset(f.clip, presetId); Object.assign(f.clip, updated, { effectPreset: presetId }); commit(p);
  ui.engine.textContent = `Preset ${presetId.toUpperCase()} applicato. Preview + export sincronizzati.`;
}

function syncPreviewToPlayhead() {
  const active = store.value.tracks.flatMap((track) => track.clips.map((clip) => ({ track, clip }))).filter(({ clip }) => currentTime >= clip.start && currentTime < clip.end).sort((a, b) => a.track.kind === 'audio' ? 1 : -1)[0];
  if (active) { selected = { trackId: active.track.id, clipId: active.clip.id }; const item = media.get(active.clip.sourceId); if (item) showMedia(item, active.clip, currentTime); }
}

function showMedia(item, clip = null, t = 0) {
  [ui.image, ui.video, ui.audio].forEach((el) => { el.hidden = true; }); ui.empty.hidden = true; ui.previewLabel.textContent = item.name;
  if (item.type === 'image') { ui.image.src = item.url; ui.image.hidden = false; applyVisualState(ui.image, clip); }
  else if (item.type === 'video') { if (ui.video.src !== item.url) ui.video.src = item.url; ui.video.hidden = false; applyVisualState(ui.video, clip); if (clip && Number.isFinite(ui.video.duration)) ui.video.currentTime = Math.max(clip.in, t - clip.start + clip.in); }
  else { if (ui.audio.src !== item.url) ui.audio.src = item.url; ui.audio.hidden = false; if (clip && Number.isFinite(ui.audio.duration)) ui.audio.currentTime = Math.max(clip.in, t - clip.start + clip.in); }
}
function applyVisualState(el, clip) { const t = clip?.transform || {}; el.style.transform = `translate(${t.x || 0}px,${t.y || 0}px) scale(${t.scale || 1}) rotate(${t.rotation || 0}deg)`; el.style.filter = cssFilter(clip?.effects || []); }

function updateTransport() { ui.playhead.value = String(Math.min(+ui.playhead.max, currentTime)); ui.time.textContent = formatTime(currentTime); }
function togglePlay() { playing = !playing; $('#playBtn').textContent = playing ? '❚❚' : '▶'; if (playing) { let last = performance.now(); const tick = (now) => { if (!playing) return; currentTime += Math.max(0, (now - last) / 1000); last = now; if (currentTime >= +ui.playhead.max) { currentTime = 0; playing = false; $('#playBtn').textContent = '▶'; } syncPreviewToPlayhead(); updateTransport(); if (playing) raf = requestAnimationFrame(tick); }; raf = requestAnimationFrame(tick); } else if (raf) cancelAnimationFrame(raf); }
function saveProject() { download(new Blob([JSON.stringify(store.value, null, 2)], { type: 'application/json' }), `${safeName(store.value.name)}.randstudio.json`); }
async function openProject(file) { if (!file) return; try { const data = JSON.parse(await file.text()), errors = validateProject(data); if (errors.length) throw new Error(errors.join('; ')); store = new HistoryStore(data); selected = null; currentTime = 0; render(); } catch (error) { alert(`Progetto non valido: ${error.message}`); } }
async function exportVideo() { try { ui.engine.textContent = 'Preparazione export…'; ui.progress.value = 0; const compiled = compileProject(store.value, media); ui.engine.textContent = 'Caricamento FFmpeg / rendering locale…'; const blob = await renderWithFFmpeg(compiled, (p) => { ui.progress.value = p; }); download(blob, compiled.outputName); ui.engine.textContent = 'Export completato'; ui.progress.value = 1; } catch (error) { console.error(error); ui.engine.textContent = `Export non riuscito: ${error.message}`; } }
function commit(next) { store.commit(next); render(); }
function findClip(p, trackId, clipId) { const track = p.tracks.find((t) => t.id === trackId), clip = track?.clips.find((c) => c.id === clipId); return clip ? { track, clip } : null; }
function mediaType(f) { if (f.type.startsWith('video/')) return 'video'; if (f.type.startsWith('audio/')) return 'audio'; if (f.type.startsWith('image/')) return 'image'; return null; }
async function getDuration(file, type) { if (type === 'image') return 5; return new Promise((resolve) => { const el = document.createElement(type === 'audio' ? 'audio' : 'video'), url = URL.createObjectURL(file); el.preload = 'metadata'; el.onloadedmetadata = () => { const d = Number.isFinite(el.duration) ? el.duration : 5; URL.revokeObjectURL(url); resolve(d); }; el.onerror = () => { URL.revokeObjectURL(url); resolve(5); }; el.src = url; }); }
function extension(n) { return n.includes('.') ? n.split('.').pop().toLowerCase() : ''; }
function defaultExt(t) { return t === 'audio' ? 'mp3' : t === 'image' ? 'png' : 'mp4'; }
function download(blob, name) { const a = document.createElement('a'), url = URL.createObjectURL(blob); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
function safeName(n) { return (n || 'randstudio-project').replace(/[^a-z0-9_-]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'randstudio-project'; }
function escapeHtml(s) { return String(s).replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c])); }
function formatTime(v) { const m = Math.floor(v / 60), s = Math.floor(v % 60), ms = Math.floor(v % 1 * 1000); return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms).padStart(3, '0')}`; }
function round2(v) { return Math.round(v * 100) / 100; }

window.addEventListener('beforeunload', () => { for (const item of media.values()) URL.revokeObjectURL(item.url); });
render(); renderMedia();
