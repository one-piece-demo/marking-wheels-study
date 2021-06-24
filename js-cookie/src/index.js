/**
 * 处理 Cookie
 * 
 * let myCookies = Cookies.withConverter({
      encode: () => 'World',
      decode: () => 'Hello',
    })
    myCookies = Cookies.withAttributes({expires: 3})

    const value = myCookies.get(key)
    myCookies.set(key, value)
    myCookies.del(key)
 */
import {defaultAttributes, defaultConverter, TWENTY_FOUR_HOURS} from './constants';

function initCookie(initConverter, initAttributes) {
  function get(key) {
    if (typeof document === 'undefined') return null

    const cookiePairs = document.cookie ? document.cookie.split('; ') : []

    const cookieStore = {}

    cookiePairs.some(pair => {
      const [curtKey, ...curtValue] = pair.split('=')

      try {
        // 有可能 value 存在 '='
        cookieStore[curtKey] = initConverter.decode(curtValue.join('='))
      } catch (e) {}

      return curtKey === key // 如果相等时，就会 break
    })

    return key ? cookieStore[key] : null
  }

  /**
   * 设置 Cookie key-val 对
   */
  function set(key, value, attributes = initAttributes) {
    if (typeof document === 'undefined') return null

    attributes = {...initAttributes, ...attributes}

    if (attributes.expires) {
      // 将过期天数转为 UTC string
      if (typeof attributes.expires === 'number') {
        attributes.expires = new Date(Date.now() + attributes.expires * TWENTY_FOUR_HOURS)
        attributes.expires = attributes.expires.toUTCString()
      }
    }

    value = initConverter.encode(value)

    // 获取 Cookie 其它属性的字符串形式
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

    return document.cookie = `${key}=${value}${attrStr}`
  }

  /**
   * 删除某个 Cookie
   */
  function del(key, attributes = initAttributes) {
    // 将 expires 减 1 天，Cookie 自动失败
    set(key, '', {...attributes, expires: -1})
  }

  /**
   * 添加自定义 converter
   */
  function withConverter(customConverter) {
    return init({...this.converter, ...customConverter}, this.attributes)
  }

  /**
   * 添加自定义 attributes
   */
  function withAttributes(customAttributes) {
    return init(this.converter, {...this.attributes, ...customAttributes})
  }

  return Object.create(
    {get, set, del, withConverter, withAttributes},
    {
      converter: {value: Object.freeze(initConverter)}, // 冻结默认配置
      attributes: {value: Object.freeze(initAttributes)},
    }
  )
}

export default initCookie(defaultConverter, defaultAttributes)