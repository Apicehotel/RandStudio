const DB_NAME = 'randstudio';
const DB_VERSION = 1;
const PROJECTS = 'projects';
const MEDIA = 'media';

export class RandStudioDB {
  constructor(indexedDBImpl = globalThis.indexedDB) { this.indexedDB = indexedDBImpl; this.dbPromise = null; }
  async open() {
    if (!this.indexedDB) throw new Error('IndexedDB non disponibile');
    if (!this.dbPromise) this.dbPromise = new Promise((resolve, reject) => {
      const request = this.indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(PROJECTS)) db.createObjectStore(PROJECTS, { keyPath: 'id' });
        if (!db.objectStoreNames.contains(MEDIA)) db.createObjectStore(MEDIA, { keyPath: 'id' });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return this.dbPromise;
  }
  async saveProject(project) {
    if (!project?.id || typeof project.id !== 'string') throw new Error('Progetto senza id: salvataggio annullato');
    if (!Array.isArray(project.tracks)) throw new Error('Progetto senza timeline: salvataggio annullato');
    return this.#put(PROJECTS, { ...structuredClone(project), savedAt: Date.now() });
  }
  async loadProject(id) { return this.#get(PROJECTS, id); }
  async latestProject() {
    const all = await this.#all(PROJECTS);
    return all.sort((a, b) => (b.savedAt ?? 0) - (a.savedAt ?? 0))[0] ?? null;
  }
  async saveMedia(item) {
    if (!item?.file) throw new Error('Media senza file');
    return this.#put(MEDIA, { id:item.id, name:item.name, type:item.type, duration:item.duration, virtualName:item.virtualName, size:item.file.size, lastModified:item.file.lastModified, mime:item.file.type, blob:item.file, savedAt:Date.now() });
  }
  async loadMedia(id) { return this.#get(MEDIA, id); }
  async loadAllMedia() { return this.#all(MEDIA); }
  async deleteMedia(id) { return this.#delete(MEDIA, id); }
  async clear() { const db = await this.open(); await Promise.all([PROJECTS, MEDIA].map((store) => txPromise(db, store, 'readwrite', (s) => s.clear()))); }
  async #put(store, value) { const db = await this.open(); await txPromise(db, store, 'readwrite', (s) => s.put(value)); return value; }
  async #get(store, key) { const db = await this.open(); return txResult(db, store, 'readonly', (s) => s.get(key)); }
  async #all(store) { const db = await this.open(); return txResult(db, store, 'readonly', (s) => s.getAll()); }
  async #delete(store, key) { const db = await this.open(); return txPromise(db, store, 'readwrite', (s) => s.delete(key)); }
}

export function relinkScore(stored, file) {
  let score = 0;
  if (stored.name === file.name) score += 4;
  if (stored.size === file.size) score += 3;
  if (stored.lastModified === file.lastModified) score += 2;
  if (stored.mime === file.type) score += 1;
  return score;
}
export function bestRelink(storedItems, file) {
  return storedItems.map((item) => ({ item, score: relinkScore(item, file) })).sort((a,b)=>b.score-a.score)[0] ?? null;
}

function txPromise(db, store, mode, action) { return new Promise((resolve, reject) => { const tx=db.transaction(store,mode); try { action(tx.objectStore(store)); } catch (error) { reject(error); return; } tx.oncomplete=()=>resolve(); tx.onerror=()=>reject(tx.error); tx.onabort=()=>reject(tx.error); }); }
function txResult(db, store, mode, action) { return new Promise((resolve, reject) => { const tx=db.transaction(store,mode); const req=action(tx.objectStore(store)); req.onsuccess=()=>resolve(req.result); req.onerror=()=>reject(req.error); }); }
