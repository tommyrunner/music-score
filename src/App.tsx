import { ArrowLeft, Guitar, Plus } from '@phosphor-icons/react'
import { useEffect, useRef, useState } from 'react'

import { useScoreStore } from './app/use-score-store'
import { ImagePageView } from './features/editor/ImagePageView'
import { ScoreEditor } from './features/editor/ScoreEditor'
import { AddPageDialog, CreateBookDialog } from './features/library/BookDialogs'
import { HomeLibrary } from './features/library/HomeLibrary'
import { PageDirectory } from './features/library/PageDirectory'
import { ScorePreview } from './features/preview/ScorePreview'
import { WorkspaceToolbar } from './features/workspace/WorkspaceToolbar'

export function App() {
  const [isBookDialogOpen, setBookDialogOpen] = useState(false)
  const [isPageDialogOpen, setPageDialogOpen] = useState(false)
  const [isPreviewOpen, setPreviewOpen] = useState(false)
  const startedHydrating = useRef(false)
  const books = useScoreStore((state) => state.books)
  const activeBookId = useScoreStore((state) => state.activeBookId)
  const activePageId = useScoreStore((state) => state.activePageId)
  const isDirty = useScoreStore((state) => state.isDirty)
  const isHydrated = useScoreStore((state) => state.isHydrated)
  const hydrate = useScoreStore((state) => state.hydrate)
  const goHome = useScoreStore((state) => state.goHome)

  useEffect(() => {
    if (isHydrated || startedHydrating.current) return
    startedHydrating.current = true
    void hydrate()
  }, [hydrate, isHydrated])

  const activeBook = books.find((book) => book.id === activeBookId)
  const activePage = activeBook?.pages.find((page) => page.id === activePageId)

  if (!isHydrated) {
    return (
      <main className="app-loading">
        <span aria-hidden="true">弦</span>
        <div><strong>弦间</strong><small>正在打开你的谱房…</small></div>
      </main>
    )
  }

  if (!activeBook) {
    return (
      <>
        <HomeLibrary books={books} onCreateBook={() => setBookDialogOpen(true)} />
        <CreateBookDialog open={isBookDialogOpen} onOpenChange={setBookDialogOpen} />
      </>
    )
  }

  return (
    <div className="editor-page">
      <header className="editor-header">
        <div className="editor-header-leading">
          <button className="editor-icon-button back-home" onClick={goHome} aria-label="返回我的谱本">
            <ArrowLeft size={20} />
          </button>
          <span className="editor-brand"><Guitar size={18} weight="fill" /></span>
          <div className="editor-title">
            <strong>{activeBook.title}</strong>
            <small>{isDirty ? '尚未保存' : '已保存在这台设备'}</small>
          </div>
        </div>
        <div className="editor-actions">
          <button
            className="editor-action-button add-sheet-button"
            onClick={() => setPageDialogOpen(true)}
            aria-label="新增一页"
          >
            <Plus size={17} weight="bold" />
            <span>新增一页</span>
          </button>
          <WorkspaceToolbar
            activeBook={activeBook}
            books={books}
            isDirty={isDirty}
            onPreview={() => setPreviewOpen(true)}
          />
          <PageDirectory book={activeBook} onAddPage={() => setPageDialogOpen(true)} />
        </div>
      </header>

      <main className="editor-canvas">
        {!activePage ? (
          <section className="page-empty-state">
            <div className="empty-staff" aria-hidden="true">
              {Array.from({ length: 6 }, (_, index) => <i key={index} />)}
            </div>
            <h1>{activeBook.title}</h1>
            <p>新增一页六线谱，或者放进一张已有的谱图。</p>
            <button className="primary-button" onClick={() => setPageDialogOpen(true)}>
              <Plus size={18} weight="bold" />
              新增一页
            </button>
          </section>
        ) : activePage.type === 'score' ? (
          <ScoreEditor key={activePage.id} page={activePage} />
        ) : (
          <ImagePageView page={activePage} />
        )}
      </main>

      <AddPageDialog open={isPageDialogOpen} onOpenChange={setPageDialogOpen} />
      <ScorePreview open={isPreviewOpen} book={activeBook} onOpenChange={setPreviewOpen} />
    </div>
  )
}
