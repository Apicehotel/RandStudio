import { evaluateEffect } from './keyframes.js';
import { EFFECT_DEFINITIONS } from './effects-engine.js';

const WGSL = `
struct Uniforms { brightness:f32, contrast:f32, saturation:f32, grayscale:f32 };
@group(0) @binding(0) var samp: sampler;
@group(0) @binding(1) var tex: texture_2d<f32>;
@group(0) @binding(2) var<uniform> u: Uniforms;
struct VSOut { @builtin(position) pos: vec4<f32>, @location(0) uv: vec2<f32> };
@vertex fn vs(@builtin(vertex_index) i:u32) -> VSOut {
  var p = array<vec2<f32>,6>(vec2(-1.,-1.),vec2(1.,-1.),vec2(-1.,1.),vec2(-1.,1.),vec2(1.,-1.),vec2(1.,1.));
  var uv = array<vec2<f32>,6>(vec2(0.,1.),vec2(1.,1.),vec2(0.,0.),vec2(0.,0.),vec2(1.,1.),vec2(1.,0.));
  var o:VSOut; o.pos=vec4(p[i],0.,1.); o.uv=uv[i]; return o;
}
fn sat(c:vec3<f32>, s:f32)->vec3<f32>{ let l=dot(c,vec3(.2126,.7152,.0722)); return mix(vec3(l),c,s); }
@fragment fn fs(i:VSOut)->@location(0) vec4<f32>{
  var c=textureSample(tex,samp,i.uv);
  c.rgb*=u.brightness;
  c.rgb=(c.rgb-vec3(.5))*u.contrast+vec3(.5);
  c.rgb=sat(c.rgb,u.saturation);
  let g=dot(c.rgb,vec3(.2126,.7152,.0722));
  c.rgb=mix(c.rgb,vec3(g),u.grayscale);
  return vec4(clamp(c.rgb,vec3(0.),vec3(1.)),c.a);
}`;

export class WebGPUEffectsRenderer {
  constructor(canvas) { this.canvas = canvas; this.ready = false; }
  static supported() { return Boolean(globalThis.navigator?.gpu); }
  async init() {
    if (!WebGPUEffectsRenderer.supported()) return false;
    this.adapter = await navigator.gpu.requestAdapter();
    if (!this.adapter) return false;
    this.device = await this.adapter.requestDevice();
    this.context = this.canvas.getContext('webgpu');
    this.format = navigator.gpu.getPreferredCanvasFormat();
    this.context.configure({ device:this.device, format:this.format, alphaMode:'premultiplied' });
    this.pipeline = this.device.createRenderPipeline({
      layout:'auto', vertex:{module:this.device.createShaderModule({code:WGSL}),entryPoint:'vs'},
      fragment:{module:this.device.createShaderModule({code:WGSL}),entryPoint:'fs',targets:[{format:this.format}]},
      primitive:{topology:'triangle-list'}
    });
    this.sampler = this.device.createSampler({magFilter:'linear',minFilter:'linear'});
    this.uniformBuffer = this.device.createBuffer({size:16,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});
    this.ready = true; return true;
  }
  async render(source, effects = [], localTime = 0) {
    if (!this.ready && !(await this.init())) return false;
    const bitmap = await createImageBitmap(source);
    if (this.canvas.width !== bitmap.width || this.canvas.height !== bitmap.height) { this.canvas.width=bitmap.width; this.canvas.height=bitmap.height; this.context.configure({device:this.device,format:this.format,alphaMode:'premultiplied'}); }
    const texture=this.device.createTexture({size:[bitmap.width,bitmap.height],format:'rgba8unorm',usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST|GPUTextureUsage.RENDER_ATTACHMENT});
    this.device.queue.copyExternalImageToTexture({source:bitmap},{texture},[bitmap.width,bitmap.height]);
    const values=collectColorValues(effects,localTime);
    this.device.queue.writeBuffer(this.uniformBuffer,0,new Float32Array([values.brightness,values.contrast,values.saturation,values.grayscale]));
    const bind=this.device.createBindGroup({layout:this.pipeline.getBindGroupLayout(0),entries:[{binding:0,resource:this.sampler},{binding:1,resource:texture.createView()},{binding:2,resource:{buffer:this.uniformBuffer}}]});
    const encoder=this.device.createCommandEncoder();
    const pass=encoder.beginRenderPass({colorAttachments:[{view:this.context.getCurrentTexture().createView(),clearValue:{r:0,g:0,b:0,a:0},loadOp:'clear',storeOp:'store'}]});
    pass.setPipeline(this.pipeline); pass.setBindGroup(0,bind); pass.draw(6); pass.end();
    this.device.queue.submit([encoder.finish()]); bitmap.close?.(); texture.destroy(); return true;
  }
}

export function collectColorValues(effects=[], localTime=0){
  const out={brightness:1,contrast:1,saturation:1,grayscale:0};
  for(const raw of effects){ if(raw.enabled===false)continue; const e=evaluateEffect(raw,localTime); if(!(e.id in out))continue; const def=EFFECT_DEFINITIONS[e.id]; if(!def)continue; const key=Object.keys(def.params)[0]; out[e.id]=Number(e.params[key]??out[e.id]); }
  return out;
}
