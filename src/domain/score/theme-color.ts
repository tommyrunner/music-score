/**
 * 谱本主题色：默认值、建议色板与 CSS 变量派生。
 *
 * 主题色是谱本级配置，只影响界面中的强调元素（按钮、选中态、高亮等），
 * 谱面本身的墨色和纸张颜色不参与，保证阅读与打印效果稳定。
 */

/**
 * 默认主题色，与项目当前的主题橙保持一致。
 */
export const DEFAULT_THEME_COLOR = '#e45232'

/**
 * 建议主题色，覆盖常用的冷暖色系。
 */
export const THEME_COLOR_PRESETS: Array<{ value: string; label: string }> = [
  { value: '#e45232', label: '赤陶' },
  { value: '#c0392b', label: '朱砂' },
  { value: '#b9770e', label: '琥珀' },
  { value: '#2e7d5b', label: '松绿' },
  { value: '#0f7c88', label: '青瓷' },
  { value: '#2f5fa8', label: '靛蓝' },
  { value: '#6b4fa0', label: '紫藤' },
  { value: '#a8446a', label: '玫红' },
]

const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/i

/**
 * 归一化主题色。
 *
 * 只接受 `#rrggbb` 格式，非法值回退默认主题色，避免脏数据影响界面。
 *
 * @param color 原始颜色值。
 */
export function normalizeThemeColor(color: string | null | undefined) {
  const trimmed = (color ?? '').trim()
  return HEX_COLOR_PATTERN.test(trimmed) ? trimmed.toLowerCase() : DEFAULT_THEME_COLOR
}

function mixHex(base: string, target: string, amount: number) {
  const channels = (hex: string) => [1, 3, 5].map(
    (start) => Number.parseInt(hex.slice(start, start + 2), 16),
  )
  const baseChannels = channels(base)
  const targetChannels = channels(target)

  return `#${baseChannels
    .map((value, index) => {
      const mixed = Math.round(value + (targetChannels[index] - value) * amount)
      return mixed.toString(16).padStart(2, '0')
    })
    .join('')}`
}

/**
 * 由主题色生成界面需要的 CSS 变量。
 *
 * @param color 主题色（会自动归一化）。
 * @returns 可直接写入元素 style 或根元素的 CSS 变量。
 */
export function themeCssVariables(color: string) {
  const accent = normalizeThemeColor(color)

  return {
    '--accent': accent,
    '--accent-dark': mixHex(accent, '#000000', 0.22),
    '--focus': mixHex(accent, '#ffffff', 0.12),
  }
}
