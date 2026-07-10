// Storage wrapper built on localforage — the same storage library used by
// the McCoy's Inspection app, which is proven to work reliably across
// devices/browsers there. localforage automatically picks the best available
// backend (IndexedDB, then WebSQL, then localStorage) and handles a lot of
// browser-quirk edge cases internally, rather than us reinventing that.
// Loaded from a local file (not a CDN) so it can't be blocked by a network
// filter that only allows this site's own domain. Everything stays
// on-device; there is no server/backend either way.
//
// Note: uses fresh database/store names (not the original "pce-estimator"/
// "projects" names from an earlier version of this app's code) because a
// browser that already loaded the old version may have an incompatible
// IndexedDB object store sitting around under those names, which would
// otherwise collide with localforage's own internal schema.
const DB = (() => {
  let store = null;

  // Lazy init: if this throws, it happens inside an async method call below,
  // which becomes a normal rejected promise the rest of the app already
  // knows how to catch and show a clear message for — rather than an
  // uncaught error at script-load time that would prevent DB from existing
  // as an object at all.
  function getStore() {
    if (store) return store;
    if (typeof localforage === 'undefined' || !localforage) {
      throw new Error('localforage failed to load (localforage.min.js missing, blocked, or failed to load).');
    }
    store = localforage.createInstance({
      name: 'pce-estimator-app',
      storeName: 'pce_projects',
      driver: [localforage.INDEXEDDB, localforage.WEBSQL, localforage.LOCALSTORAGE]
    });
    // Best-effort, non-blocking cleanup of the old/incompatible database from
    // earlier versions of this app, if a browser happens to still have it.
    try {
      if (typeof indexedDB !== 'undefined' && indexedDB && indexedDB.deleteDatabase) {
        indexedDB.deleteDatabase('pce-estimator');
      }
    } catch (e) { /* ignore — purely a cleanup nice-to-have */ }
    return store;
  }

  return {
    async getAll() {
      const s = getStore();
      const keys = await s.keys();
      const items = await Promise.all(keys.map(k => s.getItem(k)));
      return items.filter(Boolean);
    },
    async get(id) {
      const s = getStore();
      return (await s.getItem(id)) || null;
    },
    async put(project) {
      const s = getStore();
      await s.setItem(project.id, project);
      return project;
    },
    async delete(id) {
      const s = getStore();
      await s.removeItem(id);
    },
    async driverName() {
      try { return getStore().driver(); } catch (e) { return 'unknown'; }
    },
    // Full troubleshooting reset: clears this app's store, then directly
    // deletes every IndexedDB database name this app (in any version) has
    // ever used, plus any matching localStorage keys, for a completely
    // clean slate. Mirrors the "Nuclear Option" in the McCoy's Inspection app.
    async nukeAll() {
      try { await getStore().clear(); } catch (e) { console.warn('store.clear failed:', e); }

      const dbNames = ['pce-estimator-app', 'pce-estimator', 'localforage'];
      for (const name of dbNames) {
        try {
          await new Promise(resolve => {
            if (typeof indexedDB === 'undefined' || !indexedDB || !indexedDB.deleteDatabase) {
              resolve();
              return;
            }
            const req = indexedDB.deleteDatabase(name);
            req.onsuccess = () => resolve();
            req.onerror = () => resolve();
            req.onblocked = () => resolve();
          });
        } catch (e) { /* ignore */ }
      }

      try {
        if (typeof localStorage !== 'undefined' && localStorage) {
          const toRemove = [];
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && (key.indexOf('pce-estimator') !== -1 || key.indexOf('pce_projects') !== -1 || key.indexOf('pce-estimator-app') !== -1)) {
              toRemove.push(key);
            }
          }
          toRemove.forEach(k => localStorage.removeItem(k));
        }
      } catch (e) { /* ignore */ }
    }
  };
})();
