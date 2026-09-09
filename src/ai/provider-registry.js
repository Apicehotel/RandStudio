export class AIProviderRegistry {
  constructor() { this.providers = new Map(); }
  register(provider) { if (!provider?.id || typeof provider.generate !== 'function') throw new Error('Provider AI non valido'); this.providers.set(provider.id, provider); return provider; }
  get(id) { const provider=this.providers.get(id); if(!provider) throw new Error(`Provider AI non trovato: ${id}`); return provider; }
  list() { return [...this.providers.values()].map(({id,name,capabilities=[]})=>({id,name,capabilities:[...capabilities]})); }
  async generate(id, request, options) { return this.get(id).generate(request, options); }
}

export class ComfyUIProvider {
  constructor(adapter) { this.id='comfyui'; this.name='ComfyUI locale'; this.capabilities=['wan-camera','workflow']; this.adapter=adapter; }
  async generate(request, { workflow, bindings, bindWorkflow } = {}) {
    if (!workflow || !bindings || typeof bindWorkflow !== 'function') throw new Error('Workflow/bindings ComfyUI mancanti');
    const prompt=bindWorkflow(workflow,request,bindings);
    const job=await this.adapter.enqueue(prompt);
    return { provider:this.id, jobId:job.promptId, raw:job };
  }
}

export class GatewayProvider {
  constructor({ id='gateway', name='AI Gateway', endpoint, fetchImpl=fetch }={}) { if(!endpoint)throw new Error('AI gateway endpoint mancante'); this.id=id; this.name=name; this.endpoint=endpoint.replace(/\/$/,''); this.fetch=fetchImpl; this.capabilities=['image2video','video2video','text2video']; }
  async generate(request) {
    const response=await this.fetch(`${this.endpoint}/generate`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(request)});
    if(!response.ok)throw new Error(`AI Gateway ${response.status}: ${await response.text()}`);
    return response.json();
  }
  async status(jobId) { const r=await this.fetch(`${this.endpoint}/jobs/${encodeURIComponent(jobId)}`); if(!r.ok)throw new Error(`AI Gateway ${r.status}`); return r.json(); }
}

export function createDefaultRegistry({ comfyAdapter, gatewayEndpoint }={}) {
  const registry=new AIProviderRegistry();
  if(comfyAdapter)registry.register(new ComfyUIProvider(comfyAdapter));
  if(gatewayEndpoint)registry.register(new GatewayProvider({endpoint:gatewayEndpoint}));
  return registry;
}
