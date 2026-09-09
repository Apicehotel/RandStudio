export const GRAPHIC_TYPES = Object.freeze(['text','lower-third','sticker','callout','arrow']);

export const GRAPHIC_PRESETS = Object.freeze({
  title:{type:'text',text:'Titolo',fontSize:72,fontWeight:800,color:'#ffffff',background:'transparent',padding:18,align:'center'},
  lowerThird:{type:'lower-third',text:'Nome Cognome',subtitle:'Ruolo / descrizione',fontSize:46,fontWeight:800,color:'#ffffff',accent:'#7c5cff',background:'rgba(8,11,18,.88)',padding:24,align:'left'},
  callout:{type:'callout',text:'Guarda qui',fontSize:38,fontWeight:800,color:'#ffffff',accent:'#7c5cff',background:'rgba(8,11,18,.92)',padding:20,align:'center'},
  arrow:{type:'arrow',text:'➜',fontSize:110,fontWeight:900,color:'#ffffff',accent:'#7c5cff',background:'transparent',padding:16,align:'center'},
});

export const STICKER_PACK = Object.freeze(['❤️','⭐','🔥','😂','🎉','✨','✅','📍','👀','💥','👏','🥳']);

export function createGraphicSpec(type, overrides={}){
  const base=type==='lower-third'?GRAPHIC_PRESETS.lowerThird:type==='callout'?GRAPHIC_PRESETS.callout:type==='arrow'?GRAPHIC_PRESETS.arrow:type==='sticker'?{type:'sticker',text:'✨',fontSize:120,fontWeight:800,color:'#ffffff',background:'transparent',padding:20,align:'center'}:GRAPHIC_PRESETS.title;
  return{schema:'randstudio.graphic/v1',...structuredClone(base),...overrides};
}

export function isGraphicClip(clip){return GRAPHIC_TYPES.includes(clip?.type)}

export async function prepareGraphicMedia(project, mediaById){
  const next=structuredClone(project),media=new Map(mediaById);
  for(const track of next.tracks||[])for(const clip of track.clips||[]){
    if(!isGraphicClip(clip))continue;
    const id=`graphic:${clip.id}`;
    const blob=await renderGraphicBlob(clip.graphic||createGraphicSpec(clip.type));
    media.set(id,{id,file:blob,type:'image',name:`${clip.name||clip.type}.png`,duration:Math.max(.05,clip.end-clip.start),virtualName:`${safe(id)}.png`,generated:true});
    clip.sourceId=id;clip.sourceName=`${clip.name||clip.type}.png`;clip.in=0;clip.out=Math.max(.05,clip.end-clip.start);
  }
  return{project:next,media};
}

export async function graphicPreviewUrl(spec){return URL.createObjectURL(await renderGraphicBlob(spec))}

export async function renderGraphicBlob(spec){
  const width=Math.max(320,Number(spec.width)||960),height=Math.max(180,Number(spec.height)||420);
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
  const ctx=canvas.getContext('2d');ctx.clearRect(0,0,width,height);
  if(spec.type==='lower-third')drawLowerThird(ctx,spec,width,height);
  else if(spec.type==='callout')drawCallout(ctx,spec,width,height);
  else drawTextLike(ctx,spec,width,height);
  return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Impossibile creare overlay PNG')),'image/png'));
}

function drawTextLike(ctx,s,w,h){
  const pad=Number(s.padding)||16,size=Number(s.fontSize)||72;
  if(s.background&&s.background!=='transparent'){ctx.fillStyle=s.background;roundRect(ctx,pad,pad,w-pad*2,h-pad*2,28);ctx.fill()}
  ctx.font=`${Number(s.fontWeight)||800} ${size}px system-ui, -apple-system, sans-serif`;ctx.textBaseline='middle';ctx.textAlign=s.align==='left'?'left':'center';ctx.fillStyle=s.color||'#fff';
  const x=s.align==='left'?pad*2:w/2;ctx.fillText(String(s.text||''),x,h/2,w-pad*4);
}
function drawLowerThird(ctx,s,w,h){
  const pad=Number(s.padding)||24;ctx.fillStyle=s.background||'rgba(8,11,18,.88)';roundRect(ctx,pad,h*.48,w-pad*2,h*.38,26);ctx.fill();ctx.fillStyle=s.accent||'#7c5cff';roundRect(ctx,pad,h*.48,12,h*.38,8);ctx.fill();
  ctx.textAlign='left';ctx.textBaseline='middle';ctx.fillStyle=s.color||'#fff';ctx.font=`${Number(s.fontWeight)||800} ${Number(s.fontSize)||46}px system-ui, sans-serif`;ctx.fillText(String(s.text||''),pad+38,h*.62,w-pad*4);
  ctx.fillStyle='rgba(255,255,255,.72)';ctx.font=`600 ${Math.max(20,(Number(s.fontSize)||46)*.48)}px system-ui, sans-serif`;ctx.fillText(String(s.subtitle||''),pad+38,h*.76,w-pad*4);
}
function drawCallout(ctx,s,w,h){
  const pad=Number(s.padding)||20;ctx.fillStyle=s.background||'rgba(8,11,18,.92)';roundRect(ctx,pad,pad,w-pad*2,h-pad*2,34);ctx.fill();ctx.strokeStyle=s.accent||'#7c5cff';ctx.lineWidth=8;ctx.stroke();ctx.beginPath();ctx.moveTo(w*.64,h-pad);ctx.lineTo(w*.76,h);ctx.lineTo(w*.72,h-pad);ctx.closePath();ctx.fill();drawTextLike(ctx,{...s,background:'transparent'},w,h);
}
function roundRect(ctx,x,y,w,h,r){ctx.beginPath();ctx.roundRect?.(x,y,w,h,r)||ctx.rect(x,y,w,h)}
function safe(v){return String(v).replace(/[^a-z0-9_-]+/gi,'-')}
