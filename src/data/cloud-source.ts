import {
  parseScoreBookFiles,
  type FileProgress,
  type ImportResult,
} from './score-files'

const CLOUD_SOURCE_KEY = 'stringroom:cloud-source'

export interface CloudSource {
  url: string
  headers?: Record<string, string>
}

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

export function saveCloudSource(source: CloudSource): boolean {
  if (typeof window === 'undefined') return false
  try {
    window.localStorage.setItem(CLOUD_SOURCE_KEY, JSON.stringify(source))
    return true
  } catch {
    return false
  }
}

export function clearCloudSource(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(CLOUD_SOURCE_KEY)
  } catch {
    // 本地存储不可用时无需清理。
  }
}

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