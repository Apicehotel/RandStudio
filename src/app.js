import { createProject, addClip, addTrack, moveClip, splitClip, removeClip, projectDuration, validateProject } from './core/composition.js';
import { HistoryStore } from './core/history.js';
import { compileProject } from './core/ffmpeg-compiler.js';
import { renderWithFFmpeg } from './adapters/ffmpeg-wasm.js';
import { ComfyUIAdapter } from './adapters/comfyui.js';
import { applyPreset, cssFilter, effect, updateEffect } from './effects/effects-engine.js';
import { setKeyframe, evaluateEffect } from './effects/keyframes.js';
import { parseCubeLUT, renderLUTToCanvas } from './effects/lut.js';
import { WebGPUEffectsRenderer } from './effects/webgpu-renderer.js';
import { RandStudioDB } from './persistence/indexeddb.js';
import { createDefaultRegistry } from './ai/provider-registry.js';
import { createWanCameraRequest } from './ai/wan-camera.js';

const $ = (s) => document.querySelector(s);
const media = new Map();
const db = new RandStudioDB();
const comfy = new ComfyUIAdapter();
let store = new HistoryStore(createProject());
let selected = null;
let currentTime = 0;
let playing = false;
let raf = null;
const pxPerSecond = 80;
const ui = {
  mediaInput:$('#mediaInput'),projectInput:$('#projectInput'),mediaList:$('#mediaList'),dropZone:$('#dropZone'),tracks:$('#timelineTracks'),ruler:$('#ruler'),duration:$('#durationLabel'),playhead:$('#playhead'),time:$('#timeLabel'),previewLabel:$('#previewLabel'),image:$('#imagePreview'),video:$('#videoPreview'),audio:$('#audioPreview'),canvas:$('#gpuCanvas'),empty:$('#emptyPreview'),inspector:$('#clipInspector'),inspectorEmpty:$('#inspectorEmpty'),clipName:$('#clipName'),clipStart:$('#clipStart'),clipDuration:$('#clipDuration'),clipIn:$('#clipIn'),clipOut:$('#clipOut'),clipScale:$('#clipScale'),clipRotation:$('#clipRotation'),brightness:$('#brightnessAmount'),keyframeStatus:$('#keyframeStatus'),undo:$('#undoBtn'),redo:$('#redoBtn'),engine:$('#engineStatus'),progress:$('#exportProgress'),gpuStatus:$('#gpuStatus'),storageStatus:$('#storageStatus'),gateway:$('#aiGatewayEndpoint'),aiStatus:$('#aiProviderStatus')
};
const gpuRenderer = new WebGPUEffectsRenderer(ui.canvas);

