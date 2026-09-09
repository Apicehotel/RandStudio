import test from 'node:test';
import assert from 'node:assert/strict';
import { effect, applyPreset, cssFilter, ffmpegFilters, updateEffect } from '../src/effects/effects-engine.js';

test('normalizes, clamps and updates effects',()=>{
  assert.equal(effect('brightness',{amount:9}).params.amount,2);
  const list=updateEffect([], 'saturation', {amount:1.3});
  assert.equal(list[0].params.amount,1.3);
});

test('preset produces browser and FFmpeg effect chains',()=>{
  const clip=applyPreset({id:'c1',effects:[]},'ntsc');
  assert.equal(clip.effects.length,2);
  assert.match(cssFilter(clip.effects),/contrast|saturate/);
  const filters=ffmpegFilters(clip.effects);
  assert.ok(filters.some(x=>x.includes('chromashift')));
  assert.ok(filters.some(x=>x.includes('geq=')));
});

test('clean preset removes effects',()=>{
  const clip=applyPreset({id:'c1',effects:[effect('vhs')]},'clean');
  assert.deepEqual(clip.effects,[]);
  assert.equal(cssFilter(clip.effects),'none');
});
