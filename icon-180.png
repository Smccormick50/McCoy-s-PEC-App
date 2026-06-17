// Minimal IndexedDB wrapper. Everything stays on-device in the browser
// the app is opened in — there is no server/backend.
const DB = (() => {
  const DB_NAME = 'pce-estimator';
  const DB_VERSION = 1;
  const STORE = 'projects';
  let dbPromise = null;

  function open() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: 'id' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbPromise;
  }

  async function tx(mode) {
    const db = await open();
    return db.transaction(STORE, mode).objectStore(STORE);
  }

  return {
    async getAll() {
      const store = await tx('readonly');
      return new Promise((resolve, reject) => {
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });
    },
    async get(id) {
      const store = await tx('readonly');
      return new Promise((resolve, reject) => {
        const req = store.get(id);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
    },
    async put(project) {
      const store = await tx('readwrite');
      return new Promise((resolve, reject) => {
        const req = store.put(project);
        req.onsuccess = () => resolve(project);
        req.onerror = () => reject(req.error);
      });
    },
    async delete(id) {
      const store = await tx('readwrite');
      return new Promise((resolve, reject) => {
        const req = store.delete(id);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    }
  };
})();
