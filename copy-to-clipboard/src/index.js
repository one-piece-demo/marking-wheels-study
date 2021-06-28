/**
 * 复制粘贴板
 */

// 执行 copy 前移除当前选区，执行过后再恢复原来选区。
export const deselectCurrent = () => {
  const selection = document.getSelection()

  // 当前没有选中
  if (selection.rangeCount === 0) {
    return () => {}
  }

  let $active = document.activeElement

  // 获取当前选中的 ranges
  const ranges = []
  for (let i = 0; i < selection.rangeCount; i++) {
    ranges.push(selection.getRangeAt(i))
  }

  // 如果为输入元素先 blur 再 focus
  switch ($active.tagName.toUpperCase()) {
    case 'INPUT':
    case 'TEXTAREA':
      $active.blur()
      break
    default:
      $active = null
  }

  // deselect
  selection.removeAllRanges();

  return () => {
    // 如果是插入符则移除 ranges
    if (selection.type === 'Caret') {
      selection.removeAllRanges()
    }

    // 没有选中，就把之前的 ranges 加回来
    if (selection.rangeCount === 0) {
      ranges.forEach(range => {
        selection.addRange(range)
      })
    }

    // input 或 textarea 要再 focus 回来
    if ($active) {
      $active.focus()
    }
  }
}

const clipboardToIE11Formatting = {
  "text/plain": "Text",
  "text/html": "Url",
  "default": "Text"
}

const updateMarkStyles = (mark) => {
  // 重置用户样式
  mark.style.all = "unset";
  // 放在 fixed，防止添加元素后触发滚动行为
  mark.style.position = "fixed";
  mark.style.top = '0';
  mark.style.clip = "rect(0, 0, 0, 0)";
  // 保留 space 和 line-break 特性
  mark.style.whiteSpace = "pre";
  // 外部有可能 user-select 为 'none'，因此这里设置为 text
  mark.style.userSelect = "text";
}

// 复制
export const copy = (text, options = {}) => {
  const {onCopy, format} = options
  const reselectPrevious = deselectCurrent() // 去掉当前选区
  // Range 表示一个包含节点与文本节点的一部分的文档片段。一个 Selection 可以有多个 Range 对象。
  const range = document.createRange()
  // 选择的文本范围或插入符号的当前位置。它代表页面中的文本选区，可能横跨多个元素
  const selection = document.getSelection()

  const mark = document.createElement('span')
  mark.textContent = text

  // 加上样式
  updateMarkStyles(mark)

  // 自定义 onCopy
  mark.addEventListener('copy', (e) => {
    // 带格式去复制内容
    if (onCopy) {
      e.stopPropagation()
      e.preventDefault()
      if (!e.clipboardData) {
        // 只有 IE 11 里 e.clipboardData 一直为 undefined
        // 这里 format 要转为 IE 11 里指定的 format
        const IE11Format = clipboardToIE11Formatting[format || 'default']
        // @ts-ignore clearData 只有 IE 上有
        window.clipboardData.clearData()
        // @ts-ignore setData 只有 IE 上有
        window.clipboardData.setData(IE11Format, text);
      } else {
        e.clipboardData.clearData()
        e.clipboardData.setData(format, text)
      }
      // 上面阻止禁止默认的copy事件响应
      onCopy(e.clipboardData)
    }
  })

  // 插入 body 中
  document.body.appendChild(mark)

  // 选中
  range.selectNodeContents(mark)
  selection.removeAllRanges() // 移除调用前已经存在 Range
  selection.addRange(range)

  try {
    // execCommand 有些浏览器可能不支持，这里要 try 一下
    success = document.execCommand('copy')

    if (!success) {
      throw new Error("Can't not copy")
    }
  } catch (e) {
    try {
      // @ts-ignore window.clipboardData 这鬼玩意只有 IE 上有
      window.clipboardData.setData(format || 'text', text)
      // @ts-ignore window.clipboardData 这鬼玩意只有 IE 上有
      onCopy && onCopy(window.clipboardData)
    } catch (e) {
      // 最后兜底方案，让用户在 window.prompt 的时候输入
      window.prompt('输入需要复制的内容', text)
    }
  } finally {
    if (selection.removeRange) {
      selection.removeRange(range)
    } else {
      selection.removeAllRanges()
    }

    if (mark) {
      document.body.removeChild(mark)
    }
    reselectPrevious() // 恢复选区
  }

  return success
}

// 使用示例
const $copy = document.querySelector('#copy')
const $myCopy = document.querySelector('#my-copy')

$copy.onclick = () => {
  const copyText = document.querySelector('#text').innerText

  copy(copyText)
}

$myCopy.onclick = () => {
  const myText = document.querySelector('#my-text').innerText

  copy('xxx', {
    onCopy: (data) => data.setData('text/plain', myText),
  })
}