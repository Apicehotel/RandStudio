import{projectDuration,validateProject}from'./composition.js';import{ffmpegFilters}from'../effects/effects-engine.js';import{lutToFFmpeg}from'../effects/lut.js';import{ffmpegMotion}from'../graphics/motion-engine.js';import{buildRampSegments}from'./speed-ramp.js';

export function compileProject(project,mediaById,outputName='randstudio-export.mp4'){
  const errors=validateProject(project);if(errors.length)throw new Error(errors.join('; '));
  const clips=project.tracks.flatMap(track=>track.clips.map(clip=>({...clip,trackKind:track.kind})));if(!clips.length)throw new Error('Nessuna clip da esportare');
  const inputs=[],assets=[],inputMap=new Map(),assetMap=new Map();for(const clip of clips){if(!inputMap.has(clip.sourceId)){const media=mediaById.get(clip.sourceId);if(!media)throw new Error(`Media mancante: ${clip.sourceName}`);inputMap.set(clip.sourceId,inputMap.size);inputs.push(media)}if(clip.lutSourceId&&!assetMap.has(clip.lutSourceId)){const lut=mediaById.get(clip.lutSourceId);if(!lut)throw new Error(`LUT mancante: ${clip.lutSourceId}`);assetMap.set(clip.lutSourceId,lut);assets.push(lut)}}
  const args=[];for(const m of inputs)args.push('-i',m.virtualName);
  const duration=Math.max(.1,projectDuration(project)),filters=[`color=c=black:s=${project.width}x${project.height}:r=${project.fps}:d=${duration}[base0]`];let visualBase='base0',visualIndex=0,rampIndex=0;const audio=[];
  for(const track of project.tracks)for(const clip of track.clips){
    const i=inputMap.get(clip.sourceId),rate=Math.max(.05,Number(clip.playbackRate)||1),clipDuration=Math.max(.05,clip.end-clip.start);
    if(track.kind==='audio'||clip.type==='audio'){
      const label=`a${audio.length}`,delay=Math.round(clip.start*1000);
      if(clip.speedRamp){const ramp=compileAudioRamp(filters,i,clip,`ar${rampIndex++}`);filters.push(`[${ramp}]volume=${num(clip.volume??1)},adelay=${delay}|${delay}[${label}]`)}else{const tempo=rate===1?'':atempoFilters(rate).map(x=>`,`+x).join('');filters.push(`[${i}:a]atrim=start=${num(clip.in)}:end=${num(clip.out)},asetpts=PTS-STARTPTS${tempo},volume=${num(clip.volume??1)},adelay=${delay}|${delay}[${label}]`)}audio.push(label);continue
    }
    const source=`vsrc${visualIndex}`,out=`vout${visualIndex}`,x=clip.transform?.x??0,y=clip.transform?.y??0,scale=clip.transform?.scale??1,rotation=((clip.transform?.rotation??0)*Math.PI/180).toFixed(6),fx=ffmpegFilters(clip.effects||[]),lut=clip.lutSourceId?lutToFFmpeg(assetMap.get(clip.lutSourceId)):null,motion=ffmpegMotion(clip.motion,{clipStart:clip.start,clipDuration,baseX:x,baseY:y});
    const pre=clip.speedRamp?compileVideoRamp(filters,i,clip,`vr${rampIndex++}`):null;
    const input=pre?`[${pre}]`:`[${i}:v]`,chain=[...(pre?[]:[`trim=start=${num(clip.in)}:end=${num(clip.out)}`,'setpts=PTS-STARTPTS',...(rate===1?[]:[`setpts=PTS/${num(rate)}`])]),`scale=iw*${num(scale)}:ih*${num(scale)}`,`rotate=${rotation}:ow=rotw(iw):oh=roth(ih):c=none`,...fx,...(lut?[lut]:[]),...motion.filters,`setpts=PTS+${num(clip.start)}/TB`];
    filters.push(`${input}${chain.join(',')}[${source}]`);filters.push(`[${visualBase}][${source}]overlay=x='${motion.overlay.x}':y='${motion.overlay.y}':enable='between(t,${num(clip.start)},${num(clip.end)})':eof_action=pass[${out}]`);visualBase=out;visualIndex++
  }
  let audioMap=null;if(audio.length===1)audioMap=audio[0];if(audio.length>1){audioMap='amixout';filters.push(`${audio.map(x=>`[${x}]`).join('')}amix=inputs=${audio.length}:duration=longest:normalize=0[${audioMap}]`)}
  args.push('-filter_complex',filters.join(';'),'-map',`[${visualBase}]`);if(audioMap)args.push('-map',`[${audioMap}]`);args.push('-t',num(duration),'-r',String(project.fps),'-c:v','libx264','-pix_fmt','yuv420p','-movflags','+faststart');if(audioMap)args.push('-c:a','aac');args.push(outputName);return{args,inputs,assets,outputName,duration,filterComplex:filters.join(';')}
}

function compileVideoRamp(filters,inputIndex,clip,prefix){const segs=buildRampSegments(clip.speedRamp,clip.in,clip.out),outs=[];segs.forEach((s,j)=>{const out=`${prefix}s${j}`;filters.push(`[${inputIndex}:v]trim=start=${num(s.sourceStart)}:end=${num(s.sourceEnd)},setpts=(PTS-STARTPTS)/${num(s.rate)}[${out}]`);outs.push(out)});const joined=`${prefix}out`;filters.push(`${outs.map(x=>`[${x}]`).join('')}concat=n=${outs.length}:v=1:a=0[${joined}]`);return joined}
function compileAudioRamp(filters,inputIndex,clip,prefix){const segs=buildRampSegments(clip.speedRamp,clip.in,clip.out),outs=[];segs.forEach((s,j)=>{const out=`${prefix}s${j}`,tempo=atempoFilters(s.rate);filters.push(`[${inputIndex}:a]atrim=start=${num(s.sourceStart)}:end=${num(s.sourceEnd)},asetpts=PTS-STARTPTS${tempo.length?','+tempo.join(','):''}[${out}]`);outs.push(out)});const joined=`${prefix}out`;filters.push(`${outs.map(x=>`[${x}]`).join('')}concat=n=${outs.length}:v=0:a=1[${joined}]`);return joined}
export function atempoFilters(rate){let r=Math.max(.25,Math.min(4,Number(rate)||1)),parts=[];while(r>2.000001){parts.push('atempo=2');r/=2}while(r<.499999){parts.push('atempo=0.5');r*=2}if(Math.abs(r-1)>.0001)parts.push(`atempo=${num(r)}`);return parts}
function num(v){return Number(v).toFixed(4).replace(/0+$/,'').replace(/\.$/,'')||'0'}
