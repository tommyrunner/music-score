import { ArrowUpRight, Guitar, Plus } from '@phosphor-icons/react'

import { useScoreStore } from '../../app/use-score-store'
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

export function HomeLibrary({ books, onCreateBook }: HomeLibraryProps) {
  const selectBook = useScoreStore((state) => state.selectBook)

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
            <p>你的吉他谱，都在1这里</p>
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
                <button
                  className={`shelf-book ${index === 0 ? 'is-featured' : ''}`}
                  key={book.id}
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
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
