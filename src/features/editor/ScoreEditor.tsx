import { useState } from 'react'

import { useScoreStore } from '../../app/use-score-store'
import { DialogShell } from '../../components/DialogShell'
import { FittedSingleLineText } from '../../components/FittedSingleLineText'
import type {
  FretValue,
  ScorePage,
} from '../../domain/score/score-document'
import { ChordDialog } from './ChordDialog'

interface SelectedCell {
  measureId: string
  positionId: string
  stringNumber: number
}

interface SelectedChord {
  measureId: string
  positionId: string
}

interface SelectedLyric {
  measureId: string
  index: number
  text: string
}

const fretChoices: FretValue[] = ['X', ...Array.from({ length: 25 }, (_, fret) => fret)]

export function ScoreEditor({ page }: { page: ScorePage }) {
  const updateFret = useScoreStore((state) => state.updateFret)
  const updateChord = useScoreStore((state) => state.updateChord)
  const updateBarline = useScoreStore((state) => state.updateBarline)
  const updateLyricLine = useScoreStore((state) => state.updateLyricLine)
  const [selectedCell, setSelectedCell] = useState<SelectedCell | null>(null)
  const [cellDialogTab, setCellDialogTab] = useState<'fret' | 'function'>('fret')
  const [selectedChord, setSelectedChord] = useState<SelectedChord | null>(null)
  const [selectedLyric, setSelectedLyric] = useState<SelectedLyric | null>(null)
  const [lyricDraft, setLyricDraft] = useState('')

  const openCellDialog = (cell: SelectedCell) => {
    setCellDialogTab('fret')
    setSelectedCell(cell)
  }

  const chooseFret = (fret: FretValue | null) => {
    if (!selectedCell) return
    updateFret(
      selectedCell.measureId,
      selectedCell.positionId,
      selectedCell.stringNumber,
      fret,
    )
    setSelectedCell(null)
  }

  const chooseBarline = (barline: 'single' | null) => {
    if (!selectedCell) return
    updateBarline(selectedCell.measureId, selectedCell.positionId, barline)
    setSelectedCell(null)
  }

  const openLyricDialog = (lyric: SelectedLyric) => {
    setLyricDraft(lyric.text)
    setSelectedLyric(lyric)
  }

  const saveLyric = () => {
    if (!selectedLyric || !lyricDraft.trim()) return
    updateLyricLine(selectedLyric.measureId, selectedLyric.index, lyricDraft)
    setSelectedLyric(null)
  }

  const clearLyric = () => {
    if (!selectedLyric || !selectedLyric.text) return
    updateLyricLine(selectedLyric.measureId, selectedLyric.index, null)
    setSelectedLyric(null)
  }

  return (
    <section className="score-editor" aria-label={`${page.title}六线谱编辑器`}>
      <header className="score-intro">
        <div>
          <p>GUITAR TAB</p>
          <h1>{page.title}</h1>
          <span>标准调弦 E A D G B E</span>
        </div>
      </header>

      <div className="score-systems">
        {page.measures.map((measure, measureIndex) => {
          const staffWidth = measure.positions.length * 100
          const gridColumns = `repeat(${measure.positions.length}, minmax(0, 1fr))`

          return (
            <article
              className="score-system"
              key={measure.id}
              aria-label={`第 ${measureIndex + 1} 行六线谱`}
            >
              <div
                className="chord-row"
                aria-label={`第 ${measureIndex + 1} 行和弦`}
                style={{ gridTemplateColumns: gridColumns }}
              >
                {measure.positions.map((position, positionIndex) => (
                  <button
                    className={position.chord ? 'has-chord' : ''}
                    key={position.id}
                    aria-label={position.chord
                      ? `第 ${measureIndex + 1} 小节，第 ${positionIndex + 1} 列，和弦 ${position.chord}`
                      : '添加和弦'}
                    onClick={() => setSelectedChord({ measureId: measure.id, positionId: position.id })}
                  >
                    {position.chord ?? <span className="chord-hint" aria-hidden="true">点击新增和弦</span>}
                  </button>
                ))}
              </div>
              <div className="staff-wrap">
                <svg
                  className="staff-lines"
                  viewBox={`0 0 ${staffWidth} 168`}
                  preserveAspectRatio="none"
                  aria-hidden="true"
                >
                  {Array.from({ length: 6 }, (_, index) => (
                    <line key={index} x1="0" x2={staffWidth} y1={14 + index * 28} y2={14 + index * 28} />
                  ))}
                  <line className="edge-line" x1="0" x2="0" y1="14" y2="154" />
                  <line className="edge-line" x1={staffWidth} x2={staffWidth} y1="14" y2="154" />
                </svg>
                <div
                  className="function-mark-grid"
                  style={{ gridTemplateColumns: gridColumns }}
                >
                  {measure.positions.map((position, positionIndex) => (
                    <span key={position.id}>
                      {position.barline === 'single' && (
                        <i
                          className="single-barline"
                          role="img"
                          aria-label={`第 ${measureIndex + 1} 行第 ${positionIndex + 1} 列单竖线`}
                        />
                      )}
                    </span>
                  ))}
                </div>
                <div
                  className="note-grid"
                  style={{ gridTemplateColumns: gridColumns }}
                >
                  {Array.from({ length: 6 }, (_, stringIndex) => {
                    const stringNumber = stringIndex + 1
                    return measure.positions.map((position, positionIndex) => {
                      const note = position.notes.find((candidate) => candidate.string === stringNumber)
                      const label = note ? `${note.fret} 品` : '空白'
                      return (
                        <button
                          key={`${position.id}-${stringNumber}`}
                          className={note ? 'has-note' : ''}
                          aria-label={`第 ${measureIndex + 1} 小节，第 ${positionIndex + 1} 列，${stringNumber} 弦，${label}`}
                          onClick={() => openCellDialog({
                            measureId: measure.id,
                            positionId: position.id,
                            stringNumber,
                          })}
                        >
                          {note && <span className="note-value">{note.fret}</span>}
                        </button>
                      )
                    })
                  })}
                </div>
              </div>

              <div className="lyrics-area" aria-label={`第 ${measureIndex + 1} 行歌词`}>
                {measure.lyrics.map((lyric, lyricIndex) => (
                  <button
                    className="lyric-line"
                    key={`${measure.id}-${lyricIndex}`}
                    aria-label={`编辑歌词 ${lyric}`}
                    onClick={() => openLyricDialog({
                      measureId: measure.id,
                      index: lyricIndex,
                      text: lyric,
                    })}
                  >
                    <FittedSingleLineText
                      text={lyric}
                      fontSize={16}
                    />
                  </button>
                ))}
                {measure.lyrics.length < 12 && (
                  <button
                    className="add-lyric-line"
                    aria-label={measure.lyrics.length ? '新增一行歌词' : '输入歌词'}
                    onClick={() => openLyricDialog({
                      measureId: measure.id,
                      index: measure.lyrics.length,
                      text: '',
                    })}
                  >
                    {measure.lyrics.length ? '新增一行歌词' : '输入歌词'}
                  </button>
                )}
              </div>
            </article>
          )
        })}
      </div>
      <footer className="score-page-footer">
        <span>弦间</span>
        <small>点击谱线填写品位，点击上方空白填写和弦</small>
      </footer>

      <DialogShell
        open={selectedCell !== null}
        onOpenChange={(open) => !open && setSelectedCell(null)}
        title={selectedCell ? `第 ${selectedCell.stringNumber} 弦` : '编辑音符位置'}
        description="填写品位，或在当前位置添加功能记号。"
      >
        <div className="cell-editor-tabs" role="tablist" aria-label="音符位置编辑类型">
          <button
            id="cell-fret-tab"
            role="tab"
            aria-selected={cellDialogTab === 'fret'}
            aria-controls="cell-fret-panel"
            onClick={() => setCellDialogTab('fret')}
          >
            品位
          </button>
          <button
            id="cell-function-tab"
            role="tab"
            aria-selected={cellDialogTab === 'function'}
            aria-controls="cell-function-panel"
            onClick={() => setCellDialogTab('function')}
          >
            功能
          </button>
        </div>
        {cellDialogTab === 'fret' ? (
          <div id="cell-fret-panel" role="tabpanel" aria-labelledby="cell-fret-tab">
            <div className="fret-picker">
              {fretChoices.map((fret) => (
                <button key={fret} onClick={() => chooseFret(fret)} aria-label={fret === 'X' ? '闷音 X' : `${fret} 品`}>
                  {fret}
                </button>
              ))}
              <button className="clear-fret" onClick={() => chooseFret(null)}>清除</button>
            </div>
          </div>
        ) : (
          <div
            className="function-picker"
            id="cell-function-panel"
            role="tabpanel"
            aria-labelledby="cell-function-tab"
          >
            <button onClick={() => chooseBarline('single')} aria-label="添加单竖线">
              <span className="barline-preview" aria-hidden="true" />
              <span>单竖线</span>
            </button>
            <button className="clear-function" onClick={() => chooseBarline(null)}>清除竖线</button>
          </div>
        )}
      </DialogShell>

      <DialogShell
        open={selectedLyric !== null}
        onOpenChange={(open) => !open && setSelectedLyric(null)}
        title={selectedLyric?.text ? '编辑歌词' : '输入歌词'}
        description="歌词会完整显示在当前谱表下方。"
      >
        <form
          className="lyric-form"
          onSubmit={(event) => {
            event.preventDefault()
            saveLyric()
          }}
        >
          <label htmlFor="lyric-content">歌词内容</label>
          <textarea
            id="lyric-content"
            maxLength={300}
            rows={4}
            value={lyricDraft}
            onChange={(event) => setLyricDraft(event.target.value)}
            autoFocus
          />
          <div className="lyric-form-meta">{lyricDraft.length} / 300</div>
          <div className="lyric-form-actions">
            {selectedLyric?.text && (
              <button type="button" className="clear-lyric" onClick={clearLyric}>清除这行歌词</button>
            )}
            <button type="submit" className="primary-button" disabled={!lyricDraft.trim()}>保存歌词</button>
          </div>
        </form>
      </DialogShell>

      <ChordDialog
        open={selectedChord !== null}
        onOpenChange={(open) => !open && setSelectedChord(null)}
        onChoose={(chord) => {
          if (!selectedChord) return
          updateChord(selectedChord.measureId, selectedChord.positionId, chord)
        }}
      />
    </section>
  )
}
