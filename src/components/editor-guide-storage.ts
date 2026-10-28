const EDITOR_GUIDE_SEEN_KEY = 'stringroom:editor-guide-seen'

export function hasSeenEditorGuide(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(EDITOR_GUIDE_SEEN_KEY) === '1'
  } catch {
    return false
  }
}

export function markEditorGuideSeen(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(EDITOR_GUIDE_SEEN_KEY, '1')
  } catch {
    // 本地存储不可用时只在本次会话内关闭提示。
  }
}