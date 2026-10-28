/**
 * 记录编辑器首次操作提示是否已经展示过。
 */

const EDITOR_GUIDE_SEEN_KEY = 'stringroom:editor-guide-seen'

/** 判断用户是否已经看过编辑器首次操作提示。 */
export function hasSeenEditorGuide(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(EDITOR_GUIDE_SEEN_KEY) === '1'
  } catch {
    return false
  }
}

/**
 * 记录用户已经看过编辑器首次操作提示。
 * 本地存储不可用时仅在本次会话内生效。
 */
export function markEditorGuideSeen(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(EDITOR_GUIDE_SEEN_KEY, '1')
  } catch {
    return
  }
}