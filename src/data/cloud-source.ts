/**
 * 云端 ZIP 数据源的配置、持久化与请求。
 */

import {
  parseScoreBookFiles,
  type FileProgress,
  type ImportResult,
} from './score-files'

const CLOUD_SOURCE_KEY = 'stringroom:cloud-source'

/** 默认的云端谱本 ZIP 地址。 */
export const DEFAULT_CLOUD_SOURCE_URL =
  'https://raw.githubusercontent.com/tommyrunner/music-score/master/library/music-list.zip'

/** 云端 ZIP 数据源配置。 */
export interface CloudSource {
  url: string
  headers?: Record<string, string>
}

/** 返回默认云端数据源配置。 */
export function defaultCloudSource(): CloudSource {
  return { url: DEFAULT_CLOUD_SOURCE_URL }
}

/**
 * 校验并规范化云端 API 地址与请求头 JSON。
 *
 * @throws 当地址协议、JSON 格式或请求头类型不合法时抛出错误。
 */
export function validateCloudSource(
  urlInput: string,
  headersText = '',
): CloudSource {
  const trimmedUrl = urlInput.trim()
  if (!trimmedUrl) throw new Error('请填写云端 API 地址')

  let url: URL
  try {
    url = new URL(trimmedUrl)
  } catch {
    throw new Error('请输入完整的 http(s) API 地址')
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('云端 API 地址必须使用 http 或 https')
  }

  const trimmedHeaders = headersText.trim()
  if (!trimmedHeaders) return { url: url.toString() }

  let value: unknown
  try {
    value = JSON.parse(trimmedHeaders)
  } catch {
    throw new Error('请求头必须是合法的 JSON 对象')
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('请求头必须是 JSON 对象')
  }

  const headers: Record<string, string> = {}
  for (const [key, headerValue] of Object.entries(value)) {
    if (!key.trim()) throw new Error('请求头名称不能为空')
    if (typeof headerValue !== 'string') {
      throw new Error('请求头每一项的值都必须是字符串')
    }
    headers[key.trim()] = headerValue
  }

  return Object.keys(headers).length > 0
    ? { url: url.toString(), headers }
    : { url: url.toString() }
}

/**
 * 从本地存储读取云端数据源配置。
 *
 * @returns 未配置或配置无效时返回 null。
 */
export function loadCloudSource(): CloudSource | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(CLOUD_SOURCE_KEY)
    if (!raw) return null
    const stored = JSON.parse(raw) as { url?: unknown; headers?: unknown }
    if (typeof stored.url !== 'string') return null
    const headers = stored.headers && typeof stored.headers === 'object'
      ? JSON.stringify(stored.headers)
      : ''
    return validateCloudSource(stored.url, headers)
  } catch {
    return null
  }
}

/**
 * 将云端数据源配置写入本地存储。
 *
 * @returns 是否写入成功。
 */
export function saveCloudSource(source: CloudSource): boolean {
  if (typeof window === 'undefined') return false
  try {
    window.localStorage.setItem(CLOUD_SOURCE_KEY, JSON.stringify(source))
    return true
  } catch {
    return false
  }
}

/** 清除本地保存的云端数据源配置；本地存储不可用时静默忽略。 */
export function clearCloudSource(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(CLOUD_SOURCE_KEY)
  } catch {
    return
  }
}

/**
 * 请求云端 ZIP 文件并解析为可导入的谱本。
 *
 * @param source 云端数据源地址与可选请求头。
 * @param onProgress 下载与解析进度回调。
 */
export async function fetchCloudBooks(
  source: CloudSource,
  onProgress?: FileProgress,
): Promise<ImportResult> {
  onProgress?.(2, '正在连接云端接口…')

  let response: Response
  try {
    response = await fetch(source.url, {
      method: 'GET',
      headers: source.headers,
      cache: 'no-store',
    })
  } catch {
    throw new Error('无法连接云端接口，请检查地址、请求头或跨域设置')
  }

  if (!response.ok) {
    throw new Error(`云端接口返回 ${response.status}`)
  }

  onProgress?.(8, '正在下载云端 ZIP…')
  const blob = await response.blob()
  if (blob.size === 0) throw new Error('云端返回的文件是空的')

  onProgress?.(12, '正在解压云端 ZIP…')
  const file = new File([blob], '云端谱本.zip', { type: 'application/zip' })
  return parseScoreBookFiles([file], (value, detail) => {
    onProgress?.(Math.round(12 + value * 0.8), detail)
  })
}