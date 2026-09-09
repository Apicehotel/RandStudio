import{RandStudioDB}from'./persistence/indexeddb.js';
import{addClip}from'./core/composition.js';
import{createKineticText,materializeKineticText}from'./graphics/kinetic-text.js';
import{applyMotionPreset,evaluateMotion}from'./graphics/motion-engine.js';
import{renderGraphicBlob,isGraphicClip}from'./graphics/overlay-engine.js';
import{setTransformKeyframe,evaluateTransform}from'./core/transform-keyframes.js';
import{normalizeAudioSpec}from'./audio/audio-engine.js';
import{createVisionJob,GatewayVisionProvider,createTrack,trackAt,createRectMask}from'./vision/vision-engine.js';
import{activeVisualLayers}from'./preview/composite-preview.js';
import{timelineToSource}from'./core/speed-ramp.js';

const db=new RandStudioDB(),$=s=>document.querySelector(s);let snapshot=null,mediaRows=new Map(),lastTime=-1,compositeEnabled=true,layerRoot=null;const urls=new Map();

boot();
async function boot(){try{snapshot=await db.latestProject();const rows=await db.loadAllMedia();mediaRows=new Map(rows.map(r=>[r.id,r]));wire();await initComposite();}catch(e){console.warn('RandStudio finish UI',e)}}
function wire(){
  $('#addKineticBtn')?.addEventListener('click',addKinetic);
  document.querySelectorAll('[data-transition]').forEach(b=>b.addEventListener('click',()=>mutateSelected(c=>{c.transitionIn={id:b.dataset.transition};return c},`Transizione ${b.dataset.transition}`)));
  $('#transitionOutBtn')?.addEventListener('click',()=>mutateSelected(c=>{c.transitionOut={id:'fade',out:true};return c},'Fade out'));
  $('#addTransformKeyframeBtn')?.addEventListener('click',addTransformKeyframe);
  document.querySelectorAll('[data-audio-role]').forEach(b=>b.addEventListener('click',()=>applyAudioPreset(b.dataset.audioRole)));
  $('#applyRectMaskBtn')?.addEventListener('click',applyRectMask);
  $('#applyManualTrackBtn')?.addEventListener('click',applyManualTrack);
  document.querySelectorAll('[data-vision-tool]').forEach(b=>b.addEventListener('click',()=>queueVision(b.dataset.visionTool)));
  $('#sendVisionJobsBtn')?.addEventListener('click',sendVisionJobs);
  $('#toggleCompositeBtn')?.addEventListener('click',()=>{compositeEnabled=!compositeEnabled;$('#toggleCompositeBtn').textContent=compositeEnabled?'Preview composita: ON':'Preview composita: OFF';if(!compositeEnabled)clearLayers()});
}

