/**
 * 谱本 JSON 文件的导入、导出、ZIP 打包与图片地址校验。
 */

import {
  createScoreBook,
  parseScoreBook,
  type ScoreBook,
  type ScoreBookPage,
} from '../domain/score/score-document'

const MAX_JSON_BYTES = 15 * 1024 * 1024
const MAX_ARCHIVE_BYTES = 80 * 1024 * 1024

/**
 * 文件导入导出进度回调。
 */
export type FileProgress = (progress: number, detail: string) => void

/**
 * 单个文件导入失败的信息。
 */
export interface ImportError {
  fileName: string
  message: string
}

/**
 * 批量导入结果。
 */
export interface ImportResult {
  books: ScoreBook[]
  errors: ImportError[]
}

const yieldToUi = () => new Promise<void>((resolve) => {
  setTimeout(resolve, 0)
})

function readFileText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('读取文件失败'))
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.readAsText(file)
  })
}

function readFileBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('读取文件失败'))
    reader.onload = () => resolve(reader.result as ArrayBuffer)
    reader.readAsArrayBuffer(file)
  })
}

function safeFileTitle(title: string): string {
  return title
    .trim()
    .replace(/[<>:"/\\|?*]+/g, '-')
    .replace(/\s*-\s*/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 72)
}

function isZipFile(file: File): boolean {
  return file.name.toLowerCase().endsWith('.zip') || file.type.includes('zip')
}

function isJsonEntry(name: string): boolean {
  return name.toLowerCase().endsWith('.json')
    && !name.startsWith('__MACOSX/')
    && !name.endsWith('/')
}

/**
 * 校验并规范化图片地址，只允许 http(s) URL。
 *
 * @throws 地址为空或协议不是 http(s) 时抛出错误。
 */
export function normalizeImageUrl(input: string): string {
  const trimmed = input.trim()
  try {
    const url = new URL(trimmed)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new Error('invalid protocol')
    }
    return url.toString()
  } catch {
    throw new Error('图片地址必须是 http(s) URL')
  }
}

/**
 * 生成单本谱本导出时使用的文件名。
 *
 * @param book 谱本数据。
 * @returns 适合保存到本地文件系统的文件名。
 */
export function scoreBookFileName(book: ScoreBook): string {
  return `${safeFileTitle(book.title) || '未命名谱本'}.stringroom.json`
}

/**
 * 生成单页导出时使用的文件名。
 *
 * @param book 谱本数据。
 * @param page 页面数据。
 * @returns 包含谱本名和页面名的 JSON 文件名。
 */
export function scorePageFileName(book: ScoreBook, page: ScoreBookPage): string {
  return `${safeFileTitle(book.title)}-${safeFileTitle(page.title)}.stringroom.json`
}

/**
 * 将单个页面包装成只包含该页的谱本文档。
 *
 * @param book 原谱本，用于生成新谱本标题。
 * @param page 要导出的页面。
 * @returns 可以重新导入的单页谱本文档。
 */
export function scorePageAsBook(book: ScoreBook, page: ScoreBookPage): ScoreBook {
  const pageBook = createScoreBook(`${book.title} · ${page.title}`.slice(0, 80))
  return {
    ...pageBook,
    pages: [page],
  }
}

/**
 * 解压 ZIP 并逐个解析其中的谱本 JSON。
 *
 * @param file ZIP 文件。
 * @param startProgress 该文件起始进度。
 * @param endProgress 该文件结束进度。
 * @param books 解析成功的谱本收集数组。
 * @param errors 解析失败信息收集数组。
 * @param onProgress 进度回调。
 */
async function importZipFile(
  file: File,
  startProgress: number,
  endProgress: number,
  books: ScoreBook[],
  errors: ImportError[],
  onProgress?: FileProgress,
): Promise<void> {
  if (file.size > MAX_ARCHIVE_BYTES) throw new Error('ZIP 文件不能超过 80MB')

  onProgress?.(Math.round(startProgress), `正在解压 ${file.name}`)
  await yieldToUi()

  const { strFromU8, unzipSync } = await import('fflate')
  let archive: Record<string, Uint8Array>
  try {
    archive = unzipSync(new Uint8Array(await readFileBuffer(file)), {
      // 只解压 JSON，并跳过 Mac 元数据和超大条目。
      filter: (entry) =>
        isJsonEntry(entry.name)
        && (!entry.originalSize || entry.originalSize <= MAX_JSON_BYTES),
    })
  } catch {
    throw new Error('无法识别这个 ZIP 文件')
  }
  const entries = Object.entries(archive)
  if (entries.length === 0) {
    throw new Error('ZIP 中没有可导入的 JSON 谱本')
  }

  for (let index = 0; index < entries.length; index += 1) {
    const [entryName, bytes] = entries[index]
    try {
      books.push(parseScoreBook(strFromU8(bytes)))
    } catch (error) {
      errors.push({
        fileName: `${file.name} / ${entryName}`,
        message: error instanceof Error ? error.message : '导入失败',
      })
    }

    const progress = startProgress
      + ((endProgress - startProgress) * ((index + 1) / entries.length))
    onProgress?.(Math.round(progress), `正在解析 ${entryName}`)
    await yieldToUi()
  }
}

/**
 * 解析用户选择的 JSON 或 ZIP 文件。
 *
 * 单个文件失败不会中断其余文件，失败信息会收集到返回值中。
 */
export async function parseScoreBookFiles(
  files: File[],
  onProgress?: FileProgress,
): Promise<ImportResult> {
  const books: ScoreBook[] = []
  const errors: ImportError[] = []
  if (files.length === 0) return { books, errors }

  onProgress?.(2, '准备读取文件')
  await yieldToUi()

  for (let index = 0; index < files.length; index += 1) {
    const file = files[index]
    // 每个文件占据固定进度区间，ZIP 内再按条目数量分摊。
    const startProgress = 2 + (88 * index) / files.length
    const endProgress = 2 + (88 * (index + 1)) / files.length

    try {
      if (isZipFile(file)) {
        await importZipFile(file, startProgress, endProgress, books, errors, onProgress)
      } else {
        if (file.size > MAX_JSON_BYTES) throw new Error('文件不能超过 15MB')
        onProgress?.(Math.round(startProgress), `正在读取 ${file.name}`)
        books.push(parseScoreBook(await readFileText(file)))
        onProgress?.(Math.round(endProgress), `已读取 ${file.name}`)
      }
    } catch (error) {
      errors.push({
        fileName: file.name,
        message: error instanceof Error ? error.message : '导入失败',
      })
    }

    await yieldToUi()
  }

  onProgress?.(90, `已解析 ${books.length} 本谱`)
  return { books, errors }
}

/**
 * 触发浏览器下载指定 Blob。
 *
 * @param blob 文件内容。
 * @param fileName 下载文件名。
 */
function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  URL.revokeObjectURL(url)
}

