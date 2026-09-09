import{normalizeTranscript}from'./caption-engine.js';

export class TranscriptionProviderRegistry{
  constructor(){this.providers=new Map()}
  register(provider){if(!provider?.id||typeof provider.transcribe!=='function')throw new Error('Provider trascrizione non valido');this.providers.set(provider.id,provider);return this}
  get(id){return this.providers.get(id)}
  list(){return[...this.providers.values()].map(p=>({id:p.id,name:p.name,local:!!p.local}))}
  async transcribe(id,input){const p=this.get(id);if(!p)throw new Error(`Provider trascrizione non trovato: ${id}`);return normalizeTranscript(await p.transcribe(input))}
}

export class GatewayTranscriptionProvider{
  constructor(endpoint){this.id='gateway-stt';this.name='AI Gateway STT';this.endpoint=String(endpoint||'').replace(/\/$/,'')}
  async transcribe({file,language='auto',wordTimestamps=true}){
    if(!this.endpoint)throw new Error('Endpoint STT non configurato');if(!file)throw new Error('File audio/video mancante');
    const body=new FormData();body.append('file',file,file.name||'media');body.append('language',language);body.append('word_timestamps',String(!!wordTimestamps));
    const r=await fetch(`${this.endpoint}/transcribe`,{method:'POST',body});if(!r.ok)throw new Error(`STT gateway HTTP ${r.status}`);const data=await r.json();return{...data,source:'gateway-stt'}
  }
}

export class WhisperCppHttpProvider{
  constructor(endpoint='http://127.0.0.1:8080'){this.id='whispercpp';this.name='Whisper.cpp locale';this.local=true;this.endpoint=String(endpoint).replace(/\/$/,'')}
  async transcribe({file,language='auto'}){
    if(!file)throw new Error('File audio/video mancante');const body=new FormData();body.append('file',file,file.name||'media');body.append('language',language);
    const candidates=[`${this.endpoint}/inference`,`${this.endpoint}/transcribe`];let last;
    for(const url of candidates)try{const r=await fetch(url,{method:'POST',body});if(!r.ok){last=new Error(`HTTP ${r.status}`);continue}const data=await r.json();return normalizeWhisperPayload(data)}catch(e){last=e}
    throw last||new Error('Whisper.cpp non raggiungibile')
  }
}

export function createTranscriptionRegistry({gatewayEndpoint='',whisperEndpoint='http://127.0.0.1:8080'}={}){const r=new TranscriptionProviderRegistry();r.register(new WhisperCppHttpProvider(whisperEndpoint));if(gatewayEndpoint)r.register(new GatewayTranscriptionProvider(gatewayEndpoint));return r}

function normalizeWhisperPayload(data){if(Array.isArray(data?.segments))return{language:data.language||'auto',segments:data.segments,source:'whisper.cpp'};if(Array.isArray(data?.transcription))return{language:data.language||'auto',segments:data.transcription.map((x,i)=>({id:`w-${i}`,start:x.timestamps?.from??x.start??0,end:x.timestamps?.to??x.end??0,text:x.text??''})),source:'whisper.cpp'};if(typeof data?.text==='string')return{segments:[{start:0,end:Number(data.duration||5),text:data.text}],source:'whisper.cpp'};throw new Error('Formato risposta Whisper non riconosciuto')}