ui.mediaInput.onchange=e=>importFiles([...e.target.files]);
for(const ev of['dragenter','dragover'])ui.dropZone.addEventListener(ev,e=>{e.preventDefault();ui.dropZone.classList.add('drag')});
for(const ev of['dragleave','drop'])ui.dropZone.addEventListener(ev,e=>{e.preventDefault();ui.dropZone.classList.remove('drag')});
ui.dropZone.addEventListener('drop',e=>importFiles([...e.dataTransfer.files]));
ui.undo.onclick=()=>{store.undo();selected=null;persistProject();render()};
ui.redo.onclick=()=>{store.redo();selected=null;persistProject();render()};
$('#addVideoTrackBtn').onclick=()=>commit(addTrack(store.value,'visual'));
$('#addAudioTrackBtn').onclick=()=>commit(addTrack(store.value,'audio'));
$('#splitBtn').onclick=()=>{if(selected)commit(splitClip(store.value,selected.trackId,selected.clipId,currentTime))};
$('#deleteClipBtn').onclick=()=>{if(selected){commit(removeClip(store.value,selected.trackId,selected.clipId));selected=null}};
$('#saveProjectBtn').onclick=saveProject;
ui.projectInput.onchange=e=>openProject(e.target.files[0]);
$('#exportVideoBtn').onclick=exportVideo;
ui.playhead.oninput=e=>{currentTime=+e.target.value;syncPreviewToPlayhead();updateTransport()};
$('#playBtn').onclick=togglePlay;
for(const input of[ui.clipName,ui.clipStart,ui.clipDuration,ui.clipIn,ui.clipOut,ui.clipScale,ui.clipRotation])input.addEventListener('change',updateSelectedFromInspector);
ui.brightness?.addEventListener('input',()=>previewBrightness());
ui.brightness?.addEventListener('change',()=>commitBrightness());
$('#addBrightnessKeyframeBtn')?.addEventListener('click',addBrightnessKeyframe);
$('#clearLutBtn')?.addEventListener('click',clearLUT);
document.querySelectorAll('[data-effect-preset]').forEach(b=>b.addEventListener('click',()=>applyEffectPreset(b.dataset.effectPreset)));
document.querySelectorAll('[data-ai-motion]').forEach(b=>b.addEventListener('click',()=>runAI(b.dataset.aiMotion)));
$('#saveAiGatewayBtn')?.addEventListener('click',()=>{localStorage.setItem('randstudio-ai-gateway',ui.gateway.value.trim());ui.aiStatus.textContent=ui.gateway.value.trim()?'Provider gateway salvato.':'Gateway rimosso; resta ComfyUI locale.'});
$('#testAiProviderBtn')?.addEventListener('click',testAIProviders);
$('#largeModeBtn')?.addEventListener('click',()=>{const enabled=document.documentElement.classList.toggle('large-mode');localStorage.setItem('randstudio-large-mode',enabled?'1':'0')});
if(localStorage.getItem('randstudio-large-mode')==='1')document.documentElement.classList.add('large-mode');
ui.gateway.value=localStorage.getItem('randstudio-ai-gateway')||'';

async function importFiles(files){
  for(const file of files){
    const type=mediaType(file);if(!type)continue;
    const id=crypto.randomUUID(),duration=await getDuration(file,type),virtualName=`${id}.${extension(file.name)||defaultExt(type)}`;
    const item={id,file,type,name:file.name,duration,url:type==='lut'?'':URL.createObjectURL(file),virtualName};
    if(type==='lut'){try{item.lut=parseCubeLUT(await file.text(),file.name)}catch(error){ui.engine.textContent=`LUT non valida: ${error.message}`;continue}}
    media.set(id,item);try{await db.saveMedia(item)}catch(error){console.warn('Persist media',error)}
  }
  ui.mediaInput.value='';renderMedia();ui.storageStatus.textContent='Autosave: media salvati';
}

function addMediaToTimeline(id){const item=media.get(id);if(!item||item.type==='lut')return;const p=store.value,t=p.tracks.find(x=>x.kind===(item.type==='audio'?'audio':'visual')),start=Math.max(0,...t.clips.map(c=>c.end),0),duration=item.type==='image'?5:Math.max(.1,item.duration||5);commit(addClip(p,t.id,{sourceId:id,sourceName:item.name,name:item.name,type:item.type,start,in:0,out:duration,duration}))}
function applyLUT(id){if(!selected)return status('Seleziona una clip prima della LUT.');const item=media.get(id);if(item?.type!=='lut')return;const p=store.value,f=findClip(p,selected.trackId,selected.clipId);if(!f)return;f.clip.lutSourceId=id;commit(p);status(`LUT ${item.name} applicata.`)}
function clearLUT(){if(!selected)return;const p=store.value,f=findClip(p,selected.trackId,selected.clipId);if(!f)return;delete f.clip.lutSourceId;commit(p);status('LUT rimossa.')}

