import { FileImage, MusicNotes, UploadSimple } from '@phosphor-icons/react'
import { useState, type FormEvent } from 'react'

import { useScoreStore } from '../../app/use-score-store'
import { DialogShell } from '../../components/DialogShell'
import { createImagePageFromFile } from '../../data/score-files'

interface BookDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CreateBookDialog({ open, onOpenChange }: BookDialogProps) {
  const createBook = useScoreStore((state) => state.createBook)
  const [title, setTitle] = useState('')

  const changeOpen = (nextOpen: boolean) => {
    if (!nextOpen) setTitle('')
    onOpenChange(nextOpen)
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!title.trim()) return
    createBook(title.trim())
    changeOpen(false)
  }

  return (
    <DialogShell
      open={open}
      onOpenChange={changeOpen}
      title="新建谱本"
      description="先给它一个容易找到的名字。"
    >
      <form className="dialog-form" onSubmit={submit}>
        <label htmlFor="book-title">谱本名称</label>
        <input
          id="book-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          maxLength={80}
          autoFocus
        />
        <button className="primary-button" type="submit" disabled={!title.trim()}>
          创建谱本
        </button>
      </form>
    </DialogShell>
  )
}

export function AddPageDialog({ open, onOpenChange }: BookDialogProps) {
  const addScorePage = useScoreStore((state) => state.addScorePage)
  const addImagePage = useScoreStore((state) => state.addImagePage)
  const [title, setTitle] = useState('')
  const [pageType, setPageType] = useState<'score' | 'image'>('score')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [error, setError] = useState('')
  const [isCreating, setCreating] = useState(false)

  const changeOpen = (nextOpen: boolean) => {
    if (!nextOpen) {
      setTitle('')
      setPageType('score')
      setImageFile(null)
      setError('')
      setCreating(false)
    }
    onOpenChange(nextOpen)
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!title.trim()) return

    if (pageType === 'score') {
      addScorePage(title.trim())
      changeOpen(false)
      return
    }

    if (!imageFile) {
      setError('请先选择一张图片')
      return
    }

    setCreating(true)
    setError('')
    try {
      addImagePage(await createImagePageFromFile(title.trim(), imageFile))
      changeOpen(false)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '图片页面创建失败')
      setCreating(false)
    }
  }

  return (
    <DialogShell
      open={open}
      onOpenChange={changeOpen}
      title="新增一页"
      description="选择一张空白六线谱，或放进已有的谱图。"
    >
      <form className="dialog-form" onSubmit={submit}>
        <fieldset className="page-type-picker">
          <legend>页面类型</legend>
          <button
            className={pageType === 'score' ? 'is-selected' : ''}
            type="button"
            aria-label="六线谱页面"
            aria-pressed={pageType === 'score'}
            onClick={() => {
              setPageType('score')
              setError('')
            }}
          >
            <MusicNotes size={21} />
            <span><strong>六线谱页面</strong><small>点击弦线填写品位</small></span>
          </button>
          <button
            className={pageType === 'image' ? 'is-selected' : ''}
            type="button"
            aria-label="图片页面"
            aria-pressed={pageType === 'image'}
            onClick={() => {
              setPageType('image')
              setError('')
            }}
          >
            <FileImage size={21} />
            <span><strong>图片页面</strong><small>PNG、JPEG 或 WebP</small></span>
          </button>
        </fieldset>

        <label htmlFor="page-title">页面名称</label>
        <input
          id="page-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          maxLength={80}
          autoFocus
        />

        {pageType === 'image' && (
          <div className="image-file-field">
            <label htmlFor="page-image"><UploadSimple size={18} /> 选择图片</label>
            <input
              id="page-image"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(event) => {
                setImageFile(event.target.files?.[0] ?? null)
                setError('')
              }}
            />
            <span>{imageFile?.name ?? '图片会完整保存在这份 JSON 中'}</span>
          </div>
        )}

        {error && <p className="form-error" role="alert">{error}</p>}

        <button
          className="primary-button"
          type="submit"
          disabled={!title.trim() || isCreating}
        >
          {isCreating
            ? '正在处理图片…'
            : pageType === 'score' ? '新增六线谱页' : '新增图片页'}
        </button>
      </form>
    </DialogShell>
  )
}
