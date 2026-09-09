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
export function normalizeEffects(list=[]){return list.map(item=>effect(item.id,item.params)).map((item,i)=>({...item,enabled:list[i]?.enabled!==false}))}
export function applyPreset(clip,presetId){const preset=EFFECT_PRESETS[presetId];if(!preset)throw new Error(`Unknown preset: ${presetId}`);return{...clip,effects:structuredClone(preset.effects)}}
export function cssFilter(effects=[]){return normalizeEffects(effects).filter(e=>e.enabled).map(e=>EFFECT_DEFINITIONS[e.id].css?.(e.params)||'').filter(Boolean).join(' ')||'none'}
export function ffmpegFilters(effects=[]){return normalizeEffects(effects).filter(e=>e.enabled).map(e=>EFFECT_DEFINITIONS[e.id].ffmpeg?.(e.params)||'').filter(Boolean)}
export function updateEffect(effects,id,params){const next=normalizeEffects(effects);const index=next.findIndex(e=>e.id===id);const value=effect(id,params);if(index<0)next.push(value);else next[index]={...next[index],params:value.params};return next}
function clamp(v,min,max){return Math.min(max,Math.max(min,Number.isFinite(v)?v:min))}
