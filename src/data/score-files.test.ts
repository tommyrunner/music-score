import { describe, expect, it } from 'vitest'

import { createScoreBook } from '../domain/score/score-document'
import {
  createImagePageFromFile,
  parseScoreBookFiles,
  scoreBookArchiveEntries,
  scoreBookFileName,
} from './score-files'

describe('score file boundaries', () => {
  it('creates a safe file name for one exported score book', () => {
    const book = createScoreBook('雨夜 / 练习')

    expect(scoreBookFileName(book)).toBe('雨夜-练习.stringroom.json')
  })

  it('keeps every book when duplicate titles are exported together', () => {
    const first = createScoreBook('同名练习')
    const second = createScoreBook('同名练习')

    expect(Object.keys(scoreBookArchiveEntries([first, second]))).toEqual([
      '同名练习.stringroom.json',
      '同名练习-2.stringroom.json',
    ])
  })

  it('imports multiple valid score books and reports an invalid file', async () => {
    const first = createScoreBook('第一本')
    const second = createScoreBook('第二本')
    const files = [
      new File([JSON.stringify(first)], 'first.json', { type: 'application/json' }),
      new File([JSON.stringify(second)], 'second.json', { type: 'application/json' }),
      new File(['{"bad":true}'], 'bad.json', { type: 'application/json' }),
    ]

    const result = await parseScoreBookFiles(files)

    expect(result.books.map((book) => book.title)).toEqual(['第一本', '第二本'])
    expect(result.errors).toEqual([{ fileName: 'bad.json', message: '无法识别这份乐谱文件' }])
  })

  it('embeds a supported image inside an image page', async () => {
    const file = new File(['image-bytes'], '手写谱.png', { type: 'image/png' })

    const page = await createImagePageFromFile('手写页', file)

    expect(page.type).toBe('image')
    expect(page.image.name).toBe('手写谱.png')
    expect(page.image.mimeType).toBe('image/png')
    expect(page.image.dataUrl).toMatch(/^data:image\/png;base64,/) 
  })

  it('rejects unsupported image types', async () => {
    const file = new File(['<svg />'], 'unsafe.svg', { type: 'image/svg+xml' })

    await expect(createImagePageFromFile('不安全图片', file)).rejects.toThrow(
      '仅支持 JPEG、PNG 或 WebP 图片',
    )
  })
})
