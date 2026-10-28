import {
  ArrowUUpLeft,
  ArrowUUpRight,
  CaretDown,
  CloudArrowDown,
  Copy,
  DownloadSimple,
  Eye,
  FileArrowDown,
  FileArrowUp,
  FileZip,
  FloppyDisk,
  FolderSimple,
  Info,
  PencilSimple,
  Selection,
} from '@phosphor-icons/react'
import * as Popover from '@radix-ui/react-popover'
import { useRef, useState, type ChangeEvent } from 'react'

import { useScoreStore } from '../../app/use-score-store'
import { ProgressOverlay } from '../../components/ProgressOverlay'
import {
  clearCloudSource,
  defaultCloudSource,
  fetchCloudBooks,
  loadCloudSource,
  saveCloudSource,
  type CloudSource,
} from '../../data/cloud-source'
import {
  downloadScoreBook,
  downloadScoreBooksArchive,
  downloadScorePage,
  parseScoreBookFiles,
  type FileProgress,
} from '../../data/score-files'
import type { ScoreBook } from '../../domain/score/score-document'
import { PageInfoDialog } from '../editor/PageInfoDialog'
import { CloudSourceDialog } from './CloudSourceDialog'

interface WorkspaceToolbarProps {
  activeBook?: ScoreBook
  books: ScoreBook[]
  isDirty: boolean
  onPreview: () => void
}

interface ProgressState {
  label: string
  value: number
  detail?: string
}

const yieldToUi = () => new Promise<void>((resolve) => {
  setTimeout(resolve, 0)
})

