import { evaluateEffect, normalizeKeyframes } from './keyframes.js';

export const EFFECT_CATEGORIES = Object.freeze(['color','analog','blur','distort','transform','overlay','beauty','stylize','key','ai']);

export const EFFECT_DEFINITIONS = Object.freeze({
  brightness:{id:'brightness',name:'Luminosità',category:'color',params:{amount:{min:0,max:2,step:.01,default:1}},css:v=>`brightness(${v.amount})`,ffmpeg:v=>`eq=brightness=${(v.amount-1).toFixed(3)}`},
  contrast:{id:'contrast',name:'Contrasto',category:'color',params:{amount:{min:0,max:2,step:.01,default:1}},css:v=>`contrast(${v.amount})`,ffmpeg:v=>`eq=contrast=${v.amount.toFixed(3)}`},
  saturation:{id:'saturation',name:'Saturazione',category:'color',params:{amount:{min:0,max:2,step:.01,default:1}},css:v=>`saturate(${v.amount})`,ffmpeg:v=>`eq=saturation=${v.amount.toFixed(3)}`},
  grayscale:{id:'grayscale',name:'Bianco e nero',category:'color',params:{amount:{min:0,max:1,step:.01,default:1}},css:v=>`grayscale(${v.amount})`,ffmpeg:v=>`hue=s=${Math.max(0,1-v.amount).toFixed(3)}`},
  sepia:{id:'sepia',name:'Sepia',category:'color',params:{amount:{min:0,max:1,step:.05,default:1}},css:v=>`sepia(${v.amount})`,ffmpeg:v=>v.amount>.01?`colorchannelmixer=.393:.769:.189:0:.349:.686:.168:0:.272:.534:.131`:''},
  invert:{id:'invert',name:'Negativo',category:'stylize',params:{amount:{min:0,max:1,step:1,default:1}},css:v=>`invert(${v.amount})`,ffmpeg:v=>v.amount>.5?'negate':''},
  blur:{id:'blur',name:'Sfocatura',category:'blur',params:{radius:{min:0,max:24,step:.5,default:0}},css:v=>`blur(${v.radius}px)`,ffmpeg:v=>v.radius>0?`gblur=sigma=${Math.max(.1,v.radius/3).toFixed(2)}`:''},
  sharpen:{id:'sharpen',name:'Sharpen',category:'beauty',params:{strength:{min:0,max:1,step:.05,default:.35}},css:v=>`contrast(${1+.08*v.strength})`,ffmpeg:v=>`unsharp=5:5:${(1.4*v.strength).toFixed(2)}:5:5:0`},
  soft:{id:'soft',name:'Soft Focus',category:'beauty',params:{strength:{min:0,max:1,step:.05,default:.35}},css:v=>`brightness(${1+.03*v.strength}) saturate(${1-.06*v.strength})`,ffmpeg:v=>`gblur=sigma=${(.25+1.25*v.strength).toFixed(2)},eq=brightness=${(.025*v.strength).toFixed(3)}:saturation=${(1-.08*v.strength).toFixed(3)}`},
  warm:{id:'warm',name:'Warm',category:'color',params:{strength:{min:0,max:1,step:.05,default:.4}},css:v=>`sepia(${.12*v.strength}) saturate(${1+.08*v.strength})`,ffmpeg:v=>`colorbalance=rs=${(.12*v.strength).toFixed(3)}:gs=${(.025*v.strength).toFixed(3)}:bs=${(-.1*v.strength).toFixed(3)}`},
  cool:{id:'cool',name:'Cool',category:'color',params:{strength:{min:0,max:1,step:.05,default:.4}},css:v=>`hue-rotate(${(-8*v.strength).toFixed(1)}deg)`,ffmpeg:v=>`colorbalance=rs=${(-.08*v.strength).toFixed(3)}:gs=${(.01*v.strength).toFixed(3)}:bs=${(.12*v.strength).toFixed(3)}`},
  glow:{id:'glow',name:'Glow',category:'overlay',params:{strength:{min:0,max:1,step:.05,default:.35}},css:v=>`drop-shadow(0 0 ${Math.round(18*v.strength)}px rgba(255,255,255,${(.45*v.strength).toFixed(2)}))`,ffmpeg:v=>`unsharp=5:5:${(-.7*v.strength).toFixed(2)}:5:5:0,eq=brightness=${(.04*v.strength).toFixed(3)}`},
  vignette:{id:'vignette',name:'Vignetta',category:'overlay',params:{strength:{min:0,max:1,step:.05,default:.45}},css:()=>'',ffmpeg:v=>`vignette=PI/${Math.max(2,Math.round(8-4*v.strength))}`},
  grain:{id:'grain',name:'Film Grain',category:'analog',params:{strength:{min:0,max:1,step:.05,default:.25}},css:()=>'',ffmpeg:v=>`noise=alls=${(2+18*v.strength).toFixed(1)}:allf=t+u`},
  glitch:{id:'glitch',name:'Glitch',category:'distort',params:{strength:{min:0,max:1,step:.05,default:.45}},css:v=>`contrast(${1+.15*v.strength}) saturate(${1+.25*v.strength})`,ffmpeg:v=>`chromashift=cbh=${Math.round(3+14*v.strength)}:crh=${Math.round(-3-14*v.strength)},noise=alls=${(8+24*v.strength).toFixed(1)}:allf=t`},
  vhs:{id:'vhs',name:'VHS',category:'analog',params:{strength:{min:0,max:1,step:.05,default:.45}},css:v=>`contrast(${1+.12*v.strength}) saturate(${1-.14*v.strength})`,ffmpeg:v=>`noise=alls=${(8+22*v.strength).toFixed(1)}:allf=t,chromashift=cbh=${Math.round(2+6*v.strength)}:crh=${Math.round(-2-6*v.strength)}`},
  ntsc:{id:'ntsc',name:'NTSC',category:'analog',params:{strength:{min:0,max:1,step:.05,default:.35}},css:v=>`contrast(${1+.08*v.strength}) saturate(${1-.08*v.strength})`,ffmpeg:v=>`chromashift=cbh=${Math.round(1+5*v.strength)}:crh=${Math.round(-1-5*v.strength)},noise=alls=${(4+14*v.strength).toFixed(1)}:allf=t`},
  scanlines:{id:'scanlines',name:'Scanline',category:'analog',params:{strength:{min:0,max:1,step:.05,default:.3}},css:()=>'',ffmpeg:v=>`geq=lum='lum(X,Y)*(1-${(.18*v.strength).toFixed(3)}*mod(Y,2))':cb='cb(X,Y)':cr='cr(X,Y)'`},
  pixelate:{id:'pixelate',name:'Pixelate',category:'stylize',params:{strength:{min:1,max:24,step:1,default:8}},css:()=>'',ffmpeg:v=>`scale=iw/${Math.max(1,Math.round(v.strength))}:ih/${Math.max(1,Math.round(v.strength))},scale=iw*${Math.max(1,Math.round(v.strength))}:ih*${Math.max(1,Math.round(v.strength))}:flags=neighbor`},
  fisheye:{id:'fisheye',name:'Fisheye',category:'distort',params:{strength:{min:0,max:1,step:.05,default:.45}},css:()=>'',ffmpeg:v=>`lenscorrection=k1=${(-.42*v.strength).toFixed(3)}:k2=${(.08*v.strength).toFixed(3)}`},
  edge:{id:'edge',name:'Edge',category:'stylize',params:{strength:{min:0,max:1,step:.05,default:.5}},css:v=>`contrast(${1+.4*v.strength}) grayscale(${.5*v.strength})`,ffmpeg:v=>`edgedetect=low=${(.03+.12*v.strength).toFixed(3)}:high=${(.12+.35*v.strength).toFixed(3)}`},
  chromaKey:{id:'chromaKey',name:'Green Screen',category:'key',params:{similarity:{min:.01,max:.6,step:.01,default:.18},blend:{min:0,max:.3,step:.01,default:.08}},css:()=>'',ffmpeg:v=>`chromakey=0x00FF00:${v.similarity.toFixed(3)}:${v.blend.toFixed(3)}`},
});

