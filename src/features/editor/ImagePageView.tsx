import { FileImage } from '../../components/icons'

import type { ImagePage } from '../../domain/score/score-document'

/**
 * 图片参考页面视图。
 *
 * @param props 当前图片页面与所属谱本名称。
 */
export function ImagePageView({ page, bookTitle }: { page: ImagePage; bookTitle: string }) {
  return (
    <section className="image-page" aria-label={`${page.title}图片页面`}>
      <header>
        <p>图片参考</p>
        <h1>{bookTitle}</h1>
        <div className="image-page-meta">
          <span className="image-page-page">{page.title}</span>
        </div>
        <span className="image-page-source"><FileImage size={16} /> 图片 URL 引用</span>
      </header>
      <div className="image-page-paper">
        <span aria-hidden="true">{page.title}</span>
        <img src={page.image.url} alt={page.title} />
      </div>
    </section>
  )
}
