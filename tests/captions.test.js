import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSRT, parseVTT, toSRT, toVTT, normalizeTranscript, splitForSocial, activeWord, captionGraphic, buildCaptionClips } from '../src/captions/caption-engine.js';
import { TranscriptionProviderRegistry } from '../src/captions/transcription-provider.js';

test('SRT roundtrip keeps timing and text',()=>{const src='1\n00:00:01,000 --> 00:00:03,500\nCiao mondo\n\n2\n00:00:04,000 --> 00:00:05,000\nSeconda riga';const t=parseSRT(src);assert.equal(t.segments.length,2);assert.equal(t.segments[0].start,1);assert.equal(t.segments[0].end,3.5);assert.match(toSRT(t),/Ciao mondo/)});

test('VTT parser and exporter work',()=>{const t=parseVTT('WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nTest');assert.equal(t.segments[0].text,'Test');assert.match(toVTT(t),/^WEBVTT/)});

test('social split creates word-timed chunks even without word timestamps',()=>{const t=normalizeTranscript({segments:[{start:0,end:6,text:'uno due tre quattro cinque sei sette otto nove'}]});const chunks=splitForSocial(t.segments[0],'social');assert.ok(chunks.length>=2);assert.ok(chunks[0].words.length>0);assert.ok(chunks[0].end<=chunks[1].end)});

test('karaoke graphic can highlight active word',()=>{const segment={id:'x',start:0,end:2,text:'ciao mondo',words:[{text:'ciao',start:0,end:1},{text:'mondo',start:1,end:2}]};assert.equal(activeWord(segment,.5).text,'ciao');const g=captionGraphic(segment,'karaoke',1.5);assert.equal(g.type,'caption');assert.equal(g.activeWord,'mondo')});

test('caption clips materialize social chunks and karaoke words',()=>{const t=normalizeTranscript({segments:[{start:0,end:2,text:'ciao mondo',words:[{text:'ciao',start:0,end:1},{text:'mondo',start:1,end:2}]}]});const social=buildCaptionClips(t,'social');assert.ok(social.length>=1);assert.equal(social[0].type,'caption');assert.equal(social[0].graphic.type,'caption');const karaoke=buildCaptionClips(t,'karaoke');assert.equal(karaoke.length,2);assert.equal(karaoke[0].graphic.activeWord,'ciao');assert.equal(karaoke[1].graphic.activeWord,'mondo')});

test('transcription registry normalizes provider output',async()=>{const registry=new TranscriptionProviderRegistry().register({id:'fake',name:'Fake',async transcribe(){return{segments:[{start:0,end:1,text:'ok'}]}}});const t=await registry.transcribe('fake',{});assert.equal(t.schema,'randstudio.caption/v1');assert.equal(t.segments[0].text,'ok')});
