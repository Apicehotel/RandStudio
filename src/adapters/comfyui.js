const trimSlash = (value) => value.replace(/\/+$/, '');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export class ComfyUIAdapter {
  constructor({ baseUrl = 'http://127.0.0.1:8188', fetchImpl = fetch } = {}) {
    this.baseUrl = trimSlash(baseUrl);
    this.fetch = fetchImpl;
  }

  async request(path, init) {
    const response = await this.fetch(`${this.baseUrl}${path}`, init);
    if (!response.ok) throw new Error(`ComfyUI ${response.status}: ${await response.text()}`);
    const type = response.headers?.get?.('content-type') ?? '';
    return type.includes('application/json') ? response.json() : response;
  }

  systemStats() { return this.request('/system_stats'); }
  objectInfo() { return this.request('/object_info'); }
  queue() { return this.request('/queue'); }
  history(promptId = '') { return this.request(`/history${promptId ? `/${encodeURIComponent(promptId)}` : ''}`); }

  async enqueue(workflow, { clientId = crypto.randomUUID() } = {}) {
    const data = await this.request('/prompt', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ prompt: workflow, client_id: clientId }),
    });
    if (!data.prompt_id) throw new Error('ComfyUI did not return prompt_id');
    return { promptId: data.prompt_id, clientId, nodeErrors: data.node_errors ?? {} };
  }

  async uploadImage(file, { subfolder = 'randstudio', overwrite = true } = {}) {
    const body = new FormData();
    body.append('image', file, file.name || 'randstudio-input.png');
    body.append('subfolder', subfolder);
    body.append('type', 'input');
    body.append('overwrite', overwrite ? 'true' : 'false');
    const response = await this.request('/upload/image', { method: 'POST', body });
    return response.subfolder ? `${response.subfolder}/${response.name}` : response.name;
  }

  async waitForPrompt(promptId, { interval = 1500, timeout = 30 * 60 * 1000, onProgress = () => {} } = {}) {
    const started = Date.now();
    let ticks = 0;
    while (Date.now() - started < timeout) {
      const history = await this.history(promptId);
      const entry = history?.[promptId] ?? history;
      if (entry) {
        if (entry.status?.status_str === 'error') throw new Error('ComfyUI job failed');
        if (entry.outputs && Object.keys(entry.outputs).length) return entry;
      }
      ticks += 1;
      onProgress(Math.min(.95, .08 + ticks * .015));
      await sleep(interval);
    }
    throw new Error('ComfyUI job timeout');
  }

  firstOutput(historyEntry) {
    for (const node of Object.values(historyEntry?.outputs || {})) {
      for (const key of ['videos', 'gifs', 'images']) {
        for (const file of node?.[key] || []) {
          if (file?.filename) return { filename:file.filename, subfolder:file.subfolder || '', type:file.type || 'output', kind:key };
        }
      }
    }
    return null;
  }

  outputUrl({ filename, subfolder = '', type = 'output' }) {
    const params = new URLSearchParams({ filename, subfolder, type });
    return `${this.baseUrl}/view?${params}`;
  }

  async downloadOutput(descriptor) {
    const response = await this.fetch(this.outputUrl(descriptor));
    if (!response.ok) throw new Error(`ComfyUI output ${response.status}`);
    return response.blob();
  }

  async interrupt() { return this.request('/interrupt', { method: 'POST' }); }
}