function render(){const p=store.value;ui.undo.disabled=!store.canUndo;ui.redo.disabled=!store.canRedo;const duration=Math.max(1,projectDuration(p));ui.duration.textContent=`${duration.toFixed(1)} s`;ui.playhead.max=String(duration);ui.ruler.style.width=`${Math.max(800,duration*pxPerSecond)}px`;ui.tracks.innerHTML='';for(const track of p.tracks){const row=document.createElement('div');row.className=`track-row ${track.kind==='audio'?'audio':''}`;const label=document.createElement('div');label.className='track-label';label.textContent=track.name;const lane=document.createElement('div');lane.className='track-lane';lane.style.width=`${Math.max(800,duration*pxPerSecond)}px`;for(const clip of track.clips)lane.appendChild(renderClip(track,clip));row.append(label,lane);ui.tracks.append(row)}renderInspector();syncPreviewToPlayhead();updateTransport()}
function renderClip(track,clip){const el=document.createElement('div');el.className='clip';if(selected?.clipId===clip.id)el.classList.add('selected');if(!media.has(clip.sourceId))el.classList.add('missing');el.style.left=`${clip.start*pxPerSecond}px`;el.style.width=`${Math.max(28,(clip.end-clip.start)*pxPerSecond)}px`;const fx=clip.effects?.length?` · ${clip.effects.length} FX`:'';const lut=clip.lutSourceId?' · LUT':'';el.innerHTML=`<strong>${escapeHtml(clip.name)}</strong><span>${clip.start.toFixed(1)} → ${clip.end.toFixed(1)}${fx}${lut}</span>`;el.onclick=e=>{e.stopPropagation();selected={trackId:track.id,clipId:clip.id};currentTime=Math.max(clip.start,Math.min(currentTime,clip.end));render()};el.onpointerdown=e=>beginDrag(e,el,track.id,clip.id,clip.start);return el}
function beginDrag(event,el,trackId,clipId,start){if(event.button!==0)return;const origin=event.clientX;el.setPointerCapture(event.pointerId);el.dataset.dragging='true';const move=e=>{const d=(e.clientX-origin)/pxPerSecond;el.style.left=`${Math.max(0,start+d)*pxPerSecond}px`},end=e=>{el.releasePointerCapture?.(e.pointerId);el.dataset.dragging='false';el.removeEventListener('pointermove',move);el.removeEventListener('pointerup',end);commit(moveClip(store.value,trackId,clipId,round2(Math.max(0,start+(e.clientX-origin)/pxPerSecond))))};el.addEventListener('pointermove',move);el.addEventListener('pointerup',end)}

function renderMedia(){ui.mediaList.innerHTML='';for(const item of media.values()){const div=document.createElement('div');div.className='media-item';const icon=item.type==='video'?'▶':item.type==='audio'?'♫':item.type==='lut'?'◫':'▧';div.innerHTML=`<div class="media-thumb">${icon}</div><div class="media-meta"><strong>${escapeHtml(item.name)}</strong><span>${item.type}${item.type==='lut'?` · ${item.lut?.size||'?'}³`:` · ${(item.duration||0).toFixed(1)} s`}</span></div>`;const actions=document.createElement('div');actions.className='media-actions';const main=document.createElement('button');main.textContent=item.type==='lut'?'LUT':'+';main.onclick=()=>item.type==='lut'?applyLUT(item.id):addMediaToTimeline(item.id);actions.append(main);if(item.type!=='lut'){const preview=document.createElement('button');preview.textContent='▶';preview.onclick=()=>showMedia(item);actions.prepend(preview)}div.append(actions);ui.mediaList.append(div)}}

