import test from 'node:test';
import assert from 'node:assert/strict';
import { applyMotionPreset, evaluateMotion, ffmpegMotion } from '../src/graphics/motion-engine.js';

test('motion presets are stored on clip',()=>{
  const clip=applyMotionPreset({id:'c1'},'slideUp');
  assert.equal(clip.motion.schema,'randstudio.motion/v1');
  assert.equal(clip.motion.preset,'slideUp');
});

test('preview motion evaluates entry state',()=>{
  const clip=applyMotionPreset({id:'c1'},'fade');
  const start=evaluateMotion(clip.motion,0,4);
  const mid=evaluateMotion(clip.motion,.2,4);
  assert.equal(start.opacity,0);
  assert.ok(mid.opacity>0&&mid.opacity<1);
});

test('ffmpeg motion generates overlay expressions',()=>{
  const clip=applyMotionPreset({id:'c1'},'slideLeft');
  const out=ffmpegMotion(clip.motion,{clipStart:2,clipDuration:4,baseX:0,baseY:0});
  assert.match(out.overlay.x,/if\(lt\(t/);
  assert.ok(out.filters.some(x=>x.includes('fade=t=in')));
});