/** 首页与编辑页共用的数据、编辑和预览工具栏。 */
export function WorkspaceToolbar({
  activeBook,
  books,
  isDirty,
  onPreview,
}: WorkspaceToolbarProps) {
  const saveActiveBook = useScoreStore((state) => state.saveActiveBook)
  const importBooks = useScoreStore((state) => state.importBooks)
  const activePageId = useScoreStore((state) => state.activePageId)
  const canUndo = useScoreStore((state) => state.canUndo)
  const canRedo = useScoreStore((state) => state.canRedo)
  const undo = useScoreStore((state) => state.undo)
  const redo = useScoreStore((state) => state.redo)
  const isSelectMode = useScoreStore((state) => state.isSelectMode)
  const selectedNodes = useScoreStore((state) => state.selectedNodes)
  const toggleSelectMode = useScoreStore((state) => state.toggleSelectMode)
  const copySelection = useScoreStore((state) => state.copySelection)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isWorking, setWorking] = useState(false)
  const [notice, setNotice] = useState('')
  const [progress, setProgress] = useState<ProgressState | null>(null)
  const [pageInfoOpen, setPageInfoOpen] = useState(false)
  const [cloudSource, setCloudSource] = useState<CloudSource>(
    () => loadCloudSource() ?? defaultCloudSource(),
  )
  const [cloudDialogOpen, setCloudDialogOpen] = useState(false)

  const activePage = activeBook?.pages.find((page) => page.id === activePageId)

  const progressHandler = (label: string): FileProgress => (value, detail) => {
    setProgress({ label, value, detail })
  }

  const runCloudFetch = async (source: CloudSource) => {
    setWorking(true)
    setNotice('')
    setProgress({
      label: '正在从云端获取谱本',
      value: 2,
      detail: '正在连接云端接口…',
    })
    try {
      const result = await fetchCloudBooks(source, (value, detail) => {
        setProgress({ label: '正在从云端获取谱本', value, detail })
      })
      setProgress({
        label: '正在写入谱本',
        value: 94,
        detail: `共 ${result.books.length} 本`,
      })
      await yieldToUi()
      await importBooks(result.books)
      setProgress({
        label: '云端导入完成',
        value: 100,
        detail: `已导入 ${result.books.length} 本谱`,
      })
      await new Promise((resolve) => setTimeout(resolve, 160))

      if (result.errors.length > 0) {
        setNotice(`云端已导入 ${result.books.length} 本，${result.errors.length} 个文件无法识别`)
      } else {
        setNotice(`已从云端导入 ${result.books.length} 本谱`)
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '云端获取失败，请稍后重试')
    } finally {
      setWorking(false)
      setProgress(null)
    }
  }

  const saveCloudSourceSetting = (source: CloudSource) => {
    const saved = saveCloudSource(source)
    setCloudSource(source)
    setCloudDialogOpen(false)
    if (!saved) {
      setNotice('云端设置无法保存到本地，本次仍会尝试获取')
    }
    void runCloudFetch(source)
  }

  const clearCloudSourceSetting = () => {
    clearCloudSource()
    setCloudSource(defaultCloudSource())
    setCloudDialogOpen(false)
    setNotice('已恢复默认云端地址')
  }

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
    setProgress({ label: '正在导入谱本', value: 2, detail: '准备读取文件…' })
    try {
      const result = await parseScoreBookFiles(files, progressHandler('正在导入谱本'))
      setProgress({
        label: '正在写入谱本',
        value: 94,
        detail: `共 ${result.books.length} 本`,
      })
      await yieldToUi()
      await importBooks(result.books)
      setProgress({
        label: '导入完成',
        value: 100,
        detail: `已导入 ${result.books.length} 本谱`,
      })
      await new Promise((resolve) => setTimeout(resolve, 160))

      if (result.errors.length > 0) {
        setNotice(`已导入 ${result.books.length} 本，${result.errors.length} 个文件无法识别`)
      } else {
        setNotice(`已导入 ${result.books.length} 本谱`)
      }
    } catch {
      setNotice('导入失败，请检查文件后重试')
    } finally {
      setWorking(false)
      setProgress(null)
    }
  }

  const exportPage = async () => {
    if (!activeBook || !activePage) return

    setWorking(true)
    setNotice('')
    setProgress({ label: '正在导出当前页', value: 25, detail: '正在生成 JSON…' })
    try {
      await yieldToUi()
      downloadScorePage(activeBook, activePage)
      setProgress({ label: '导出完成', value: 100, detail: activePage.title })
      await new Promise((resolve) => setTimeout(resolve, 160))
      setNotice(`已导出页面「${activePage.title}」`)
    } catch {
      setNotice('页面导出失败，请稍后重试')
    } finally {
      setWorking(false)
      setProgress(null)
    }
  }

  const exportBook = async () => {
    if (!activeBook) return

    setWorking(true)
    setNotice('')
    setProgress({ label: '正在导出当前谱本', value: 25, detail: '正在生成 JSON…' })
    try {
      await yieldToUi()
      downloadScoreBook(activeBook)
      setProgress({ label: '导出完成', value: 100, detail: activeBook.title })
      await new Promise((resolve) => setTimeout(resolve, 160))
      setNotice(`已导出谱本「${activeBook.title}」`)
    } catch {
      setNotice('谱本导出失败，请稍后重试')
    } finally {
      setWorking(false)
      setProgress(null)
    }
  }

  const exportAll = async () => {
    setWorking(true)
    setNotice('')
    setProgress({ label: '正在打包全部谱本', value: 3, detail: `共 ${books.length} 本` })
    try {
      await downloadScoreBooksArchive(books, progressHandler('正在打包全部谱本'))
      setProgress({ label: '打包完成', value: 100, detail: 'ZIP 已开始下载' })
      await new Promise((resolve) => setTimeout(resolve, 160))
      setNotice(`已打包 ${books.length} 本谱`)
    } catch {
      setNotice('批量导出失败，请稍后重试')
    } finally {
      setWorking(false)
      setProgress(null)
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
        <Popover.Root>
          <Popover.Trigger asChild>
            <button
              className={`text-button edit-menu-button ${isSelectMode ? 'is-active' : ''}`}
              aria-label="编辑菜单"
              title="编辑"
            >
              <PencilSimple size={18} />
              <span>编辑</span>
              <CaretDown className="menu-caret" size={11} weight="bold" aria-hidden="true" />
            </button>
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content className="edit-popover" align="end" sideOffset={8}>
              <div className="edit-popover-heading">
                <strong>编辑</strong>
                <span>历史、选择与复制</span>
              </div>

              <Popover.Close asChild>
                <button onClick={undo} disabled={!canUndo} aria-label="撤回">
                  <ArrowUUpLeft size={17} />
                  <span>
                    <strong>撤回</strong>
                    <small>{canUndo ? '恢复上一步编辑' : '暂无可撤回操作'}</small>
                  </span>
                  <kbd>Ctrl/Cmd Z</kbd>
                </button>
              </Popover.Close>

              <Popover.Close asChild>
                <button onClick={redo} disabled={!canRedo} aria-label="重做">
                  <ArrowUUpRight size={17} />
                  <span>
                    <strong>重做</strong>
                    <small>{canRedo ? '恢复刚撤回的编辑' : '暂无可重做操作'}</small>
                  </span>
                  <kbd>Ctrl/Cmd ⇧ Z</kbd>
                </button>
              </Popover.Close>

              <div className="edit-popover-separator" />

              <Popover.Close asChild>
                <button
                  onClick={toggleSelectMode}
                  aria-label={isSelectMode ? '退出选择模式' : '选择节点'}
                >
                  <Selection size={17} />
                  <span>
                    <strong>{isSelectMode ? '退出选择模式' : '选择节点'}</strong>
                    <small>点击音符节点进行多选</small>
                  </span>
                  {isSelectMode && <kbd>Esc</kbd>}
                </button>
              </Popover.Close>

              <Popover.Close asChild>
                <button
                  onClick={copySelection}
                  disabled={!isSelectMode || selectedNodes.length === 0}
                  aria-label="复制选中音符"
                >
                  <Copy size={17} />
                  <span>
                    <strong>复制选中音符</strong>
                    <small>
                      {selectedNodes.length > 0
                        ? `已选 ${selectedNodes.length} 个`
                        : '先选择节点'}
                    </small>
                  </span>
                  <kbd>Ctrl/Cmd C</kbd>
                </button>
              </Popover.Close>

              {activePage && (
                <>
                  <div className="edit-popover-separator" />
                  <Popover.Close asChild>
                    <button
                      onClick={() => setPageInfoOpen(true)}
                      aria-label="编辑信息"
                    >
                      <Info size={17} />
                      <span>
                        <strong>编辑信息</strong>
                        <small>{activePage.title}</small>
                      </span>
                    </button>
                  </Popover.Close>
                </>
              )}

              <Popover.Arrow className="edit-popover-arrow" />
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
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
          <button
            className="text-button file-menu-button"
            aria-label={activeBook ? '文件操作' : '数据操作'}
          >
            <FolderSimple size={18} />
            <span>{activeBook ? '文件' : '数据'}</span>
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content className="file-popover" align="end" sideOffset={8}>
            <div className="file-popover-heading">
              <strong>{activeBook ? '当前谱本' : '数据与云端'}</strong>
              <span>
                {activeBook ? '可导出当前页或整本 JSON' : 'JSON / ZIP 批量导入导出'}
              </span>
            </div>

            <Popover.Close asChild>
              <button onClick={() => fileInputRef.current?.click()} disabled={isWorking}>
                <FileArrowUp size={19} />
                <span>
                  <strong>{activeBook ? '导入 JSON' : '导入 JSON / ZIP'}</strong>
                  <small>
                    {activeBook ? '导入单本谱本' : '一次导入 ZIP 中的全部谱本'}
                  </small>
                </span>
              </button>
            </Popover.Close>

            {!activeBook && (
              <>
                <div className="file-popover-separator" />
                <Popover.Close asChild>
                  <button
                    onClick={() => setCloudDialogOpen(true)}
                    disabled={isWorking}
                  >
                    <CloudArrowDown size={19} />
                    <span>
                      <strong>云端获取</strong>
                      <small>进入设置后手动导入</small>
                    </span>
                  </button>
                </Popover.Close>
              </>
            )}

            {activeBook && activePage && (
              <Popover.Close asChild>
                <button onClick={exportPage} disabled={isWorking}>
                  <FileArrowDown size={19} />
                  <span>
                    <strong>导出当前页</strong>
                    <small>{activePage.title}</small>
                  </span>
                </button>
              </Popover.Close>
            )}

            {activeBook && (
              <Popover.Close asChild>
                <button onClick={exportBook} disabled={isWorking}>
                  <DownloadSimple size={19} />
                  <span>
                    <strong>导出当前谱本</strong>
                    <small>{activeBook.title}</small>
                  </span>
                </button>
              </Popover.Close>
            )}

            {!activeBook && (
              <Popover.Close asChild>
                <button onClick={exportAll} disabled={isWorking || books.length === 0}>
                  <FileZip size={19} />
                  <span>
                    <strong>批量导出全部</strong>
                    <small>打包为 ZIP 文件</small>
                  </span>
                </button>
              </Popover.Close>
            )}

            <Popover.Arrow className="file-popover-arrow" />
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>

      <input
        ref={fileInputRef}
        className="visually-hidden"
        type="file"
        accept={activeBook
          ? 'application/json,.json'
          : 'application/json,.json,application/zip,.zip'}
        multiple
        aria-label={activeBook ? '选择要导入的 JSON 文件' : '选择要导入的 JSON 或 ZIP 文件'}
        onChange={importFiles}
      />

      {pageInfoOpen && activePage && (
        <PageInfoDialog
          key={activePage.id}
          page={activePage}
          onClose={() => setPageInfoOpen(false)}
        />
      )}

      {cloudDialogOpen && (
        <CloudSourceDialog
          source={cloudSource}
          onClose={() => setCloudDialogOpen(false)}
          onSave={saveCloudSourceSetting}
          onClear={clearCloudSourceSetting}
        />
      )}

      {progress && (
        <ProgressOverlay
          label={progress.label}
          value={progress.value}
          detail={progress.detail}
        />
      )}
    </div>
  )
}