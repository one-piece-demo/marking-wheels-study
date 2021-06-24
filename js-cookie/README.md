# js-cookie

> 学习轮子🎡，参考 [js-cookie github](https://github.com/js-cookie/js-cookie)

**背景**：简易API操作浏览器`cookie`

## cookie

简易实现

```js
// 显示
console.log(document.cookie)
// "_octo=GH1.1.936669471.1578886875; _ga=GA1.2.1931206562.1578900201; tz=Asia%2FShanghai"

// 获取
function get(key: string): string | null {
  const cookiePairs = document.cookie ? document.cookie.split('; ') : []
  const cookieStore: Record<string, string> = {}
  cookiePairs.some(pair => {
    const [curtKey, ...curtValues] = pair.split('=')
    try {
      // 解码
      const decodeedValue = decodeURIComponent(curtValue.join('='))  // 有可能 value 存在 '='
      cookieStore[curtKey] = decodeedValue
    } catch (e) {}

    return curtKey === key // 如果相等时，就会 break
  })

  return key ? cookieStore[key] : null
}

// 设置
document.cookie = `${key}=${value}`

// 设置 path 路径， expires过期时间
document.cookie = `${key}=${value}; expires=${expires}; path=${path}`

// 设置API
const TWENTY_FOUR_HOURS = 864e5 // 24 小时的毫秒值
const defaultAttributes: Attributes = {path: '/'}
function set(key: string, value: string, attributes = defaultAttributes): string | null {
  attributes = {...defaultAttributes, ...attributes}

  if (attributes.expires) {
    // 将过期天数转为 UTC string
    if (typeof attributes.expires === 'number') {
      attributes.expires = new Date(Date.now() + attributes.expires * TWENTY_FOUR_HOURS)
      attributes.expires = attributes.expires.toUTCString()
    }
  }

  // 获取 Cookie 其它属性的字符串形式，如 "; expires=1; path=/"
  const attrStr = Object.entries(attributes).reduce((prevStr, attrPair) => {
    const [attrKey, attrValue] = attrPair

    if (!attrValue) return prevStr

    prevStr += `; ${attrKey}`

    // attrValue 有可能为 truthy，所以要排除 true 值的情况
    if (attrValue === true) return prevStr

    // 排除 attrValue 存在 ";" 号的情况
    prevStr += `=${attrValue.split('; ')[0]}`

    return prevStr
  }, '')

   // 编码
  value = encodeURIComponent(value)

  return document.cookie = `${key}=${value}${attrStr}`
}

/**
 * 删除某个 Cookie
 */
function del(key: string, attributes = defaultAttributes) {
  // 将 expires 减 1 天，Cookie 自动失败
  set(key, '', {...attributes, expires: -1})
}

```
