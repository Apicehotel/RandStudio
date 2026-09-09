import{RandStudioDB}from'../persistence/indexeddb.js';
import{removeBackgroundLocal}from'./local-background-removal.js';

const db=new RandStudioDB(),$=s=>document.querySelector(s);
document.addEventListener('click',onVisionClick,true);

async function onVisionClick(event){
  const button=event.target?.closest?.('[data-vision-tool="background-remove"]');if(!button)return;
  const project=await db.latestProject().catch(()=>null),ref=project&&findSelected(project),row=ref&&await db.loadMedia(ref.clip.sourceId).catch(()=>null);
  if(!ref||!row||!(row.mime||'').startsWith('image/'))return;
  event.preventDefault();event.stopImmediatePropagation();
  try{
    status('Rimuovi sfondo locale: caricamento modello…');button.disabled=true;
    const sourceFile=new File([row.blob],row.name||'image',{type:row.mime||'image/png',lastModified:row.lastModified||Date.now()}),blob=await removeBackgroundLocal(sourceFile,{onStatus:status}),id=crypto.randomUUID(),name=`nobg-${row.name?.replace(/\.[^.]+$/,'')||'image'}.png`,file=new File([blob],name,{type:'image/png',lastModified:Date.now()});
    await db.saveMedia({id,file,type:'image',name,duration:row.duration||5,virtualName:`${id}.png`});
    if(!ref.clip.originalSourceId){ref.clip.originalSourceId=ref.clip.sourceId;ref.clip.originalSourceName=ref.clip.sourceName}
    ref.clip.sourceId=id;ref.clip.sourceName=name;ref.clip.name=`${ref.clip.name} · no BG`;await db.saveProject(project);status('Sfondo rimosso localmente. Nessun upload esterno.');setTimeout(()=>location.reload(),250);
  }catch(error){console.error(error);status(`MODNet locale non riuscito: ${error.message}. Il job AI Gateway resta disponibile per video/casi avanzati.`)}finally{button.disabled=false}
}

function findSelected(project){const name=$('#clipName')?.value,start=Number($('#clipStart')?.value);let best=null;for(const track of project.tracks||[])for(const clip of track.clips||[]){let score=0;if(name&&clip.name===name)score+=5;if(Number.isFinite(start)&&Math.abs(clip.start-start)<.02)score+=4;if(!best||score>best.score)best={track,clip,score}}return best?.score>0?best:null}
function status(text){const el=$('#finishStatus')||$('#aiProviderStatus');if(el)el.textContent=text}
