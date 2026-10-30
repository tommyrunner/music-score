/**
 * 纸张版式的共享尺寸与工具。
 */

/** 纸张基准宽度（像素）。 */
export const PAPER_WIDTH = 794

/** 纸张最小高度（像素）。 */
export const PAPER_MIN_HEIGHT = 1123

/**
 * 读取 CSS 像素值。
 *
 * @param value 形如 `12px` 的样式值。
 */
export function readPixelValue(value: string) {
  return Number.parseFloat(value) || 0
}