function renderInspector(){const f=selected&&findClip(store.value,selected.trackId,selected.clipId);ui.inspector.hidden=!f;ui.inspectorEmpty.hidden=!!f;if(!f)return;const c=f.clip;ui.clipName.value=c.name;ui.clipStart.value=c.start.toFixed(2);ui.clipDuration.value=(c.end-c.start).toFixed(2);ui.clipIn.value=c.in.toFixed(2);ui.clipOut.value=c.out.toFixed(2);ui.clipScale.value=c.transform?.scale??1;ui.clipRotation.value=c.transform?.rotation??0;const b=c.effects?.find(e=>e.id==='brightness');const local=Math.max(0,currentTime-c.start);ui.brightness.value=b?evaluateEffect(b,local).params.amount:1;const count=b?.keyframes?.amount?.length||0;ui.keyframeStatus.textContent=`Keyframe luminosità: ${count}${c.lutSourceId?` · LUT: ${media.get(c.lutSourceId)?.name||'mancante'}`:''}`;document.querySelectorAll('[data-effect-preset]').forEach(btn=>btn.classList.toggle('selected-preset',btn.dataset.effectPreset===c.effectPreset))}
function updateSelectedFromInspector(){if(!selected)return;const p=store.value,f=findClip(p,selected.trackId,selected.clipId);if(!f)return;const c=f.clip;c.name=ui.clipName.value||c.name;const start=Math.max(0,+ui.clipStart.value||0),duration=Math.max(.05,+ui.clipDuration.value||.05),i=Math.max(0,+ui.clipIn.value||0),o=Math.max(i+.05,+ui.clipOut.value||duration);c.start=start;c.end=start+duration;c.in=i;c.out=o;c.transform={...(c.transform||{}),scale:+ui.clipScale.value||1,rotation:+ui.clipRotation.value||0};commit(p)}
function commitBrightness(){if(!selected)return;const p=store.value,f=findClip(p,selected.trackId,selected.clipId);if(!f)return;f.clip.effects=updateEffect(f.clip.effects||[],'brightness',{amount:+ui.brightness.value});commit(p)}
function previewBrightness(){const f=selected&&findClip(store.value,selected.trackId,selected.clipId);if(!f)return;const temp=structuredClone(f.clip);temp.effects=updateEffect(temp.effects||[],'brightness',{amount:+ui.brightness.value});const item=media.get(temp.sourceId);if(item)showMedia(item,temp,currentTime)}
function addBrightnessKeyframe(){if(!selected)return status('Seleziona una clip.');const p=store.value,f=findClip(p,selected.trackId,selected.clipId);if(!f)return;let fx=f.clip.effects?.find(e=>e.id==='brightness')||effect('brightness',{amount:+ui.brightness.value});fx=setKeyframe(fx,'amount',Math.max(0,currentTime-f.clip.start),+ui.brightness.value);f.clip.effects=[...(f.clip.effects||[]).filter(e=>e.id!=='brightness'),fx];commit(p);status('Keyframe luminosità aggiunto.')}
function applyEffectPreset(presetId){if(!selected)return status('Seleziona una clip prima di applicare un effetto.');const p=store.value,f=findClip(p,selected.trackId,selected.clipId);if(!f)return;Object.assign(f.clip,applyPreset(f.clip,presetId),{effectPreset:presetId});commit(p);status(`Preset ${presetId.toUpperCase()} applicato.`)}