async function addKinetic(){const text=$('#kineticText')?.value?.trim();if(!text)return note('Scrivi il testo kinetic.');const preset=$('#kineticPreset')?.value||'wordPop',project=await freshProject();let track=project.tracks.find(t=>t.id==='kinetic-text');if(!track){track={id:'kinetic-text',name:'Kinetic Text',kind:'visual',clips:[]};project.tracks.push(track)}const start=Number($('#playhead')?.value)||0,spec=createKineticText(text,preset),rows=materializeKineticText(spec,{start,graphic:{fontSize:Number($('#kineticSize')?.value)||72,color:$('#kineticColor')?.value||'#ffffff'}});let p=project;for(const row of rows){const id=crypto.randomUUID(),motion=applyMotionPreset({},row.motion).motion;p=addClip(p,'kinetic-text',{id,sourceId:`graphic:${id}`,sourceName:'kinetic.png',name:`Kinetic: ${row.active}`,type:'text',start:row.start,in:0,out:row.duration,duration:row.duration,graphic:row.graphic,motion,kinetic:spec})}await saveReload(p,`${rows.length} step kinetic creati`)}
async function addTransformKeyframe(){const key=$('#transformKey')?.value||'x',value=Number($('#transformKeyValue')?.value),easing=$('#transformEasing')?.value||'easeInOut';await mutateSelected(c=>{const local=Math.max(0,(Number($('#playhead')?.value)||c.start)-c.start);return setTransformKeyframe(c,key,local,Number.isFinite(value)?value:0,easing)},`Keyframe ${key} aggiunto`)}
async function applyAudioPreset(role){await mutateSelected(c=>{c.audio=normalizeAudioSpec({role,normalize:role==='voice',fadeIn:role==='music'?.35:.08,fadeOut:role==='music'?.5:.12,ducking:role==='music'?{amount:.48}:null,volume:c.volume??1});return c},`Audio ${role} applicato`)}
async function applyRectMask(){const x=Number($('#maskX')?.value)||0,y=Number($('#maskY')?.value)||0,width=Math.max(1,Number($('#maskW')?.value)||300),height=Math.max(1,Number($('#maskH')?.value)||300);await mutateSelected(c=>{c.mask=createRectMask({x,y,width,height,feather:Number($('#maskFeather')?.value)||0});return c},'Maschera rettangolare applicata')}
async function applyManualTrack(){const x1=Number($('#trackX1')?.value)||0,y1=Number($('#trackY1')?.value)||0,x2=Number($('#trackX2')?.value)||0,y2=Number($('#trackY2')?.value)||0;await mutateSelected(c=>{const d=Math.max(.05,c.end-c.start);c.track=createTrack([{t:0,x:x1,y:y1},{t:d,x:x2,y:y2}]);return c},'Tracking manuale applicato')}
async function queueVision(tool){const project=await freshProject(),ref=findSelected(project);if(!ref)return note('Seleziona una clip.');const job=createVisionJob(tool,{clipId:ref.clip.id,timeRange:[ref.clip.start,ref.clip.end],options:{sourceId:ref.clip.sourceId,sourceName:ref.clip.sourceName}});project.visionJobs=[...(project.visionJobs||[]),job];await db.saveProject(project);snapshot=project;note(`${tool}: job accodato`)}
async function sendVisionJobs(){const project=await freshProject(),endpoint=$('#aiGatewayEndpoint')?.value?.trim();if(!endpoint)return note('Configura AI Gateway per inviare i job Vision.');const provider=new GatewayVisionProvider(endpoint),jobs=(project.visionJobs||[]).filter(j=>j.status==='queued');if(!jobs.length)return note('Nessun job Vision in coda.');for(const job of jobs){try{const result=await provider.run(job);job.status='submitted';job.providerResult=result;job.submittedAt=new Date().toISOString()}catch(e){job.status='error';job.error=e.message}}await db.saveProject(project);snapshot=project;note(`Vision: elaborati ${jobs.length} job`)}

async function mutateSelected(mutator,label){const project=await freshProject(),ref=findSelected(project);if(!ref)return note('Seleziona una clip.');const next=mutator(structuredClone(ref.clip));Object.assign(ref.clip,next);await saveReload(project,label)}
function findSelected(project){const name=$('#clipName')?.value,start=Number($('#clipStart')?.value);let best=null;for(const track of project.tracks||[])for(const clip of track.clips||[]){let score=0;if(name&&clip.name===name)score+=5;if(Number.isFinite(start)&&Math.abs(clip.start-start)<.02)score+=4;if(!best||score>best.score)best={track,clip,score}}return best?.score>0?best:null}
async function freshProject(){return structuredClone(await db.latestProject()||snapshot)}
async function saveReload(project,label){await db.saveProject(project);snapshot=project;note(label);setTimeout(()=>location.reload(),180)}
function note(text){const el=$('#finishStatus');if(el)el.textContent=text;else console.info(text)}

