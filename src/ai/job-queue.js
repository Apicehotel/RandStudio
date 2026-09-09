const TERMINAL = new Set(['completed', 'failed', 'cancelled']);

export class AIJobQueue {
  constructor({ now = () => new Date().toISOString() } = {}) {
    this.now = now;
    this.jobs = [];
    this.listeners = new Set();
  }

  subscribe(listener) { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  emit() { const snapshot = this.list(); this.listeners.forEach((fn) => fn(snapshot)); }
  list() { return structuredClone(this.jobs); }
  get(id) { return this.jobs.find((job) => job.id === id) ?? null; }

  add(input) {
    const job = {
      id: input.id ?? crypto.randomUUID(),
      kind: input.kind,
      status: 'queued',
      progress: 0,
      promptId: null,
      input: structuredClone(input.input ?? {}),
      output: null,
      error: null,
      createdAt: this.now(),
      updatedAt: this.now(),
    };
    this.jobs.unshift(job); this.emit(); return structuredClone(job);
  }

  update(id, patch) {
    const job = this.get(id);
    if (!job) throw new Error(`AI job not found: ${id}`);
    if (TERMINAL.has(job.status) && patch.status && patch.status !== job.status) throw new Error('Terminal AI job cannot transition');
    Object.assign(job, structuredClone(patch), { updatedAt: this.now() });
    if (job.progress < 0 || job.progress > 1) throw new Error('progress must be between 0 and 1');
    this.emit(); return structuredClone(job);
  }

  remove(id) { this.jobs = this.jobs.filter((job) => job.id !== id); this.emit(); }
}
