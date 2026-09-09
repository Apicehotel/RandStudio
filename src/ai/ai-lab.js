import { ComfyUIAdapter } from '../adapters/comfyui.js';
import { AIJobQueue } from './job-queue.js';
import { DRONE_PRESETS, createWanCameraRequest, bindWanCameraWorkflow, discoverWanCameraBindings } from './wan-camera.js';

const $ = (selector) => document.querySelector(selector);
const ui = {
  dialog: $('#aiDialog'), open: $('#openAiBtn'), close: $('#closeAiBtn'), endpoint: $('#comfyEndpoint'), test: $('#testComfyBtn'), status: $('#comfyStatus'),
  workflow: $('#wanWorkflowInput'), workflowName: $('#workflowName'), bindings: $('#wanBindingsInput'), bindingName: $('#bindingName'), preset: $('#cameraPreset'),
  prompt: $('#aiPrompt'), width: $('#aiWidth'), height: $('#aiHeight'), frames: $('#aiFrames'), speed: $('#aiSpeed'), seed: $('#aiSeed'), run: $('#runAiBtn'), interrupt: $('#interruptAiBtn'), jobs: $('#aiJobs')
};

let workflow = null;
let bindings = null;
let running = false;
const queue = new AIJobQueue();
queue.subscribe(renderJobs);

for (const [id, preset] of Object.entries(DRONE_PRESETS)) {
  const option = document.createElement('option'); option.value = id; option.textContent = preset.label || id; ui.preset.append(option);
}
ui.endpoint.value = localStorage.getItem('randstudio.comfy.endpoint') || 'http://127.0.0.1:8188';
ui.prompt.value = 'Cinematic hotel reveal, smooth natural camera motion, realistic details';
ui.open.onclick = () => ui.dialog.showModal();
ui.close.onclick = () => ui.dialog.close();
ui.endpoint.onchange = () => localStorage.setItem('randstudio.comfy.endpoint', ui.endpoint.value.trim());
ui.test.onclick = testConnection;
ui.workflow.onchange = loadWorkflow;
ui.bindings.onchange = loadBindings;
ui.run.onclick = queueJob;
ui.interrupt.onclick = async () => { try { await adapter().interrupt(); ui.status.textContent = 'Interrupt inviato a ComfyUI'; } catch (error) { ui.status.textContent = `Interrupt fallito: ${error.message}`; } };

async function testConnection() {
  ui.status.textContent = 'Connessione…';
  try { const stats = await adapter().systemStats(); ui.status.textContent = `ComfyUI online · ${stats?.system?.os || 'server pronto'}`; }
  catch (error) { ui.status.textContent = `ComfyUI offline: ${error.message}`; }
}

async function loadWorkflow(event) {
  const file = event.target.files?.[0]; if (!file) return;
  try {
    const parsed = JSON.parse(await file.text());
    if (Array.isArray(parsed.nodes)) throw new Error('Serve il workflow esportato in API format');
    workflow = parsed;
    bindings = discoverWanCameraBindings(workflow);
    ui.workflowName.textContent = file.name;
    ui.bindingName.textContent = `Auto: ${formatBindings(bindings)}`;
    ui.status.textContent = 'Workflow Wan pronto';
  } catch (error) {
    workflow = null; bindings = null; ui.workflowName.textContent = 'Nessun workflow'; ui.bindingName.textContent = 'Nessun binding'; ui.status.textContent = `Workflow non valido: ${error.message}`;
  }
}

async function loadBindings(event) {
  const file = event.target.files?.[0]; if (!file) return;
  try { bindings = JSON.parse(await file.text()); ui.bindingName.textContent = `${file.name}: ${formatBindings(bindings)}`; ui.status.textContent = 'Binding personalizzati caricati'; }
  catch (error) { ui.status.textContent = `Binding non validi: ${error.message}`; }
}