function syncPreviewToPlayhead(){const active=store.value.tracks.flatMap(track=>track.clips.map(clip=>({track,clip}))).filter(({clip})=>currentTime>=clip.start&&currentTime<clip.end).sort((a,b)=>a.track.kind==='audio'?1:-1)[0];if(active){selected={trackId:active.track.id,clipId:active.clip.id};const item=media.get(active.clip.sourceId);if(item)showMedia(item,active.clip,currentTime)}}
async function showMedia(item,clip=null,t=0){[ui.image,ui.video,ui.audio,ui.canvas].forEach(el=>el.hidden=true);ui.empty.hidden=true;ui.previewLabel.textContent=item.name;if(item.type==='image'){ui.image.src=item.url;await ui.image.decode().catch(()=>{});await showVisual(ui.image,clip,t)}else if(item.type==='video'){if(ui.video.src!==item.url)ui.video.src=item.url;ui.video.hidden=false;applyVisualState(ui.video,clip,t);if(clip&&Number.isFinite(ui.video.duration))ui.video.currentTime=Math.max(clip.in,t-clip.start+clip.in);if(!playing)await showVisual(ui.video,clip,t)}else{if(ui.audio.src!==item.url)ui.audio.src=item.url;ui.audio.hidden=false;if(clip&&Number.isFinite(ui.audio.duration))ui.audio.currentTime=Math.max(clip.in,t-clip.start+clip.in)}}
async function showVisual(source,clip,t){const local=Math.max(0,t-(clip?.start||0)),lut=clip?.lutSourceId?media.get(clip.lutSourceId):null,webgpuEligible=!lut&&(clip?.effects||[]).every(e=>['brightness','contrast','saturation','grayscale'].includes(e.id));if(lut?.lut){try{await renderLUTToCanvas(source,ui.canvas,lut.lut);ui.canvas.hidden=false;source.hidden=true;applyTransform(ui.canvas,clip);return}catch(error){console.warn('LUT preview',error)}}if(webgpuEligible&&WebGPUEffectsRenderer.supported()){try{if(await gpuRenderer.render(source,clip?.effects||[],local)){ui.canvas.hidden=false;source.hidden=true;applyTransform(ui.canvas,clip);return}}catch(error){console.warn('WebGPU fallback',error)}}source.hidden=false;applyVisualState(source,clip,t)}
function applyTransform(el,clip){const tr=clip?.transform||{};el.style.transform=`translate(${tr.x||0}px,${tr.y||0}px) scale(${tr.scale||1}) rotate(${tr.rotation||0}deg)`}
function applyVisualState(el,clip,t=0){applyTransform(el,clip);el.style.filter=cssFilter(clip?.effects||[],Math.max(0,t-(clip?.start||0)))}

