import test from 'node:test';
import assert from 'node:assert/strict';
import { createGraphicSpec, isGraphicClip, STICKER_PACK } from '../src/graphics/overlay-engine.js';
import { createProject, addClip, validateProject } from '../src/core/composition.js';

test('graphic presets create versioned overlay specs',()=>{
  const title=createGraphicSpec('text',{text:'Hello'});
  const lower=createGraphicSpec('lower-third',{text:'Mario',subtitle:'Reception'});
  assert.equal(title.schema,'randstudio.graphic/v1');
  assert.equal(title.text,'Hello');
  assert.equal(lower.type,'lower-third');
  assert.equal(lower.subtitle,'Reception');
});

test('graphic clips survive composition contract',()=>{
  const p=createProject();
  const graphic=createGraphicSpec('callout',{text:'Guarda qui'});
  const next=addClip(p,'video-1',{id:'gfx-1',type:'callout',name:'Callout',sourceId:'graphic:gfx-1',start:0,duration:4,in:0,out:4,graphic});
  const clip=next.tracks[0].clips[0];
  assert.equal(isGraphicClip(clip),true);
  assert.equal(clip.graphic.text,'Guarda qui');
  assert.deepEqual(validateProject(next),[]);
});

test('sticker pack is populated and reusable',()=>{
  assert.ok(STICKER_PACK.length>=10);
  assert.ok(STICKER_PACK.includes('❤️'));
});
