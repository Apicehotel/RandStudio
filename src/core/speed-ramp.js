export const SPEED_RAMP_SCHEMA='randstudio.speed-ramp/v1';

export const SPEED_RAMP_PRESETS=Object.freeze({
  smoothIn:{id:'smoothIn',name:'Accelera',points:[{t:0,rate:.65},{t:.45,rate:1},{t:1,rate:1.8}]},
  smoothOut:{id:'smoothOut',name:'Rallenta',points:[{t:0,rate:1.8},{t:.55,rate:1},{t:1,rate:.65}]},
  punch:{id:'punch',name:'Punch',points:[{t:0,rate:1},{t:.28,rate:1},{t:.5,rate:2},{t:.72,rate:1},{t:1,rate:1}]},
  slowMo:{id:'slowMo',name:'Slow-Mo Focus',points:[{t:0,rate:1},{t:.3,rate:1},{t:.5,rate:.5},{t:.7,rate:1},{t:1,rate:1}]},
  speedUp:{id:'speedUp',name:'Speed Up',points:[{t:0,rate:1},{t:.35,rate:1.25},{t:.7,rate:1.75},{t:1,rate:2}]},
});

export function createSpeedRamp(presetOrPoints='punch',options={}){
  const preset=typeof presetOrPoints==='string'?SPEED_RAMP_PRESETS[presetOrPoints]:null;
  const points=normalizePoints(preset?.points||presetOrPoints);
  return{schema:SPEED_RAMP_SCHEMA,preset:preset?.id||options.preset||'custom',samples:clampInt(options.samples??12,4,48),points};
}

export function normalizePoints(points=[]){
  const list=(Array.isArray(points)?points:[]).map(p=>({t:clamp(Number(p.t),0,1),rate:clamp(Number(p.rate),.25,4)})).filter(p=>Number.isFinite(p.t)&&Number.isFinite(p.rate)).sort((a,b)=>a.t-b.t);
  if(!list.length)return[{t:0,rate:1},{t:1,rate:1}];
  if(list[0].t>0)list.unshift({t:0,rate:list[0].rate});else list[0].t=0;
  if(list.at(-1).t<1)list.push({t:1,rate:list.at(-1).rate});else list.at(-1).t=1;
  return dedupe(list);
}

export function rateAt(ramp,normalizedTime){const p=normalizePoints(ramp?.points),t=clamp(Number(normalizedTime),0,1);for(let i=0;i<p.length-1;i++){const a=p[i],b=p[i+1];if(t<=b.t){const x=(t-a.t)/Math.max(1e-9,b.t-a.t);return a.rate+(b.rate-a.rate)*x}}return p.at(-1).rate}

export function buildRampSegments(ramp,sourceIn,sourceOut){
  const start=Number(sourceIn)||0,end=Math.max(start+.001,Number(sourceOut)||start+.001),span=end-start,samples=clampInt(ramp?.samples??12,4,48),segments=[];
  for(let i=0;i<samples;i++){const a=i/samples,b=(i+1)/samples,mid=(a+b)/2,rate=rateAt(ramp,mid),s0=start+span*a,s1=start+span*b;segments.push({index:i,sourceStart:s0,sourceEnd:s1,sourceDuration:s1-s0,rate,timelineDuration:(s1-s0)/rate})}
  return segments;
}

export function rampTimelineDuration(ramp,sourceIn,sourceOut){return buildRampSegments(ramp,sourceIn,sourceOut).reduce((sum,s)=>sum+s.timelineDuration,0)}

export function timelineToSource(ramp,sourceIn,sourceOut,timelineOffset){const segments=buildRampSegments(ramp,sourceIn,sourceOut),target=Math.max(0,Number(timelineOffset)||0);let elapsed=0;for(const s of segments){if(target<=elapsed+s.timelineDuration){const x=(target-elapsed)/Math.max(1e-9,s.timelineDuration);return s.sourceStart+(s.sourceEnd-s.sourceStart)*clamp(x,0,1)}elapsed+=s.timelineDuration}return Number(sourceOut)}

export function withSpeedRamp(clip,presetId){const ramp=createSpeedRamp(presetId),next=structuredClone(clip);next.speedRamp=ramp;next.playbackRate=1;next.end=next.start+rampTimelineDuration(ramp,next.in,next.out);return next}
export function clearSpeedRamp(clip){const next=structuredClone(clip);delete next.speedRamp;next.end=next.start+(next.out-next.in)/Math.max(.05,next.playbackRate||1);return next}

function dedupe(list){const out=[];for(const item of list){const prev=out.at(-1);if(prev&&Math.abs(prev.t-item.t)<1e-9)out[out.length-1]=item;else out.push(item)}return out}
function clamp(v,min,max){return Math.min(max,Math.max(min,Number.isFinite(v)?v:min))}function clampInt(v,min,max){return Math.round(clamp(Number(v),min,max))}
