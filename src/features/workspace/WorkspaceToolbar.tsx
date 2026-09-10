import {
  DownloadSimple,
  Eye,
  FileArrowUp,
  FloppyDisk,
  FolderSimple,
  Package,
} from '@phosphor-icons/react'
import * as Popover from '@radix-ui/react-popover'
import { useRef, useState, type ChangeEvent } from 'react'

import { useScoreStore } from '../../app/use-score-store'
import {
  downloadScoreBook,
  downloadScoreBooksArchive,
  parseScoreBookFiles,
} from '../../data/score-files'
import type { ScoreBook } from '../../domain/score/score-document'

interface WorkspaceToolbarProps {
  activeBook?: ScoreBook
  books: ScoreBook[]
  isDirty: boolean
  onPreview: () => void
}

export function WorkspaceToolbar({
  activeBook,
  books,
  isDirty,
  onPreview,
}: WorkspaceToolbarProps) {
  const saveActiveBook = useScoreStore((state) => state.saveActiveBook)
  const importBooks = useScoreStore((state) => state.importBooks)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isWorking, setWorking] = useState(false)
  const [notice, setNotice] = useState('')

  const save = async () => {
    setWorking(true)
    setNotice('')
    try {
      await saveActiveBook()
      setNotice('已保存到这台设备')
    } catch {
      setNotice('保存失败，请导出 JSON 备份')
    } finally {
      setWorking(false)
    }
  }

  const importFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? [])
    event.target.value = ''
    if (files.length === 0) return

    setWorking(true)
    setNotice('')
    try {
      const result = await parseScoreBookFiles(files)
      await importBooks(result.books)
      if (result.errors.length > 0) {
        setNotice(`已导入 ${result.books.length} 本，${result.errors.length} 个文件无法识别`)
      } else {
        setNotice(`已导入 ${result.books.length} 本谱`)
      }
    } catch {
      setNotice('导入失败，请检查文件后重试')
    } finally {
      setWorking(false)
    }
  }

  const exportAll = async () => {
    setWorking(true)
    setNotice('')
    try {
      await downloadScoreBooksArchive(books)
      setNotice(`已打包 ${books.length} 本谱`)
    } catch {
      setNotice('批量导出失败，请稍后重试')
    } finally {
      setWorking(false)
    }
  }

  return (
    <div className="workspace-toolbar">
      {notice && <span className="toolbar-notice" role="status">{notice}</span>}

      {activeBook && (
        <button
          className={`text-button save-button ${isDirty ? 'has-changes' : ''}`}
          onClick={save}
          disabled={isWorking || !isDirty}
          aria-label="保存谱本"
        >
          <FloppyDisk size={18} weight={isDirty ? 'fill' : 'regular'} />
          <span>{isDirty ? '保存' : '已保存'}</span>
        </button>
      )}

      {activeBook && (
        <button
          className="text-button"
          onClick={onPreview}
          aria-label="纸张预览"
          disabled={activeBook.pages.length === 0}
        >
          <Eye size={18} />
          <span>预览</span>
        </button>
      )}

      <Popover.Root>
        <Popover.Trigger asChild>
          <button className="text-button file-menu-button" aria-label="文件操作">
            <FolderSimple size={18} />
            <span>文件</span>
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content className="file-popover" align="end" sideOffset={8}>
            <div className="file-popover-heading">
              <strong>带走你的谱</strong>
              <span>每本谱都是独立 JSON</span>
            </div>
            <button onClick={() => fileInputRef.current?.click()} disabled={isWorking}>
              <FileArrowUp size={19} />
              <span><strong>导入 JSON</strong><small>可同时选择多个文件</small></span>
            </button>
            {activeBook && (
              <button onClick={() => downloadScoreBook(activeBook)}>
                <DownloadSimple size={19} />
                <span><strong>导出当前谱本</strong><small>{activeBook.title}</small></span>
              </button>
            )}
            <button onClick={exportAll} disabled={isWorking || books.length === 0}>
              <Package size={19} />
              <span><strong>批量导出全部</strong><small>打包为 ZIP 文件</small></span>
            </button>
            <Popover.Arrow className="file-popover-arrow" />
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>

      <input
        ref={fileInputRef}
        className="visually-hidden"
        type="file"
        accept="application/json,.json"
        multiple
        aria-label="选择要导入的 JSON 文件"
        onChange={importFiles}
      />
    </div>
  )
}
