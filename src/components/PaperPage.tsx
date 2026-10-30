import {
  DEFAULT_CHORD_DISPLAY,
  type ChordDisplayMode,
  type ImagePage,
  type ScoreBookPage,
  type ScoreMeasure,
  type ScorePage,
} from '../domain/score/score-document'

import { ChordMark } from './ChordMark'
import { FittedSingleLineText } from './FittedSingleLineText'
import { ScoreSymbolLayer } from './ScoreSymbolLayer'

function PaperMeasure({
  measure,
  chordDisplay,
}: {
  measure: ScoreMeasure
  chordDisplay: ChordDisplayMode
}) {
  const gridColumns = `repeat(${measure.positions.length}, minmax(0, 1fr))`

  return (
    <div className="preview-measure">
      <div
        className={`preview-chords is-${chordDisplay}`}
        aria-hidden="true"
        style={{ gridTemplateColumns: gridColumns }}
      >
        {measure.positions.map((position) => (
          <span key={position.id}>
            {position.chord && <ChordMark chord={position.chord} mode={chordDisplay} />}
          </span>
        ))}
      </div>
      <div className="preview-staff">
        {Array.from({ length: 6 }, (_, stringIndex) => (
          <div className="preview-string" key={stringIndex} style={{ gridTemplateColumns: gridColumns }}>
            {measure.positions.map((position) => {
              const note = position.notes.find((candidate) => candidate.string === stringIndex + 1)
              return <span key={position.id}>{note?.fret ?? ''}</span>
            })}
          </div>
        ))}
        <div
          className="preview-function-marks"
          aria-hidden="true"
          style={{ gridTemplateColumns: gridColumns }}
        >
          {measure.positions.map((position) => (
            <span key={position.id}>
              {position.barline === 'single' && <i className="preview-functional-barline" />}
            </span>
          ))}
        </div>
        <ScoreSymbolLayer symbols={measure.symbols} positions={measure.positions} />
      </div>
      {measure.lyrics.length > 0 && (
        <div className="preview-lyrics">
          {measure.lyrics.map((lyric, index) => (
            <FittedSingleLineText
              className="preview-lyric-line"
              fontSize={10}
              key={`${measure.id}-${index}`}
              text={lyric}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function ScorePaper({ page, pageNumber }: { page: ScorePage; pageNumber: number }) {
  return (
    <article className="preview-paper" aria-label={`${page.title}六线谱纸张`}>
      <header className="preview-paper-heading">
        <div>
          <span>GUITAR TAB</span>
          <h3>{page.title}</h3>
          {page.subtitle && <p className="preview-paper-subtitle">{page.subtitle}</p>}
        </div>
        <small>{String(pageNumber).padStart(2, '0')}</small>
      </header>
      <div className="preview-measures">
        {page.measures.map((measure) => (
          <PaperMeasure
            key={measure.id}
            measure={measure}
            chordDisplay={page.chordDisplay ?? DEFAULT_CHORD_DISPLAY}
          />
        ))}
      </div>
      <footer className="preview-score-footer">
        <span>{page.footerLeft}</span>
        <span>{page.footerRight}</span>
      </footer>
    </article>
  )
}

function ImagePaper({ page, pageNumber }: { page: ImagePage; pageNumber: number }) {
  return (
    <article className="preview-paper preview-image-paper">
      <header className="preview-paper-heading">
        <div><span>REFERENCE</span><h3>{page.title}</h3></div>
        <small>{String(pageNumber).padStart(2, '0')}</small>
      </header>
      <div className="preview-image-frame">
        <img src={page.image.url} alt={page.title} draggable={false} />
      </div>
      <footer>弦间 · Image reference</footer>
    </article>
  )
}

/**
 * 按纸张版式渲染谱本中的任意一页。
 *
 * 纸张预览与全屏阅读共用同一套渲染，保证两种视图的版式一致。
 *
 * @param props.page 当前页面。
 * @param props.pageNumber 从 1 开始的页码。
 */
export function PaperPage({ page, pageNumber }: { page: ScoreBookPage; pageNumber: number }) {
  return page.type === 'score'
    ? <ScorePaper page={page} pageNumber={pageNumber} />
    : <ImagePaper page={page} pageNumber={pageNumber} />
}
