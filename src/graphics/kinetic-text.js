export const KINETIC_SCHEMA='randstudio.kinetic-text/v1';
export const KINETIC_PRESETS=Object.freeze({
  typewriter:{id:'typewriter',name:'Typewriter',unit:'char',step:.055,motion:'fade'},
  wordPop:{id:'wordPop',name:'Word Pop',unit:'word',step:.22,motion:'pop'},
  wordSlide:{id:'wordSlide',name:'Word Slide',unit:'word',step:.2,motion:'slideUp'},
  headline:{id:'headline',name:'Headline',unit:'word',step:.16,motion:'bounce'},
});

export function createKineticText(text,presetId='wordPop',options={}){
  const preset=KINETIC_PRESETS[presetId]||KINETIC_PRESETS.wordPop;
  return{schema:KINETIC_SCHEMA,preset:preset.id,text:String(text||''),unit:preset.unit,step:Math.max(.03,Number(options.step)||preset.step),motion:options.motion||preset.motion};
}

export function materializeKineticText(spec,{start=0,minDuration=.12,graphic={}}={}){
  const text=String(spec?.text||'').trim();if(!text)return[];
  const unit=spec?.unit==='char'?'char':'word',parts=unit==='char'?[...text]:text.split(/\s+/),step=Math.max(.03,Number(spec?.step)||.2),clips=[];
  for(let i=0;i<parts.length;i++){
    const shown=unit==='char'?parts.slice(0,i+1).join(''):parts.slice(0,i+1).join(' '),s=start+i*step,e=s+Math.max(minDuration,step*1.15);
    clips.push({start:s,end:e,duration:e-s,text:shown,active:parts[i],graphic:{schema:'randstudio.graphic/v1',type:'text',text:shown,fontSize:graphic.fontSize||72,fontWeight:graphic.fontWeight||900,color:graphic.color||'#ffffff',background:graphic.background||'transparent',padding:graphic.padding||18,align:graphic.align||'center'},motion:spec?.motion||'fade'});
  }
  return clips;
}