function queueJob() {
  if (!workflow) return ui.status.textContent = 'Carica prima un workflow Wan Camera API';
  if (!bindings) return ui.status.textContent = 'Binding Wan non disponibili';
  if (!window.RandStudioBridge) return ui.status.textContent = 'Bridge RandStudio non disponibile';
  const preset = DRONE_PRESETS[ui.preset.value] || DRONE_PRESETS.reveal;
  queue.add({ kind:'wan-camera', input:{ endpoint:ui.endpoint.value.trim(), workflow, bindings, prompt:ui.prompt.value, motion:preset.motion, width:+ui.width.value, height:+ui.height.value, length:+ui.frames.value, speed:+ui.speed.value || preset.speed, seed:+ui.seed.value } });
  pump();
}

async function pump() {
  if (running) return;
  const job = queue.list().find((item) => item.status === 'queued');
  if (!job) return;
  running = true;
  queue.update(job.id, { status:'running', progress:.02 });
  try {
    const bridge = window.RandStudioBridge;
    const source = await bridge.getAIInput();
    if (!source?.file) throw new Error('Seleziona una clip foto/video; per un video viene usato il frame al playhead');
    const client = new ComfyUIAdapter({ baseUrl:job.input.endpoint });
    await client.systemStats(); queue.update(job.id, { progress:.08 });
    const inputImageName = await client.uploadImage(source.file); queue.update(job.id, { progress:.18 });
    const request = createWanCameraRequest({ prompt:job.input.prompt, motion:job.input.motion, width:job.input.width, height:job.input.height, length:job.input.length, speed:job.input.speed, seed:job.input.seed, inputImageName });
    const patched = bindWanCameraWorkflow(job.input.workflow, request, job.input.bindings);
    const queued = await client.enqueue(patched); queue.update(job.id, { promptId:queued.promptId, progress:.25 });
    const history = await client.waitForPrompt(queued.promptId, { onProgress:(value) => queue.update(job.id, { progress:.25 + value * .65 }) });
    const descriptor = client.firstOutput(history); if (!descriptor) throw new Error('ComfyUI ha completato il job senza output media');
    const blob = await client.downloadOutput(descriptor); queue.update(job.id, { progress:.95 });
    const ext = descriptor.filename.split('.').pop() || 'mp4';
    const name = `AI-${ui.preset.value}-${Date.now()}.${ext}`;
    const mediaId = await bridge.importGeneratedBlob(blob, name);
    bridge.addGeneratedToTimeline(mediaId, { afterSelection:true, ai:{ engine:'comfyui-wan-camera', promptId:queued.promptId, preset:ui.preset.value, motion:request.motion } });
    queue.update(job.id, { status:'completed', progress:1, output:{ mediaId, name, descriptor } });
    ui.status.textContent = `Completato: ${name}`;
  } catch (error) {
    queue.update(job.id, { status:'failed', error:error?.message || String(error) });
    ui.status.textContent = `AI fallita: ${error?.message || error}`;
  } finally { running = false; pump(); }
}

function renderJobs(jobs) {
  ui.jobs.innerHTML = '';
  if (!jobs.length) { ui.jobs.innerHTML = '<span class="muted">Nessun job.</span>'; return; }
  for (const job of jobs) {
    const row = document.createElement('div'); row.className = `ai-job ${job.status}`;
    row.innerHTML = `<div><strong>${escapeHtml(job.kind || 'AI')}</strong><span>${escapeHtml(job.status)}</span></div><progress max="1" value="${job.progress || 0}"></progress>${job.promptId ? `<small>${escapeHtml(job.promptId)}</small>` : ''}${job.error ? `<small>${escapeHtml(job.error)}</small>` : ''}`;
    ui.jobs.append(row);
  }
}
function adapter(){ return new ComfyUIAdapter({ baseUrl:ui.endpoint.value.trim() }); }
function formatBindings(value){ return Object.entries(value || {}).map(([key,b]) => `${key}:${b?.[0]}.${b?.[1]}`).join(' · '); }
function escapeHtml(value){return String(value).replace(/[&<>'\"]/g,(c)=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
