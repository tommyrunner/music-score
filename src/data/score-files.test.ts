import { strToU8, zipSync } from 'fflate'
import { describe, expect, it } from 'vitest'

import {
  createImagePage,
  createScoreBook,
  createScorePage,
  parseScoreBook,
} from '../domain/score/score-document'
import {
  normalizeImageUrl,
  parseScoreBookFiles,
  scoreBookArchiveEntries,
  scoreBookFileName,
  scorePageAsBook,
  scorePageFileName,
} from './score-files'

describe('score file boundaries', () => {
  it('creates safe file names for page and book exports', () => {
    const book = createScoreBook('雨夜 / 练习')
    const page = createScorePage('主歌 / 第一段')

    expect(scoreBookFileName(book)).toBe('雨夜-练习.stringroom.json')
    expect(scorePageFileName(book, page)).toBe('雨夜-练习-主歌-第一段.stringroom.json')
  })

  it('wraps one page into an importable book document', () => {
    const book = createScoreBook('练习册')
    const page = createScorePage('主歌')

    const pageBook = scorePageAsBook(book, page)

    expect(pageBook.title).toBe('练习册 · 主歌')
    expect(pageBook.pages).toEqual([page])
    expect(parseScoreBook(JSON.stringify(pageBook))).toEqual(pageBook)
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
    expect(result.errors).toEqual([
      { fileName: 'bad.json', message: '无法识别这份乐谱文件' },
    ])
  })

  it('imports every JSON book from a ZIP archive with progress', async () => {
    const first = createScoreBook('ZIP 第一本')
    const second = createScoreBook('ZIP 第二本')
    const archive = zipSync({
      'first.stringroom.json': strToU8(JSON.stringify(first)),
      'second.stringroom.json': strToU8(JSON.stringify(second)),
      'bad.json': strToU8('{"bad":true}'),
    })
    const file = new File(
      [archive.buffer as ArrayBuffer],
      '全部谱本.zip',
      { type: 'application/zip' },
    )
    const progress: number[] = []

    const result = await parseScoreBookFiles([file], (value) => progress.push(value))

    expect(result.books.map((book) => book.title)).toEqual(['ZIP 第一本', 'ZIP 第二本'])
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].fileName).toBe('全部谱本.zip / bad.json')
    expect(progress.at(-1)).toBe(90)
    expect(progress.every((value, index) => index === 0 || value >= progress[index - 1]))
      .toBe(true)
  })

  it('only accepts http(s) image URLs', () => {
    expect(normalizeImageUrl(' https://example.com/score.png ')).toBe(
      'https://example.com/score.png',
    )
    expect(() => normalizeImageUrl('data:image/png;base64,abc')).toThrow(
      '图片地址必须是 http(s) URL',
    )
    expect(() => normalizeImageUrl('blob:https://example.com/id')).toThrow(
      '图片地址必须是 http(s) URL',
    )

    const page = createImagePage('图片参考', {
      url: 'https://example.com/score.png',
    })
    expect(page.image.url).toBe('https://example.com/score.png')
    expect(() => createImagePage('错误图片', {
      url: 'data:image/png;base64,abc',
    })).toThrow()
  })
})