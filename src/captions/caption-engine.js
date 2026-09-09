export const CAPTION_SCHEMA='randstudio.caption/v1';
export const CAPTION_STYLES=Object.freeze({
  clean:{id:'clean',name:'Clean',fontSize:54,fontWeight:800,color:'#ffffff',highlight:'#7c5cff',background:'rgba(8,11,18,.72)',position:'bottom',maxWords:8,uppercase:false},
  social:{id:'social',name:'Social Pop',fontSize:66,fontWeight:900,color:'#ffffff',highlight:'#ffd84d',background:'rgba(0,0,0,.18)',position:'center-low',maxWords:5,uppercase:true},
  karaoke:{id:'karaoke',name:'Karaoke',fontSize:62,fontWeight:900,color:'#ffffff',highlight:'#7c5cff',background:'rgba(8,11,18,.36)',position:'center-low',maxWords:6,uppercase:false},
  minimal:{id:'minimal',name:'Minimal',fontSize:48,fontWeight:700,color:'#ffffff',highlight:'#ffffff',background:'transparent',position:'bottom',maxWords:9,uppercase:false},
});

export function normalizeTranscript(input={}){
  const segments=(input.segments||input.captions||[]).map((s,i)=>normalizeSegment(s,i)).filter(Boolean);
  return{schema:CAPTION_SCHEMA,language:input.language||'auto',segments,source:input.source||'unknown'};
}

export function normalizeSegment(segment,index=0){
  const start=num(segment.start??segment.startTime??0),end=num(segment.end??segment.endTime??start+.1);
  const text=String(segment.text??'').trim();if(!text||end<=start)return null;
  const words=(segment.words||[]).map((w,i)=>({id:w.id||`w${index}-${i}`,text:String(w.text??w.word??'').trim(),start:num(w.start??start),end:num(w.end??end)})).filter(w=>w.text&&w.end>=w.start);
  return{id:segment.id||`cap-${index}`,start,end,text,words};
}

export function parseSRT(text){
  const blocks=String(text).replace(/\r/g,'').trim().split(/\n\s*\n/);const segments=[];
  for(const block of blocks){const lines=block.split('\n').map(x=>x.trim()).filter(Boolean);const timeIndex=lines.findIndex(x=>x.includes('-->'));if(timeIndex<0)continue;const [a,b]=lines[timeIndex].split('-->').map(x=>x.trim());const caption=lines.slice(timeIndex+1).join(' ').trim();if(!caption)continue;segments.push({start:parseTimestamp(a),end:parseTimestamp(b),text:caption});}
  return normalizeTranscript({segments,source:'srt'});
}

export function parseVTT(text){const body=String(text).replace(/^WEBVTT[^\n]*\n+/i,'');return parseSRT(body.replace(/(\d\d:\d\d:\d\d)\.(\d{3})/g,'$1,$2'))}
export function toSRT(transcript){return normalizeTranscript(transcript).segments.map((s,i)=>`${i+1}\n${formatTimestamp(s.start,',')} --> ${formatTimestamp(s.end,',')}\n${s.text}`).join('\n\n')}
export function toVTT(transcript){return`WEBVTT\n\n${normalizeTranscript(transcript).segments.map(s=>`${formatTimestamp(s.start,'.')} --> ${formatTimestamp(s.end,'.')}\n${s.text}`).join('\n\n')}`}
export function activeCaption(transcript,time){return normalizeTranscript(transcript).segments.find(s=>time>=s.start&&time<s.end)||null}
export function activeWord(segment,time){if(!segment?.words?.length)return null;return segment.words.find(w=>time>=w.start&&time<w.end)||null}

export function splitForSocial(segment,styleId='social'){
  const style=CAPTION_STYLES[styleId]||CAPTION_STYLES.social,words=segment.words?.length?segment.words:estimateWords(segment),chunks=[];
  for(let i=0;i<words.length;i+=style.maxWords){const part=words.slice(i,i+style.maxWords);chunks.push({id:`${segment.id}-chunk-${i}`,start:part[0]?.start??segment.start,end:part.at(-1)?.end??segment.end,text:part.map(w=>w.text).join(' '),words:part})}
  return chunks.length?chunks:[segment];
}

export function captionGraphic(segment,styleId='social',time=segment.start){
  const style=CAPTION_STYLES[styleId]||CAPTION_STYLES.social,word=activeWord(segment,time),text=style.uppercase?segment.text.toUpperCase():segment.text;
  return{schema:'randstudio.graphic/v1',type:'caption',text,fontSize:style.fontSize,fontWeight:style.fontWeight,color:style.color,highlight:style.highlight,background:style.background,position:style.position,activeWord:word?.text||'',padding:22,align:'center',width:1280,height:360};
}

export function buildCaptionClips(transcript,styleId='social'){
  const t=normalizeTranscript(transcript),clips=[];let index=0;
  for(const segment of t.segments){const pieces=styleId==='social'||styleId==='karaoke'?splitForSocial(segment,styleId):[segment];for(const piece of pieces){if(styleId==='karaoke'){const words=piece.words?.length?piece.words:estimateWords(piece);for(const word of words){clips.push(makeClip(piece,styleId,index++,word.start,Math.max(word.end,word.start+.05),word.text))}}else clips.push(makeClip(piece,styleId,index++,piece.start,piece.end,''))}}
  return clips;
}

function makeClip(segment,styleId,index,start,end,activeWord){const graphic=captionGraphic(segment,styleId,start);if(activeWord)graphic.activeWord=activeWord;return{id:`caption-${index}-${Math.round(start*1000)}`,type:'caption',name:`Caption ${index+1}`,sourceId:`caption:${index}:${Math.round(start*1000)}`,sourceName:`caption-${index+1}.png`,start,end,in:0,out:Math.max(.05,end-start),duration:Math.max(.05,end-start),graphic,transform:{x:0,y:0,scale:1,rotation:0},effects:[],motion:{schema:'randstudio.motion/v1',preset:styleId==='social'?'pop':'none'}}}
function estimateWords(segment){const parts=segment.text.split(/\s+/).filter(Boolean),span=Math.max(.05,segment.end-segment.start);return parts.map((text,i)=>({id:`${segment.id}-w${i}`,text,start:segment.start+span*i/parts.length,end:segment.start+span*(i+1)/parts.length}))}
function parseTimestamp(value){const m=String(value).match(/(?:(\d+):)?(\d{2}):(\d{2})[,.](\d{3})/);if(!m)return 0;return num((Number(m[1]||0)*3600)+(Number(m[2])*60)+Number(m[3])+Number(m[4])/1000)}
function formatTimestamp(value,sep){const ms=Math.max(0,Math.round(Number(value||0)*1000)),h=Math.floor(ms/3600000),m=Math.floor(ms%3600000/60000),s=Math.floor(ms%60000/1000),r=ms%1000;return`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}${sep}${String(r).padStart(3,'0')}`}
function num(v){return Number.isFinite(Number(v))?Number(v):0}
