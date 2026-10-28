import { afterEach, describe, expect, it, vi } from 'vitest'

import { createId } from './id'

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

describe('createId', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('生成符合 UUID v4 格式且不重复的 ID', () => {
    const ids = new Set(Array.from({ length: 200 }, () => createId()))

    expect(ids.size).toBe(200)
    for (const id of ids) {
      expect(id).toMatch(UUID_V4)
    }
  })

  it('在 randomUUID 不可用（HTTP 非安全上下文）时退回到 getRandomValues', () => {
    vi.stubGlobal('crypto', {
      getRandomValues: (buffer: Uint8Array) => {
        for (let index = 0; index < buffer.length; index += 1) {
          buffer[index] = index
        }
        return buffer
      },
    })

    expect(createId()).toBe('00010203-0405-4607-8809-0a0b0c0d0e0f')
  })
})