function updateTransport(){ui.playhead.value=String(Math.min(+ui.playhead.max,currentTime));ui.time.textContent=formatTime(currentTime)}
function togglePlay(){playing=!playing;$('#playBtn').textContent=playing?'❚❚':'▶';if(playing){let last=performance.now();const tick=now=>{if(!playing)return;currentTime+=Math.max(0,(now-last)/1000);last=now;if(currentTime>=+ui.playhead.max){currentTime=0;playing=false;$('#playBtn').textContent='▶'}syncPreviewToPlayhead();updateTransport();if(playing)raf=requestAnimationFrame(tick)};raf=requestAnimationFrame(tick)}else if(raf)cancelAnimationFrame(raf)}
function saveProject(){download(new Blob([JSON.stringify(store.value,null,2)],{type:'application/json'}),`${safeName(store.value.name)}.randstudio.json`)}
async function openProject(file){if(!file)return;try{const data=JSON.parse(await file.text()),errors=validateProject(data);if(errors.length)throw new Error(errors.join('; '));store=new HistoryStore(data);selected=null;currentTime=0;await persistProject();render()}catch(error){alert(`Progetto non valido: ${error.message}`)}}
async function exportVideo(){try{status('Preparazione export…');ui.progress.value=0;const compiled=compileProject(store.value,media);status('Caricamento FFmpeg / rendering locale…');const blob=await renderWithFFmpeg(compiled,p=>ui.progress.value=p);download(blob,compiled.outputName);status('Export completato');ui.progress.value=1}catch(error){console.error(error);status(`Export non riuscito: ${error.message}`)}}
function commit(next){store.commit(next);persistProject();render()}
async function persistProject(){try{await db.saveProject(store.value);ui.storageStatus.textContent='Autosave: salvato'}catch(error){ui.storageStatus.textContent='Autosave: non disponibile';console.warn(error)}}
async function restoreSession(){try{const latest=await db.latestProject();const rows=await db.loadAllMedia();for(const row of rows){const file=globalThis.File?new File([row.blob],row.name,{type:row.mime,lastModified:row.lastModified}):row.blob;const item={id:row.id,file,type:row.type,name:row.name,duration:row.duration,virtualName:row.virtualName,url:row.type==='lut'?'':URL.createObjectURL(file)};if(row.type==='lut')item.lut=parseCubeLUT(await row.blob.text(),row.name);media.set(item.id,item)}if(latest)store=new HistoryStore(latest);ui.storageStatus.textContent=`Autosave: ${rows.length} asset ripristinati`;renderMedia();render()}catch(error){ui.storageStatus.textContent='Autosave: nuovo progetto';console.warn(error)}}
async function testAIProviders(){const gateway=ui.gateway.value.trim();try{const stats=await comfy.systemStats();ui.aiStatus.textContent=`ComfyUI locale connesso${stats?.system?' · OK':''}`;return}catch{}if(gateway){try{const r=await fetch(`${gateway.replace(/\/$/,'')}/health`);if(r.ok){ui.aiStatus.textContent='AI Gateway connesso';return}}catch{}}ui.aiStatus.textContent='Nessun runtime AI raggiungibile; editor ed effetti restano operativi.'}
async function runAI(motion){const request=createWanCameraRequest({prompt:'Cinematic, realistic, stable motion, preserve subject and scene',motion,width:640,height:640,length:81,speed:1});const gateway=ui.gateway.value.trim();if(gateway){try{const registry=createDefaultRegistry({gatewayEndpoint:gateway});const result=await registry.generate('gateway',{type:'wan-camera',request,projectId:store.value.id,clipId:selected?.clipId??null});ui.aiStatus.textContent=`Job AI inviato: ${result.jobId||result.id||'accettato'}`;return}catch(error){ui.aiStatus.textContent=`Gateway AI: ${error.message}`;return}}try{await comfy.systemStats();ui.aiStatus.textContent=`ComfyUI è online. Movimento ${motion} pronto; manca solo un workflow Wan configurato nel runtime.`}catch{ui.aiStatus.textContent='Configura un AI Gateway oppure avvia ComfyUI locale.'}}
function status(text){ui.engine.textContent=text}
function findClip(p,trackId,clipId){const track=p.tracks.find(t=>t.id===trackId),clip=track?.clips.find(c=>c.id===clipId);return clip?{track,clip}:null}
function mediaType(f){if(extension(f.name)==='cube')return'lut';if(f.type.startsWith('video/'))return'video';if(f.type.startsWith('audio/'))return'audio';if(f.type.startsWith('image/'))return'image';return null}
async function getDuration(file,type){if(type==='image')return 5;if(type==='lut')return 0;return new Promise(resolve=>{const el=document.createElement(type==='audio'?'audio':'video'),url=URL.createObjectURL(file);el.preload='metadata';el.onloadedmetadata=()=>{const d=Number.isFinite(el.duration)?el.duration:5;URL.revokeObjectURL(url);resolve(d)};el.onerror=()=>{URL.revokeObjectURL(url);resolve(5)};el.src=url})}
function extension(n){return n.includes('.')?n.split('.').pop().toLowerCase():''}function defaultExt(t){return t==='audio'?'mp3':t==='image'?'png':t==='lut'?'cube':'mp4'}function download(blob,name){const a=document.createElement('a'),url=URL.createObjectURL(blob);a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}function safeName(n){return(n||'randstudio-project').replace(/[^a-z0-9_-]+/gi,'-').replace(/^-|-$/g,'').toLowerCase()||'randstudio-project'}function escapeHtml(s){return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}function formatTime(v){const m=Math.floor(v/60),s=Math.floor(v%60),ms=Math.floor(v%1*1000);return`${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}.${String(ms).padStart(3,'0')}`}function round2(v){return Math.round(v*100)/100}

window.addEventListener('beforeunload',()=>{for(const item of media.values())if(item.url)URL.revokeObjectURL(item.url)});
ui.gpuStatus.textContent=WebGPUEffectsRenderer.supported()?'GPU: WebGPU disponibile':'GPU: fallback browser';
render();renderMedia();restoreSession();
