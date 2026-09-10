import {
  createImagePage,
  parseScoreBook,
  type ImagePage,
  type ScoreBook,
} from '../domain/score/score-document'

const MAX_JSON_BYTES = 15 * 1024 * 1024
const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const

interface ImportError {
  fileName: string
  message: string
}

interface ImportResult {
  books: ScoreBook[]
  errors: ImportError[]
}

function readFile(file: File, mode: 'text' | 'dataUrl'): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('读取文件失败'))
    reader.onload = () => resolve(String(reader.result ?? ''))
    if (mode === 'text') reader.readAsText(file)
    else reader.readAsDataURL(file)
  })
}

export function scoreBookFileName(book: ScoreBook): string {
  const safeTitle = book.title
    .trim()
    .replace(/[<>:"/\\|?*]+/g, '-')
    .replace(/\s*-\s*/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 72)

  return `${safeTitle || '未命名谱本'}.stringroom.json`
}

export async function parseScoreBookFiles(files: File[]): Promise<ImportResult> {
  const books: ScoreBook[] = []
  const errors: ImportError[] = []

  for (const file of files) {
    try {
      if (file.size > MAX_JSON_BYTES) throw new Error('文件不能超过 15MB')
      books.push(parseScoreBook(await readFile(file, 'text')))
    } catch (error) {
      errors.push({
        fileName: file.name,
        message: error instanceof Error ? error.message : '导入失败',
      })
    }
  }

  return { books, errors }
}

export async function createImagePageFromFile(
  title: string,
  file: File,
): Promise<ImagePage> {
  if (!IMAGE_TYPES.includes(file.type as (typeof IMAGE_TYPES)[number])) {
    throw new Error('仅支持 JPEG、PNG 或 WebP 图片')
  }
  if (file.size > MAX_IMAGE_BYTES) throw new Error('图片不能超过 5MB')

  return createImagePage(title, {
    name: file.name,
    mimeType: file.type as ImagePage['image']['mimeType'],
    dataUrl: await readFile(file, 'dataUrl'),
  })
}

function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  URL.revokeObjectURL(url)
}

export function downloadScoreBook(book: ScoreBook): void {
  const json = JSON.stringify(book, null, 2)
  downloadBlob(new Blob([json], { type: 'application/json' }), scoreBookFileName(book))
}

export function scoreBookArchiveEntries(books: ScoreBook[]): Record<string, string> {
  const entries: Record<string, string> = {}

  for (const book of books) {
    const fileName = scoreBookFileName(book)
    const suffix = '.stringroom.json'
    const baseName = fileName.slice(0, -suffix.length)
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

export async function downloadScoreBooksArchive(books: ScoreBook[]): Promise<void> {
  const { strToU8, zipSync } = await import('fflate')
  const entries = Object.fromEntries(
    Object.entries(scoreBookArchiveEntries(books)).map(([fileName, json]) => [
      fileName,
      strToU8(json),
    ]),
  )
  const archive = zipSync(entries, { level: 6 })
  downloadBlob(new Blob([archive.buffer as ArrayBuffer], { type: 'application/zip' }), '弦间-全部谱本.zip')
}
