import test from 'node:test';
import assert from 'node:assert/strict';
import { interpolateKeyframes, setKeyframe, evaluateEffect } from '../src/effects/keyframes.js';
import { parseCubeLUT, sampleLUT } from '../src/effects/lut.js';
import { linearExpression, effect, ffmpegFilters } from '../src/effects/effects-engine.js';
import { relinkScore, bestRelink } from '../src/persistence/indexeddb.js';
import { AIProviderRegistry, GatewayProvider } from '../src/ai/provider-registry.js';

const cube=`TITLE "Identity"\nLUT_3D_SIZE 2\nDOMAIN_MIN 0 0 0\nDOMAIN_MAX 1 1 1\n0 0 0\n1 0 0\n0 1 0\n1 1 0\n0 0 1\n1 0 1\n0 1 1\n1 1 1`;

test('keyframe interpolation and effect evaluation',()=>{
  assert.equal(interpolateKeyframes([{time:0,value:1},{time:2,value:2}],1),1.5);
  let fx=effect('brightness',{amount:1}); fx=setKeyframe(fx,'amount',0,1); fx=setKeyframe(fx,'amount',2,2);
  assert.equal(evaluateEffect(fx,1).params.amount,1.5);
  assert.match(ffmpegFilters([fx])[0],/eval=frame/);
  assert.match(linearExpression([{time:0,value:1},{time:1,value:2}],1),/if\(/);
});

test('cube LUT parser and sampler',()=>{
  const lut=parseCubeLUT(cube);
  assert.equal(lut.size,2);
  assert.deepEqual(sampleLUT(lut,[1,1,1]),[1,1,1]);
});

test('relink scoring prefers exact local file',()=>{
  const stored={name:'clip.mov',size:100,lastModified:20,mime:'video/quicktime'};
  const exact={name:'clip.mov',size:100,lastModified:20,type:'video/quicktime'};
  const other={name:'other.mov',size:50,lastModified:2,type:'video/quicktime'};
  assert.equal(relinkScore(stored,exact),10);
  assert.equal(bestRelink([stored],exact).item,stored);
  assert.ok(relinkScore(stored,exact)>relinkScore(stored,other));
});

test('zero-credit AI blocks remote gateways and allows local gateways',async()=>{
  assert.throws(()=>new GatewayProvider({endpoint:'https://example.invalid'}),/0 crediti|localhost|LAN/i);
  const calls=[];
  const provider=new GatewayProvider({id:'gateway',endpoint:'http://127.0.0.1:8188',fetchImpl:async(url,init)=>{calls.push({url,init});return{ok:true,json:async()=>({jobId:'job-1'})}}});
  const registry=new AIProviderRegistry(); registry.register(provider);
  const out=await registry.generate('gateway',{type:'image2video',prompt:'test'});
  assert.equal(out.jobId,'job-1');
  assert.equal(registry.list()[0].local,true);
  assert.equal(calls.length,1);
});
