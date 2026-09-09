import{removeBackgroundLocal}from'./local-background-removal.js';
import{getProjectSnapshot,getSelectedClip,getMediaSnapshot,registerMedia,replaceProject}from'../app.js';

const $=s=>document.querySelector(s);
document.addEventListener('click',onVisionClick,true);

async function onVisionClick(event){
  const button=event.target?.closest?.('[data-vision-tool="background-remove"]');if(!button)return;
  const selected=getSelectedClip(),project=getProjectSnapshot(),ref=selected&&findSelected(project,selected),row=ref&&getMediaSnapshot().get(ref.clip.sourceId);
  if(!ref||!row||!(row.file?.type||row.mime||'').startsWith('image/'))return;
  event.preventDefault();event.stopImmediatePropagation();
  try{
    status('Rimuovi sfondo locale: caricamento modello…');button.disabled=true;
    const sourceFile=row.file||row.blob,blob=await removeBackgroundLocal(sourceFile,{onStatus:status}),id=crypto.randomUUID(),name=`nobg-${row.name?.replace(/\.[^.]+$/,'')||'image'}.png`,file=new File([blob],name,{type:'image/png',lastModified:Date.now()});
    await registerMedia({id,file,type:'image',name,duration:row.duration||5,virtualName:`${id}.png`});
    if(!ref.clip.originalSourceId){ref.clip.originalSourceId=ref.clip.sourceId;ref.clip.originalSourceName=ref.clip.sourceName}
    ref.clip.sourceId=id;ref.clip.sourceName=name;ref.clip.name=`${ref.clip.name} · no BG`;await replaceProject(project,'Sfondo rimosso localmente. Nessun upload esterno.');status('Sfondo rimosso localmente. Nessun upload esterno.');
  }catch(error){console.error(error);status(`MODNet locale non riuscito: ${error.message}. Il job AI Gateway resta disponibile per video/casi avanzati.`)}finally{button.disabled=false}
}

function findSelected(project,selected){const track=project.tracks.find(item=>item.id===selected.trackId),clip=track?.clips.find(item=>item.id===selected.clipId);return clip?{track,clip}:null}
function status(text){const el=$('#finishStatus')||$('#aiProviderStatus');if(el)el.textContent=text}
