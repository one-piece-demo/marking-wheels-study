# idb-keyval

> 学习轮子🎡，参考 [idb-keyval github](https://github.com/jakearchibald/idb-keyval)

**背景**：简易API使用浏览器数据库`indexedDB`

## indexedDB

[浏览器数据库 IndexedDB 入门教程](https://www.ruanyifeng.com/blog/2018/07/indexeddb.html)

简单使用

```js
const dbName = 'key-val'
const storeName = 'keyval'

export function uglyGet(key: string) {
  // 打开数据库
  const openDBRequest = indexedDB.open(dbName)

  // 创建表
  openDBRequest.onupgradeneeded = function () {
    openDBRequest.result.createObjectStore(storeName)
  }

  // 失败回调
  openDBRequest.onerror = () => console.log('出错啦')

  // 成功回调
  openDBRequest.onsuccess = () => {
    // 获取数据库
    const db = openDBRequest.result

    // 获取数据库里的 store
    const store = db.transaction(storeName, 'readonly').objectStore(storeName)

    // 获取值操作
    const getRequest = store.get(key);

    getRequest.onsuccess = function() {
      // 获取到值
      console.log(`获取 ${key} 成功`, this.result)
    }
    getRequest.onerror = function() {
      console.log(`获取 ${key} 失败`)
    }
  }
}

```
