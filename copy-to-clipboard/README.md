# copy-to-clipboard

> 学习轮子🎡，参考 [copy-to-clipboard github](https://github.com/sudodoki/copy-to-clipboard)

**背景**：简易复制文本功能： 一键复制等

## 常规实现

- `Document.execCommand()`方法
- 异步的 `Clipboard API`
- `copy`事件和`paste`事件

### Document.execCommand

> 兼容性最好

- document.execCommand('copy')（复制）
- document.execCommand('cut')（剪切）
- document.execCommand('paste')（粘贴）

```js
const copy = (text: string) => {
  const range = document.createRange()
  const selection = document.getSelection()

  const mark = document.createElement('span')
  mark.textContent = text

  // 插入 body 中
  document.body.appendChild(mark)

  // 选中
  range.selectNodeContents(mark)
  selection.addRange(range)

  const success = document.execCommand('copy')

  if (success) {
    alert('复制成功')
  } else {
    alert('复制失败')
  }

  if (mark) {
    document.body.removeChild(mark)
  }
}
```

**复制**：复制时，先选中文本

```js
const inputElement = document.querySelector('#input');
inputElement.select();
document.execCommand('copy');
```

**粘贴**: 将剪贴板里面的内容，输出到当前的焦点元素中

```js
const pasteText = document.querySelector('#output');
pasteText.focus();
document.execCommand('paste')
```

**缺点**:

- 只能将选中的内容复制到剪贴板，无法向剪贴板任意写入内容
- 同步操作，如果复制/粘贴大量数据，页面会出现卡顿

### 异步 Clipboard API

所有操作都是异步的，返回 `Promise` 对象，不会造成页面卡顿。而且，它可以将任意内容（比如图片）放入剪贴板;
安全限制：数据安全；HTTPS协议页面；弹框获取用户许可；

```js
const clipboardObj = navigator.clipboard;
```

- `Clipboard.readText()`方法用于复制剪贴板里面的文本数据
- `Clipboard.read()`方法用于复制剪贴板里面的数据，可以是文本数据，也可以是二进制数据（比如图片）
- `Clipboard.writeText()`方法用于将文本内容写入剪贴板
- `Clipboard.write()`方法用于将任意数据写入剪贴板，可以是文本数据，也可以是二进制数据

### copy + cut 监听

```js
const source = document.querySelector('.source');

source.addEventListener('copy', (event) => {
  const selection = document.getSelection();
  event.clipboardData.setData('text/plain', selection.toString().toUpperCase());
  event.preventDefault();
});

document.addEventListener('paste', async (e) => {
  e.preventDefault();
  const text = await navigator.clipboard.readText();
  console.log('Pasted text: ', text);
});
```

- `Event.clipboardData.setData(type, data)`：修改剪贴板数据，需要指定数据类型。
- `Event.clipboardData.getData(type)`：获取剪贴板数据，需要指定数据类型。
- `Event.clipboardData.clearData([type])`：清除剪贴板数据，可以指定数据类型。如果不指定类型，将清除所有类型的数据。
- `Event.clipboardData.items`：一个类似数组的对象，包含了所有剪贴项，不过通常只有一个剪贴项。
