const DB_NAME='randstudio';const DB_VERSION=1;const PROJECTS='projects';const MEDIA='media';
export class RandStudioDB{
  constructor(indexedDBImpl=globalThis.indexedDB){this.indexedDB=indexedDBImpl;this.dbPromise=null}
  async db(){if(!this.indexedDB)throw new Error('IndexedDB non disponibile');if(!this.dbPromise)this.dbPromise=new Promise((resolve,reject)=>{const req=this.indexedDB.open(DB_NAME,DB_VERSION);req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains(PROJECTS))db.createObjectStore(PROJECTS,{keyPath:'id'});if(!db.objectStoreNames.contains(MEDIA))db.createObjectStore(MEDIA,{keyPath:'id'})};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)});return this.dbPromise}
  async putProject(project){const db=await this.db();await tx(db,PROJECTS,'readwrite',store=>store.put({id:project.id,updatedAt:project.updatedAt||new Date().toISOString(),project:structuredClone(project)}))}
  async latestProject(){const db=await this.db(),rows=await tx(db,PROJECTS,'readonly',store=>store.getAll());rows.sort((a,b)=>String(b.updatedAt).localeCompare(String(a.updatedAt)));return rows[0]?.project||null}
  async putMedia(item){if(!item?.id||!item?.file)throw new Error('Media non valido');const db=await this.db();await tx(db,MEDIA,'readwrite',store=>store.put({id:item.id,name:item.name,type:item.type,duration:item.duration||0,virtualName:item.virtualName||item.name,blob:item.file,lastModified:item.file.lastModified||Date.now()}))}
  async getMedia(id){const db=await this.db();return tx(db,MEDIA,'readonly',store=>store.get(id))}
  async mediaForProject(project){const ids=[...new Set((project?.tracks||[]).flatMap(t=>t.clips||[]).map(c=>c.sourceId).filter(Boolean))],out=[];for(const id of ids){const row=await this.getMedia(id);if(row)out.push(row)}return out}
  async clear(){const db=await this.db();await tx(db,PROJECTS,'readwrite',s=>s.clear());await tx(db,MEDIA,'readwrite',s=>s.clear())}
}
function tx(db,storeName,mode,fn){return new Promise((resolve,reject)=>{const transaction=db.transaction(storeName,mode),store=transaction.objectStore(storeName),req=fn(store);transaction.oncomplete=()=>resolve(req?.result);transaction.onerror=()=>reject(transaction.error);transaction.onabort=()=>reject(transaction.error)})}
