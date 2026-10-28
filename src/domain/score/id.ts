/**
 * 生成文档内部使用的唯一 ID。
 *
 * `crypto.randomUUID()` 只在安全上下文（HTTPS / localhost）可用，
 * 通过普通 HTTP 访问时它是 undefined，会导致新建谱本等操作直接报错。
 * 这里在不可用时退回到 `crypto.getRandomValues`（非安全上下文也可用），
 * 手动拼一个符合 RFC 4122 v4 的 UUID。
 */
export function createId(): string {
  const cryptoApi = globalThis.crypto
  if (typeof cryptoApi?.randomUUID === 'function') {
    return cryptoApi.randomUUID()
  }

  const bytes = new Uint8Array(16)
  if (typeof cryptoApi?.getRandomValues === 'function') {
    cryptoApi.getRandomValues(bytes)
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256)
    }
  }

  // 版本号 4（随机 UUID）与 variant 位
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80

  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join('-')
}