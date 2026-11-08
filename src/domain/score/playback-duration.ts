/**
 * 自动播放时长的公共换算工具。
 *
 * 阅读面板和编辑弹框共用同一套“时/分/秒输入框 ↔ 秒数”逻辑，
 * 避免两处各写一份后出现夹取范围不一致的问题。
 */

import { MAX_PLAYBACK_SECONDS } from './score-document'

/**
 * 时、分、秒三个输入框的字符串值。
 */
export interface PlaybackDurationFields {
  hours: string
  minutes: string
  seconds: string
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

/**
 * 把总秒数拆成时、分、秒输入框。
 *
 * @param totalSeconds 每页停留时长（秒）。
 */
export function splitPlaybackSeconds(totalSeconds: number): PlaybackDurationFields {
  const safeSeconds = clamp(Math.round(totalSeconds), 1, MAX_PLAYBACK_SECONDS)
  return {
    hours: String(Math.floor(safeSeconds / 3600)),
    minutes: String(Math.floor((safeSeconds % 3600) / 60)),
    seconds: String(safeSeconds % 60),
  }
}

/**
 * 把时、分、秒输入框换算成总秒数，最少 1 秒、最多 23:59:59。
 *
 * 空字符串按 0 处理，输入过程中不会因为暂时清空而报错。
 *
 * @param fields 时、分、秒输入框的值。
 */
export function playbackFieldsToSeconds(fields: PlaybackDurationFields) {
  const hours = clamp(Number(fields.hours) || 0, 0, 23)
  const minutes = clamp(Number(fields.minutes) || 0, 0, 59)
  const seconds = clamp(Number(fields.seconds) || 0, 0, 59)
  return clamp(Math.floor(hours * 3600 + minutes * 60 + seconds), 1, MAX_PLAYBACK_SECONDS)
}

/**
 * 把总秒数格式化成“X 时 X 分 X 秒”的可读文本。
 *
 * @param totalSeconds 总秒数。
 */
export function formatPlaybackDuration(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (hours > 0) return `${hours} 时 ${minutes} 分 ${seconds} 秒`
  if (minutes > 0) return `${minutes} 分 ${seconds} 秒`
  return `${seconds} 秒`
}