export const EFFECT_PRESETS = Object.freeze({
  clean:{name:'Clean',effects:[]},
  cinematic:{name:'Cinema',effects:[effect('contrast',{amount:1.08}),effect('saturation',{amount:.9})]},
  cinemaPro:{name:'Cinema Pro',effects:[effect('contrast',{amount:1.1}),effect('saturation',{amount:.88}),effect('vignette',{strength:.35}),effect('grain',{strength:.16}),effect('glow',{strength:.15})]},
  tealOrange:{name:'Teal & Orange',effects:[effect('contrast',{amount:1.1}),effect('saturation',{amount:1.05}),effect('warm',{strength:.48}),effect('cool',{strength:.18}),effect('vignette',{strength:.22})]},
  warmFilm:{name:'Warm Film',effects:[effect('warm',{strength:.6}),effect('grain',{strength:.14}),effect('contrast',{amount:1.05})]},
  coolFilm:{name:'Cool Film',effects:[effect('cool',{strength:.55}),effect('contrast',{amount:1.06}),effect('grain',{strength:.12})]},
  vintage:{name:'Vintage',effects:[effect('sepia',{amount:.65}),effect('grain',{strength:.22}),effect('vignette',{strength:.4}),effect('contrast',{amount:.96})]},
  hdr:{name:'HDR Look',effects:[effect('sharpen',{strength:.55}),effect('contrast',{amount:1.14}),effect('saturation',{amount:1.12})]},
  softFilm:{name:'Soft Film',effects:[effect('soft',{strength:.4}),effect('warm',{strength:.2}),effect('grain',{strength:.08})]},
  vivid:{name:'Vivid',effects:[effect('contrast',{amount:1.06}),effect('saturation',{amount:1.28})]},
  bw:{name:'B/N',effects:[effect('grayscale',{amount:1}),effect('contrast',{amount:1.1}),effect('grain',{strength:.12})]},
  dreamy:{name:'Dreamy Glow',effects:[effect('glow',{strength:.55}),effect('saturation',{amount:1.08})]},
  glitch:{name:'Glitch',effects:[effect('glitch',{strength:.55}),effect('contrast',{amount:1.08})]},
  vhs:{name:'VHS',effects:[effect('vhs',{strength:.5}),effect('contrast',{amount:1.05})]},
  ntsc:{name:'NTSC',effects:[effect('ntsc',{strength:.4}),effect('scanlines',{strength:.25})]},
  pixel:{name:'Pixel',effects:[effect('pixelate',{strength:10})]},
  fisheye:{name:'Fisheye',effects:[effect('fisheye',{strength:.55})]},
  edge:{name:'Edge',effects:[effect('edge',{strength:.5})]},
  greenScreen:{name:'Green Screen',effects:[effect('chromaKey',{similarity:.18,blend:.08})]},
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