/**
 * 将整本谱本下载为 JSON 文件。
 *
 * @param book 要导出的谱本。
 */
export function downloadScoreBook(book: ScoreBook): void {
  const json = JSON.stringify(book, null, 2)
  downloadBlob(new Blob([json], { type: 'application/json' }), scoreBookFileName(book))
}

/**
 * 将当前页面下载为只包含该页的 JSON 文件。
 *
 * @param book 页面所属谱本。
 * @param page 要导出的页面。
 */
export function downloadScorePage(book: ScoreBook, page: ScoreBookPage): void {
  const json = JSON.stringify(scorePageAsBook(book, page), null, 2)
  downloadBlob(new Blob([json], { type: 'application/json' }), scorePageFileName(book, page))
}

/**
 * 生成批量导出 ZIP 的文件名与 JSON 内容映射。
 * 重名谱本会自动追加序号。
 */
export function scoreBookArchiveEntries(books: ScoreBook[]): Record<string, string> {
  const entries: Record<string, string> = {}

  for (const book of books) {
    const fileName = scoreBookFileName(book)
    const suffix = '.stringroom.json'
    const baseName = fileName.slice(0, -suffix.length)
    // 同名谱本自动追加序号，避免 ZIP 内条目互相覆盖。
    let uniqueName = fileName
    let copyNumber = 2
    while (uniqueName in entries) {
      uniqueName = `${baseName}-${copyNumber}${suffix}`
      copyNumber += 1
    }
    entries[uniqueName] = JSON.stringify(book, null, 2)
  }

  return entries
}

/**
 * 将全部谱本打包为 ZIP 并下载。
 *
 * @param books 要打包的谱本列表。
 * @param onProgress 打包进度回调。
 */
export async function downloadScoreBooksArchive(
  books: ScoreBook[],
  onProgress?: FileProgress,
): Promise<void> {
  onProgress?.(5, '正在整理谱本')
  await yieldToUi()

  const entries = scoreBookArchiveEntries(books)
  onProgress?.(35, '正在压缩 ZIP')
  await yieldToUi()

  const { strToU8, zipSync } = await import('fflate')
  const archive = zipSync(
    Object.fromEntries(
      Object.entries(entries).map(([fileName, json]) => [fileName, strToU8(json)]),
    ),
    { level: 6 },
  )
  onProgress?.(80, '正在准备下载')
  await yieldToUi()

  downloadBlob(new Blob([archive.buffer as ArrayBuffer], { type: 'application/zip' }), '弦间-全部谱本.zip')
  onProgress?.(100, '打包完成')
}