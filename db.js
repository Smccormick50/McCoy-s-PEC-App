// Storage wrapper built on localforage — the same storage library used by
// the McCoy's Inspection app, which is proven to work reliably across
// devices/browsers there. localforage automatically picks the best available
// backend (IndexedDB, then WebSQL, then localStorage) and handles a lot of
// browser-quirk edge cases internally, rather than us reinventing that.
// Everything stays on-device; there is no server/backend either way.
const DB = (() => {
  const store = localforage.createInstance({
    name: 'pce-estimator',
    storeName: 'projects',
    driver: [localforage.INDEXEDDB, localforage.WEBSQL, localforage.LOCALSTORAGE]
  });

  return {
    async getAll() {
      const keys = await store.keys();
      const items = await Promise.all(keys.map(k => store.getItem(k)));
      return items.filter(Boolean);
    },
    async get(id) {
      return (await store.getItem(id)) || null;
    },
    async put(project) {
      await store.setItem(project.id, project);
      return project;
    },
    async delete(id) {
      await store.removeItem(id);
    },
    async driverName() {
      try { return store.driver(); } catch (e) { return 'unknown'; }
    }
  };
})();
