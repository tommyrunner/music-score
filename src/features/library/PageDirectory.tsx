import { FileImage, ListDashes, MusicNotes, Plus } from '@phosphor-icons/react'
import * as Popover from '@radix-ui/react-popover'
import { useState } from 'react'

import { useScoreStore } from '../../app/use-score-store'
import type { ScoreBook } from '../../domain/score/score-document'

/** 编辑器页面目录弹层。 */
export function PageDirectory({ book, onAddPage }: { book: ScoreBook; onAddPage: () => void }) {
  const activePageId = useScoreStore((state) => state.activePageId)
  const selectPage = useScoreStore((state) => state.selectPage)
  const [open, setOpen] = useState(false)

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button className="editor-icon-button directory-trigger" aria-label="打开页面目录">
          <ListDashes size={20} />
          <span>目录</span>
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content className="page-directory" align="end" sideOffset={10}>
          <div className="directory-heading">
            <div><strong>页面目录</strong><span>{book.pages.length} 页</span></div>
            <button onClick={() => { setOpen(false); onAddPage() }}>
              <Plus size={16} weight="bold" /> 新增一页
            </button>
          </div>
          <nav aria-label="页面目录">
            {book.pages.length === 0 ? (
              <p>这本谱还没有内容</p>
            ) : book.pages.map((page, index) => (
              <button
                key={page.id}
                className={page.id === activePageId ? 'is-active' : ''}
                onClick={() => {
                  selectPage(page.id)
                  setOpen(false)
                }}
              >
                <span>{page.type === 'score' ? <MusicNotes size={18} /> : <FileImage size={18} />}</span>
                <strong>{page.title}</strong>
                <small>第 {index + 1} 页</small>
              </button>
            ))}
          </nav>
          <Popover.Arrow className="file-popover-arrow" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
