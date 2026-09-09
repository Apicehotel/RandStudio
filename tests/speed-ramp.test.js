import test from 'node:test';
import assert from 'node:assert/strict';
import {createSpeedRamp,rateAt,buildRampSegments,rampTimelineDuration,timelineToSource,withSpeedRamp,clearSpeedRamp} from '../src/core/speed-ramp.js';
import {atempoFilters} from '../src/core/ffmpeg-compiler.js';

test('preset builds a normalized curve',()=>{const r=createSpeedRamp('punch');assert.equal(r.schema,'randstudio.speed-ramp/v1');assert.equal(r.points[0].t,0);assert.equal(r.points.at(-1).t,1);assert.ok(rateAt(r,.5)>1)});

test('ramp segments preserve source span',()=>{const r=createSpeedRamp('smoothIn',{samples:8}),s=buildRampSegments(r,2,10);assert.equal(s.length,8);assert.equal(s[0].sourceStart,2);assert.equal(s.at(-1).sourceEnd,10);assert.ok(s.every(x=>x.timelineDuration>0))});

test('timeline duration changes with speed curve',()=>{const slow=createSpeedRamp('slowMo'),fast=createSpeedRamp('speedUp');assert.ok(rampTimelineDuration(slow,0,10)>rampTimelineDuration(fast,0,10))});

test('timeline to source is monotonic and bounded',()=>{const r=createSpeedRamp('punch'),d=rampTimelineDuration(r,3,13);const a=timelineToSource(r,3,13,d*.25),b=timelineToSource(r,3,13,d*.75);assert.ok(a>=3&&a<=13);assert.ok(b>a&&b<=13)});

test('with and clear speed ramp update timeline duration',()=>{const clip={start:5,in:0,out:10,playbackRate:1};const ramped=withSpeedRamp(clip,'speedUp');assert.ok(ramped.speedRamp);assert.ok(ramped.end>5);const clear=clearSpeedRamp(ramped);assert.equal(clear.speedRamp,undefined);assert.equal(clear.end,15)});

test('atempo decomposes rates outside one filter range',()=>{assert.deepEqual(atempoFilters(1),[]);assert.ok(atempoFilters(4).length>=2);assert.ok(atempoFilters(.25).length>=2)});
