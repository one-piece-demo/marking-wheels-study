
/**
 * promise处理request
 * @param {*} request 
 */
export function promisifyRequest(request) {
  return new Promise((resolve, reject) => {
      request.oncomplete = request.onsuccess = () => resolve(request.result);
      request.onabort = request.onerror = () => reject(request.error);
  });
}

/**
 * 创建store
 * @param {*} dbName 
 * @param {*} storeName 
 */
export function createStore(dbName, storeName) {
  // 打开数据库
  const request = indexedDB.open(dbName);
  // 创建表
  request.onupgradeneeded = () => request.result.createObjectStore(storeName);

  const dbp = promisifyRequest(request);
  
  // 获取数据库里的 store, txMode介绍 readonly，readwrite
  return (txMode, callback) => dbp.then((db) => callback(db.transaction(storeName, txMode).objectStore(storeName)));
}

let defaultGetStoreFunc;
function defaultGetStore() {
  // 单例模式，只创建一次store
  if (!defaultGetStoreFunc) {
      defaultGetStoreFunc = createStore('keyval-store', 'keyval');
  }
  return defaultGetStoreFunc;
}

function eachCursor(customStore, callback) {
  return customStore('readonly', (store) => {
      // This would be store.getAllKeys(), but it isn't supported by Edge or Safari.
      // And openKeyCursor isn't supported by Safari.
      store.openCursor().onsuccess = function () {
          if (!this.result)
              return;
          callback(this.result);
          this.result.continue();
      };
      return promisifyRequest(store.transaction);
  });
}

/**
 * Get a value by its key.
 *
 * @param key
 * @param customStore Method to get a custom store.
 */
export function get(key, customStore = defaultGetStore()) {
  return customStore('readonly', (store) => promisifyRequest(store.get(key)));
}
/**
* Set a value with a key.
*
* @param key
* @param value
* @param customStore Method to get a custom store.
*/
export function set(key, value, customStore = defaultGetStore()) {
  return customStore('readwrite', (store) => {
      store.put(value, key);
      return promisifyRequest(store.transaction);
  });
}

/**
 * Set multiple values at once. This is faster than calling set() multiple times.
 * It's also atomic – if one of the pairs can't be added, none will be added.
 *
 * @param entries Array of entries, where each entry is an array of `[key, value]`.
 * @param customStore Method to get a custom store. 
 */
export function setMany(entries, customStore = defaultGetStore()) {
  return customStore('readwrite', (store) => {
      entries.forEach((entry) => store.put(entry[1], entry[0]));
      return promisifyRequest(store.transaction);
  });
}

/**
 * Get multiple values by their keys
 *
 * @param keys
 * @param customStore Method to get a custom store. 
 */
export function getMany(keys, customStore = defaultGetStore()) {
  return customStore('readonly', (store) => Promise.all(keys.map((key) => promisifyRequest(store.get(key)))));
}

/**
 * Update a value. This lets you see the old value and update it as an atomic operation.
 *
 * @param key
 * @param updater A callback that takes the old value and returns a new value.
 * @param customStore Method to get a custom store. 
 */
export function update(key, updater, customStore = defaultGetStore()) {
  return customStore('readwrite', (store) => 
  // Need to create the promise manually.
  // If I try to chain promises, the transaction closes in browsers
  // that use a promise polyfill (IE10/11).
  new Promise((resolve, reject) => {
      store.get(key).onsuccess = function () {
          try {
              store.put(updater(this.result), key);
              resolve(promisifyRequest(store.transaction));
          }
          catch (err) {
              reject(err);
          }
      };
  }));
}

/**
 * Delete a particular key from the store.
 *
 * @param key
 * @param customStore Method to get a custom store.
 */
export function del(key, customStore = defaultGetStore()) {
  return customStore('readwrite', (store) => {
      store.delete(key);
      return promisifyRequest(store.transaction);
  });
}

/**
* Clear all values in the store.
*
* @param customStore Method to get a custom store. 
*/
export function clear(customStore = defaultGetStore()) {
  return customStore('readwrite', (store) => {
      store.clear();
      return promisifyRequest(store.transaction);
  });
}


/**
* Get all keys in the store.
*
* @param customStore Method to get a custom store.
*/
export function keys(customStore = defaultGetStore()) {
  const items = [];
  return eachCursor(customStore, (cursor) => items.push(cursor.key)).then(() => items);
}
/**
* Get all values in the store.
*
* @param customStore Method to get a custom store. 
*/
export function values(customStore = defaultGetStore()) {
  const items = [];
  return eachCursor(customStore, (cursor) => items.push(cursor.value)).then(() => items);
}

/**
 * Get all entries in the store. Each entry is an array of `[key, value]`.
 *
 * @param customStore Method to get a custom store. 
 */
export function entries(customStore = defaultGetStore()) {
  const items = [];
  return eachCursor(customStore, (cursor) => items.push([cursor.key, cursor.value])).then(() => items);
}