const trimSlash = (value) => value.replace(/\/+$/, '');

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

  async interrupt() { return this.request('/interrupt', { method: 'POST' }); }

  outputUrl({ filename, subfolder = '', type = 'output' }) {
    const params = new URLSearchParams({ filename, subfolder, type });
    return `${this.baseUrl}/view?${params}`;
  }
}
