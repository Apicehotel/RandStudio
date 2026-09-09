import { evaluateEffect, normalizeKeyframes } from './keyframes.js';

export const EFFECT_CATEGORIES = Object.freeze(['color','analog','blur','distort','transform','overlay','beauty','ai']);

export const EFFECT_DEFINITIONS = Object.freeze({
  brightness:{id:'brightness',name:'Luminosità',category:'color',params:{amount:{min:0,max:2,step:.01,default:1}},css:v=>`brightness(${v.amount})`,ffmpeg:v=>`eq=brightness=${(v.amount-1).toFixed(3)}`},
  contrast:{id:'contrast',name:'Contrasto',category:'color',params:{amount:{min:0,max:2,step:.01,default:1}},css:v=>`contrast(${v.amount})`,ffmpeg:v=>`eq=contrast=${v.amount.toFixed(3)}`},
  saturation:{id:'saturation',name:'Saturazione',category:'color',params:{amount:{min:0,max:2,step:.01,default:1}},css:v=>`saturate(${v.amount})`,ffmpeg:v=>`eq=saturation=${v.amount.toFixed(3)}`},
  grayscale:{id:'grayscale',name:'Bianco e nero',category:'color',params:{amount:{min:0,max:1,step:.01,default:1}},css:v=>`grayscale(${v.amount})`,ffmpeg:v=>`hue=s=${Math.max(0,1-v.amount).toFixed(3)}`},
  blur:{id:'blur',name:'Sfocatura',category:'blur',params:{radius:{min:0,max:24,step:.5,default:0}},css:v=>`blur(${v.radius}px)`,ffmpeg:v=>v.radius>0?`gblur=sigma=${Math.max(.1,v.radius/3).toFixed(2)}`:''},
  vhs:{id:'vhs',name:'VHS',category:'analog',params:{strength:{min:0,max:1,step:.05,default:.45}},css:v=>`contrast(${1+.12*v.strength}) saturate(${1-.14*v.strength})`,ffmpeg:v=>`noise=alls=${(8+22*v.strength).toFixed(1)}:allf=t,chromashift=cbh=${Math.round(2+6*v.strength)}:crh=${Math.round(-2-6*v.strength)}`},
  ntsc:{id:'ntsc',name:'NTSC',category:'analog',params:{strength:{min:0,max:1,step:.05,default:.35}},css:v=>`contrast(${1+.08*v.strength}) saturate(${1-.08*v.strength})`,ffmpeg:v=>`chromashift=cbh=${Math.round(1+5*v.strength)}:crh=${Math.round(-1-5*v.strength)},noise=alls=${(4+14*v.strength).toFixed(1)}:allf=t`},
  scanlines:{id:'scanlines',name:'Scanline',category:'analog',params:{strength:{min:0,max:1,step:.05,default:.3}},css:()=>'',ffmpeg:v=>`geq=lum='lum(X,Y)*(1-${(.18*v.strength).toFixed(3)}*mod(Y,2))':cb='cb(X,Y)':cr='cr(X,Y)'`},
});

export const EFFECT_PRESETS = Object.freeze({
  clean:{name:'Clean',effects:[]},
  cinematic:{name:'Cinema',effects:[effect('contrast',{amount:1.08}),effect('saturation',{amount:.9})]},
  vivid:{name:'Vivid',effects:[effect('contrast',{amount:1.06}),effect('saturation',{amount:1.28})]},
  bw:{name:'B/N',effects:[effect('grayscale',{amount:1}),effect('contrast',{amount:1.1})]},
  vhs:{name:'VHS',effects:[effect('vhs',{strength:.5}),effect('contrast',{amount:1.05})]},
  ntsc:{name:'NTSC',effects:[effect('ntsc',{strength:.4}),effect('scanlines',{strength:.25})]},
});

export function effect(id, values={}){const def=EFFECT_DEFINITIONS[id];if(!def)throw new Error(`Unknown effect: ${id}`);const params={};for(const [key,spec] of Object.entries(def.params))params[key]=clamp(Number(values[key]??spec.default),spec.min,spec.max);return{id,enabled:true,params}}
export function normalizeEffects(list=[]){return list.map(item=>{const base=effect(item.id,item.params);return{...base,enabled:item.enabled!==false,keyframes:normalizeKeyframeMap(item.keyframes)}})}
export function applyPreset(clip,presetId){const preset=EFFECT_PRESETS[presetId];if(!preset)throw new Error(`Unknown preset: ${presetId}`);return{...clip,effects:structuredClone(preset.effects)}}
export function cssFilter(effects=[],localTime=0){return normalizeEffects(effects).filter(e=>e.enabled).map(e=>{const evaluated=evaluateEffect(e,localTime);return EFFECT_DEFINITIONS[e.id].css?.(evaluated.params)||''}).filter(Boolean).join(' ')||'none'}
export function ffmpegFilters(effects=[]){return normalizeEffects(effects).filter(e=>e.enabled).map(e=>ffmpegForEffect(e)).filter(Boolean)}
export function updateEffect(effects,id,params){const next=normalizeEffects(effects);const index=next.findIndex(e=>e.id===id);const value=effect(id,params);if(index<0)next.push(value);else next[index]={...next[index],params:value.params};return next}

function ffmpegForEffect(e){
  const frames=e.keyframes??{};
  if(!Object.keys(frames).length)return EFFECT_DEFINITIONS[e.id].ffmpeg?.(e.params)||'';
  if(e.id==='brightness')return `eq=brightness='${offsetExpression(frames.amount,e.params.amount,-1)}':eval=frame`;
  if(e.id==='contrast')return `eq=contrast='${linearExpression(frames.amount,e.params.amount)}':eval=frame`;
  if(e.id==='saturation')return `eq=saturation='${linearExpression(frames.amount,e.params.amount)}':eval=frame`;
  if(e.id==='grayscale')return `hue=s='1-${linearExpression(frames.amount,e.params.amount)}'`;
  return EFFECT_DEFINITIONS[e.id].ffmpeg?.(evaluateEffect(e,0).params)||'';
}
function offsetExpression(frames,fallback,offset){return `(${linearExpression(frames,fallback)})${offset<0?offset:`+${offset}`}`}
export function linearExpression(frames,fallback=0){const f=normalizeKeyframes(frames);if(!f.length)return num(fallback);let expr=num(f.at(-1).value);for(let i=f.length-2;i>=0;i--){const a=f[i],b=f[i+1],span=Math.max(.000001,b.time-a.time),segment=`(${num(a.value)}+(${num(b.value)}-${num(a.value)})*(t-${num(a.time)})/${num(span)})`;expr=`if(lt(t,${num(b.time)}),${segment},${expr})`;}return `if(lte(t,${num(f[0].time)}),${num(f[0].value)},${expr})`}
function normalizeKeyframeMap(map={}){return Object.fromEntries(Object.entries(map).map(([key,frames])=>[key,normalizeKeyframes(frames)]).filter(([,frames])=>frames.length))}
function clamp(v,min,max){return Math.min(max,Math.max(min,Number.isFinite(v)?v:min))}
function num(v){return Number(v).toFixed(4).replace(/0+$/,'').replace(/\.$/,'')||'0'}
