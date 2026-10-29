import { useState } from 'react'

import { useScoreStore } from '../../app/use-score-store'
import { DialogShell } from '../../components/DialogShell'
import { ArrowUpRight, Guitar, Plus, Trash } from '../../components/icons'
import type { ScoreBook } from '../../domain/score/score-document'
import { WorkspaceToolbar } from '../workspace/WorkspaceToolbar'

interface HomeLibraryProps {
  books: ScoreBook[]
  onCreateBook: () => void
}

function bookDate(book: ScoreBook) {
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'short',
    day: 'numeric',
  }).format(new Date(book.updatedAt))
}

/**
 * 首页谱本列表与谱本删除入口。
 *
 * @param props 首页展示的谱本列表与新建谱本回调。
 */
export function HomeLibrary({ books, onCreateBook }: HomeLibraryProps) {
  const selectBook = useScoreStore((state) => state.selectBook)
  const deleteBook = useScoreStore((state) => state.deleteBook)
  const [pendingDelete, setPendingDelete] = useState<ScoreBook | null>(null)
  const [deleting, setDeleting] = useState(false)

  const confirmDelete = async () => {
    if (!pendingDelete || deleting) return
    setDeleting(true)
    try {
      await deleteBook(pendingDelete.id)
      setPendingDelete(null)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="home-page">
      <header className="home-nav">
        <a className="wordmark" href="#top" aria-label="弦间首页">
          <span><Guitar size={19} weight="fill" /></span>
          <strong>弦间</strong>
        </a>
        <div className="home-nav-actions">
          <WorkspaceToolbar books={books} isDirty={false} onPreview={() => undefined} />
          <button className="primary-button" onClick={onCreateBook}>
            <Plus size={18} weight="bold" />
            新建谱本
          </button>
        </div>
      </header>

      <main id="top" className="home-main">
        <section className="home-hero">
          <div className="hero-copy">
            <p>你的吉他谱，都在这里</p>
            <h1>想到一段旋律，<br />就把它写下来。</h1>
            <span>不用学习复杂的制谱软件。打开谱本，直接点在六根弦上。</span>
          </div>
          <div className="hero-score" aria-hidden="true">
            <span className="hero-chord">Am</span>
            <div className="hero-staff">
              {Array.from({ length: 6 }, (_, index) => <i key={index} />)}
              <b className="hero-note note-one">0</b>
              <b className="hero-note note-two">2</b>
              <b className="hero-note note-three">2</b>
              <b className="hero-note note-four">1</b>
            </div>
            <small>随手记下，随身查看</small>
          </div>
        </section>

        <section className="library-section" aria-labelledby="library-heading">
          <div className="library-heading">
            <div>
              <h2 id="library-heading">我的谱本</h2>
              <p>{books.length > 0 ? `共 ${books.length} 本，保存在这台设备` : '从你的第一本吉他谱开始'}</p>
            </div>
            {books.length > 0 && (
              <button className="new-book-link" onClick={onCreateBook}>
                <Plus size={16} weight="bold" /> 新建一本
              </button>
            )}
          </div>

          {books.length === 0 ? (
            <button className="library-empty" onClick={onCreateBook}>
              <span className="empty-cover">
                {Array.from({ length: 6 }, (_, index) => <i key={index} />)}
              </span>
              <span>
                <strong>还没有谱本</strong>
                <small>给第一本谱起个名字，然后写下第一段旋律</small>
              </span>
              <ArrowUpRight size={22} />
            </button>
          ) : (
            <div className="book-shelf">
              {books.map((book, index) => (
                <article
                  className={`shelf-book ${index === 0 ? 'is-featured' : ''}`}
                  key={book.id}
                >
                  <button
                    className="shelf-book-open"
                    onClick={() => selectBook(book.id)}
                    aria-label={`打开谱本 ${book.title}`}
                  >
                    <span className="book-cover">
                      <span className="book-binding" />
                      <span className="book-instrument">GUITAR TAB</span>
                      <strong>{book.title}</strong>
                      <span className="cover-staff">
                        {Array.from({ length: 6 }, (_, staffIndex) => <i key={staffIndex} />)}
                      </span>
                      <small>{book.pages[0]?.title ?? '还没有写下内容'}</small>
                    </span>
                    <span className="book-caption">
                      <span>{book.pages.length} 页</span>
                      <time dateTime={book.updatedAt}>{bookDate(book)}</time>
                      <ArrowUpRight size={17} />
                    </span>
                  </button>
                  <button
                    className="shelf-book-delete"
                    type="button"
                    aria-label={`删除谱本 ${book.title}`}
                    title="删除谱本"
                    onClick={() => setPendingDelete(book)}
                  >
                    <Trash size={16} />
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>

      {pendingDelete && (
        <DialogShell
          open
          onOpenChange={(open) => {
            if (!open && !deleting) setPendingDelete(null)
          }}
          title="删除谱本"
          description="删除后无法恢复，谱本中的页面和图片链接都会一起移除。"
          footer={(
            <div className="dialog-footer-actions">
              <button
                className="text-button"
                type="button"
                onClick={() => setPendingDelete(null)}
                disabled={deleting}
              >
                取消
              </button>
              <button
                className="danger-button"
                type="button"
                onClick={confirmDelete}
                disabled={deleting}
              >
                {deleting ? '正在删除…' : '确认删除'}
              </button>
            </div>
          )}
        >
          <p className="confirm-copy">
            确定要删除「<strong>{pendingDelete.title}</strong>」吗？
          </p>
        </DialogShell>
      )}
    </div>
  )
}
