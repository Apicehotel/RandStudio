import test from 'node:test';
import assert from 'node:assert/strict';
import { AIJobQueue } from '../src/ai/job-queue.js';
import { createWanCameraRequest, bindWanCameraWorkflow, discoverWanCameraBindings } from '../src/ai/wan-camera.js';
import { importAIResult } from '../src/ai/result-import.js';
import { ComfyUIAdapter } from '../src/adapters/comfyui.js';
import { createProject } from '../src/core/composition.js';

test('AI queue tracks lifecycle', () => {
  const q = new AIJobQueue({ now: () => 'now' });
  const job = q.add({ id: 'j1', kind: 'wan-camera', input: { motion: 'Zoom Out' } });
  assert.equal(job.status, 'queued');
  assert.equal(q.update('j1', { status: 'running', progress: .5 }).progress, .5);
  assert.equal(q.update('j1', { status: 'completed', progress: 1 }).status, 'completed');
});

test('Wan request validates and binds semantic fields including input image', () => {
  const request = createWanCameraRequest({ prompt: 'Cinematic hotel reveal', motion: 'Zoom Out', width: 640, height: 640, inputImageName:'randstudio/frame.png' });
  const template = { '1': { inputs: { text: '' } }, '2': { inputs: { motion: '', width: 0, height: 0, length: 0, speed: 0 } }, '3': { inputs:{ image:'old.png' } } };
  const bound = bindWanCameraWorkflow(template, request, { prompt:['1','text'], motion:['2','motion'], width:['2','width'], height:['2','height'], length:['2','length'], speed:['2','speed'], image:['3','image'] });
  assert.equal(bound['2'].inputs.motion, 'Zoom Out');
  assert.equal(bound['1'].inputs.text, 'Cinematic hotel reveal');
  assert.equal(bound['3'].inputs.image, 'randstudio/frame.png');
});

test('Wan binding discovery finds semantic camera, prompt and image nodes', () => {
  const workflow = {
    '10': { class_type:'CLIPTextEncode', _meta:{ title:'Positive Prompt' }, inputs:{ text:'' } },
    '20': { class_type:'WanCameraEmbedding', inputs:{ camera_motion:'Static', width:512, height:512, length:81, speed:1 } },
    '30': { class_type:'LoadImage', inputs:{ image:'input.png' } }
  };
  const bindings = discoverWanCameraBindings(workflow);
  assert.deepEqual(bindings.prompt, ['10','text']);
  assert.deepEqual(bindings.motion, ['20','camera_motion']);
  assert.deepEqual(bindings.image, ['30','image']);
});

test('ComfyUI output discovery accepts videos, gifs or images', () => {
  const client = new ComfyUIAdapter({ fetchImpl: async () => { throw new Error('not called'); } });
  assert.deepEqual(client.firstOutput({ outputs:{ '99':{ videos:[{ filename:'ai.mp4', subfolder:'wan', type:'output' }] } } }), { filename:'ai.mp4', subfolder:'wan', type:'output', kind:'videos' });
});

test('AI output returns to visual timeline', () => {
  const project = createProject();
  const result = importAIResult(project, { url: 'http://127.0.0.1:8188/view?filename=ai.mp4', duration: 3, at: 2 });
  assert.equal(result.clip.start, 2);
  assert.equal(result.clip.end, 5);
  assert.equal(result.clip.effects[0].type, 'ai-generated');
});
