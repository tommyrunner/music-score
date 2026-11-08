import { useLayoutEffect } from 'react'

import { themeCssVariables } from '../domain/score/theme-color'

/**
 * 把谱本主题色写入根元素 CSS 变量。
 *
 * 写在 `:root` 上是为了让通过 Portal 渲染的弹框也能继承主题色；
 * 卸载时恢复进入前的变量值，避免阅读层关闭后覆盖编辑页的主题。
 *
 * @param color 当前谱本的主题色。
 */
export function useThemeColor(color: string) {
  useLayoutEffect(() => {
    const root = document.documentElement
    const variables = Object.entries(themeCssVariables(color))
    const previous = variables.map(
      ([name]) => [name, root.style.getPropertyValue(name)] as const,
    )

    variables.forEach(([name, value]) => root.style.setProperty(name, value))

    return () => {
      previous.forEach(([name, value]) => {
        if (value) root.style.setProperty(name, value)
        else root.style.removeProperty(name)
      })
    }
  }, [color])
}
