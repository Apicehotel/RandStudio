export const MOTION_PRESETS=Object.freeze({
  none:{name:'Nessuna',in:null,out:null},
  fade:{name:'Fade',in:{kind:'fade',duration:.35},out:{kind:'fade',duration:.3}},
  slideUp:{name:'Slide Up',in:{kind:'slide',axis:'y',from:120,duration:.45},out:null},
  slideLeft:{name:'Slide Left',in:{kind:'slide',axis:'x',from:160,duration:.45},out:null},
  pop:{name:'Pop',in:{kind:'pop',fromScale:.72,duration:.32},out:null},
  bounce:{name:'Bounce',in:{kind:'bounce',from:100,duration:.55},out:null},
});

export function applyMotionPreset(clip,presetId){if(!MOTION_PRESETS[presetId])throw new Error(`Unknown motion preset: ${presetId}`);return{...clip,motion:{schema:'randstudio.motion/v1',preset:presetId,...structuredClone(MOTION_PRESETS[presetId])}}}

export function evaluateMotion(motion,localTime,duration){
  if(!motion||motion.preset==='none')return{x:0,y:0,scale:1,opacity:1};
  let state={x:0,y:0,scale:1,opacity:1};const entry=motion.in;
  if(entry&&localTime<entry.duration){const p=clamp(localTime/entry.duration,0,1),e=easeOutCubic(p);if(entry.kind==='fade')state.opacity=e;if(entry.kind==='slide')state[entry.axis]=(entry.from||0)*(1-e);if(entry.kind==='pop')state.scale=(entry.fromScale||.75)+(1-(entry.fromScale||.75))*backOut(p);if(entry.kind==='bounce')state.y=(entry.from||80)*(1-bounceOut(p));}
  const exit=motion.out;if(exit&&duration-localTime<exit.duration){const p=clamp((duration-localTime)/exit.duration,0,1);if(exit.kind==='fade')state.opacity*=p;}
  return state;
}

export function ffmpegMotion(motion,{clipStart=0,clipDuration=1,baseX=0,baseY=0}={}){
  const preset=motion?.preset||'none',filters=[],overlay={x:`(W-w)/2+${num(baseX)}`,y:`(H-h)/2+${num(baseY)}`};
  if(preset==='fade')filters.push(`fade=t=in:st=0:d=.35:alpha=1`,`fade=t=out:st=${num(Math.max(0,clipDuration-.3))}:d=.3:alpha=1`);
  if(preset==='slideUp'){overlay.y=`(H-h)/2+${num(baseY)}+if(lt(t,${num(clipStart+.45)}),120*(1-(t-${num(clipStart)})/.45),0)`;filters.push('fade=t=in:st=0:d=.2:alpha=1')}
  if(preset==='slideLeft'){overlay.x=`(W-w)/2+${num(baseX)}+if(lt(t,${num(clipStart+.45)}),160*(1-(t-${num(clipStart)})/.45),0)`;filters.push('fade=t=in:st=0:d=.2:alpha=1')}
  if(preset==='bounce'){overlay.y=`(H-h)/2+${num(baseY)}+if(lt(t,${num(clipStart+.55)}),100*(1-(t-${num(clipStart)})/.55)*cos(10*(t-${num(clipStart)})),0)`;filters.push('fade=t=in:st=0:d=.15:alpha=1')}
  if(preset==='pop')filters.push('fade=t=in:st=0:d=.18:alpha=1');
  return{filters,overlay};
}
function easeOutCubic(t){return 1-(1-t)**3}function backOut(t){const c1=1.70158,c3=c1+1;return 1+c3*(t-1)**3+c1*(t-1)**2}function bounceOut(t){const n1=7.5625,d1=2.75;if(t<1/d1)return n1*t*t;if(t<2/d1){t-=1.5/d1;return n1*t*t+.75}if(t<2.5/d1){t-=2.25/d1;return n1*t*t+.9375}t-=2.625/d1;return n1*t*t+.984375}function clamp(v,a,b){return Math.min(b,Math.max(a,v))}function num(v){return Number(v).toFixed(3).replace(/\.000$/,'')}
