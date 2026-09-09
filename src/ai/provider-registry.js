export const ZERO_CREDIT_AI=true;

export class AIProviderRegistry {
  constructor() { this.providers = new Map(); }
  register(provider) { if (!provider?.id || typeof provider.generate !== 'function') throw new Error('Provider AI non valido'); if(ZERO_CREDIT_AI&&provider.local===false)throw new Error('Modalità 0 crediti: provider remoto a consumo bloccato'); this.providers.set(provider.id, provider); return provider; }
  get(id) { const provider=this.providers.get(id); if(!provider) throw new Error(`Provider AI non trovato: ${id}`); return provider; }
  list() { return [...this.providers.values()].map(({id,name,capabilities=[],local=true})=>({id,name,local,capabilities:[...capabilities]})); }
  async generate(id, request, options) { const provider=this.get(id);if(ZERO_CREDIT_AI&&provider.local===false)throw new Error('Modalità 0 crediti: provider remoto bloccato');return provider.generate(request, options); }
}

export class ComfyUIProvider {
  constructor(adapter) { this.id='comfyui'; this.name='ComfyUI locale'; this.local=true; this.capabilities=['wan-camera','workflow','image2video','video2video','text2video']; this.adapter=adapter; }
  async generate(request, { workflow, bindings, bindWorkflow } = {}) {
    if (!workflow || !bindings || typeof bindWorkflow !== 'function') throw new Error('Workflow/bindings ComfyUI mancanti');
    const prompt=bindWorkflow(workflow,request,bindings);
    const job=await this.adapter.enqueue(prompt);
    return { provider:this.id, jobId:job.promptId, raw:job };
  }
}

export class GatewayProvider {
  constructor({ id='local-gateway', name='AI Gateway locale', endpoint, fetchImpl=fetch, allowRemote=false }={}) { if(!endpoint)throw new Error('AI gateway endpoint mancante'); this.id=id; this.name=name; this.endpoint=endpoint.replace(/\/$/,''); this.fetch=fetchImpl; this.local=isLocalEndpoint(this.endpoint); if(ZERO_CREDIT_AI&&!allowRemote&&!this.local)throw new Error('Modalità 0 crediti: il gateway AI deve essere localhost o LAN'); this.capabilities=['image2video','video2video','text2video']; }
  async generate(request) {
    const response=await this.fetch(`${this.endpoint}/generate`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({...request,billing:'local-zero-credit'})});
    if(!response.ok)throw new Error(`AI Gateway locale ${response.status}: ${await response.text()}`);
    return response.json();
  }
  async status(jobId) { const r=await this.fetch(`${this.endpoint}/jobs/${encodeURIComponent(jobId)}`); if(!r.ok)throw new Error(`AI Gateway locale ${r.status}`); return r.json(); }
}

export function createDefaultRegistry({ comfyAdapter, gatewayEndpoint }={}) {
  const registry=new AIProviderRegistry();
  if(comfyAdapter)registry.register(new ComfyUIProvider(comfyAdapter));
  if(gatewayEndpoint)registry.register(new GatewayProvider({endpoint:gatewayEndpoint}));
  return registry;
}

export function isLocalEndpoint(endpoint){try{const u=new URL(endpoint);return['localhost','127.0.0.1','::1'].includes(u.hostname)||/^10\./.test(u.hostname)||/^192\.168\./.test(u.hostname)||/^172\.(1[6-9]|2\d|3[01])\./.test(u.hostname)}catch{return false}}
