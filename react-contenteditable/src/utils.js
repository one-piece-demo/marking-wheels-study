// 替换光标位置
export const replaceCaret = (el) => {
  // 创建光标
  const cursor = document.createTextNode('')
  el.appendChild(cursor)

  // 判断是否选中
  const isFocused = document.activeElement === el
  if (!cursor || !cursor.nodeValue || !isFocused) return

  // 将光标放到最后
  const selection = window.getSelection()
  if (selection !== null) {
    const range = document.createRange()
    range.setStart(cursor, cursor.nodeValue.length)
    range.collapse(true)

    selection.removeAllRanges()
    selection.addRange(range)
  }

  // 重新 focus
  if (el instanceof HTMLElement) el.focus()
}