async function initComposite(){const stage=$('#stage');if(!stage)return;layerRoot=document.createElement('div');layerRoot.id='compositeLayerRoot';layerRoot.setAttribute('aria-label','Preview multi-layer');Object.assign(layerRoot.style,{position:'absolute',inset:'0',overflow:'hidden',pointerEvents:'none',zIndex:'20'});stage.style.position='relative';stage.append(layerRoot);const tick=async()=>{const t=Number($('#playhead')?.value)||0;if(compositeEnabled&&Math.abs(t-lastTime)>.008){lastTime=t;await renderComposite(t)}requestAnimationFrame(tick)};requestAnimationFrame(tick)}
async function renderComposite(time){if(!snapshot)snapshot=await db.latestProject();const layers=activeVisualLayers(snapshot,time);if(!layers.length){clearLayers();return}const stage=$('#stage'),sx=stage.clientWidth/Math.max(1,snapshot.width),sy=stage.clientHeight/Math.max(1,snapshot.height);layerRoot.innerHTML='';for(const layer of layers){const c=layer.clip,row=mediaRows.get(c.sourceId),local=Math.max(0,time-c.start),tr=evaluateTransform(c,local),track=trackAt(c.track,local),motion=evaluateMotion(c.motion,local,Math.max(.05,c.end-c.start)),el=await createLayerElement(c,row,time);if(!el)continue;const x=(tr.x+(track.x||0)+motion.x)*sx,y=(tr.y+(track.y||0)+motion.y)*sy,scale=tr.scale*(track.scale||1)*motion.scale,rot=tr.rotation+(track.rotation||0);Object.assign(el.style,{position:'absolute',left:'50%',top:'50%',maxWidth:'100%',maxHeight:'100%',transformOrigin:'center',transform:`translate(calc(-50% + ${x}px),calc(-50% + ${y}px)) scale(${scale}) rotate(${rot}deg)`,opacity:String(tr.opacity*motion.opacity),zIndex:String(layer.z),objectFit:'contain'});if(c.mask?.type==='rect'){const mx=c.mask.x*sx,my=c.mask.y*sy,mw=c.mask.width*sx,mh=c.mask.height*sy;el.style.clipPath=`inset(${Math.max(0,my)}px ${Math.max(0,stage.clientWidth-(mx+mw))}px ${Math.max(0,stage.clientHeight-(my+mh))}px ${Math.max(0,mx)}px)`}layerRoot.append(el)}hideLegacyPreview()}
async function createLayerElement(c,row,time){if(isGraphicClip(c)){const blob=await renderGraphicBlob(c.graphic),url=URL.createObjectURL(blob);rememberUrl(`g-${c.id}-${time.toFixed(2)}`,url);const img=new Image();img.src=url;return img}if(!row?.blob)return null;let url=urls.get(row.id);if(!url){url=URL.createObjectURL(row.blob);urls.set(row.id,url)}if(row.type==='video'||row.mime?.startsWith('video/')){const v=document.createElement('video');v.src=url;v.muted=true;v.playsInline=true;v.preload='auto';const source=clipSourceTime(c,time);v.addEventListener('loadedmetadata',()=>{try{v.currentTime=Math.min(v.duration||source,source)}catch{}},{once:true});return v}const img=new Image();img.src=url;return img}
function clipSourceTime(c,time){const offset=Math.max(0,time-c.start);return c.speedRamp?timelineToSource(c.speedRamp,c.in,c.out,offset):Math.max(c.in,offset*Math.max(.05,c.playbackRate||1)+c.in)}
function hideLegacyPreview(){for(const id of['#imagePreview','#videoPreview','#gpuCanvas']){const el=$(id);if(el)el.hidden=true}const empty=$('#emptyPreview');if(empty)empty.hidden=true}
function clearLayers(){if(layerRoot)layerRoot.innerHTML=''}
function rememberUrl(key,url){const old=urls.get(key);if(old)URL.revokeObjectURL(old);urls.set(key,url)}
window.addEventListener('beforeunload',()=>{for(const u of urls.values())URL.revokeObjectURL(u)});
