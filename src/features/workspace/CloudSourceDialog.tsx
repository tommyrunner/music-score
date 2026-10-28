import { useState, type FormEvent } from 'react'

import { DialogShell } from '../../components/DialogShell'
import {
  validateCloudSource,
  type CloudSource,
} from '../../data/cloud-source'

interface CloudSourceDialogProps {
  source: CloudSource | null
  onClose: () => void
  onSave: (source: CloudSource) => void
  onClear: () => void
}

export function CloudSourceDialog({
  source,
  onClose,
  onSave,
  onClear,
}: CloudSourceDialogProps) {
  const [url, setUrl] = useState(source?.url ?? '')
  const [headersText, setHeadersText] = useState(
    source?.headers ? JSON.stringify(source.headers, null, 2) : '',
  )
  const [error, setError] = useState('')

  const submit = (event: FormEvent) => {
    event.preventDefault()
    try {
      onSave(validateCloudSource(url, headersText))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '云端接口设置失败')
    }
  }

  return (
    <DialogShell
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      title="云端获取"
      description="从接口获取 ZIP 文件，并导入其中的全部谱本。"
      footer={(
        <div className="cloud-dialog-footer">
          {source && (
            <button className="text-button" type="button" onClick={onClear}>
              清除设置
            </button>
          )}
          <div className="dialog-footer-actions">
            <button className="text-button" type="button" onClick={onClose}>
              取消
            </button>
            <button
              className="primary-button"
              type="submit"
              form="cloud-source-form"
            >
              保存并获取
            </button>
          </div>
        </div>
      )}
    >
      <form id="cloud-source-form" className="dialog-form" onSubmit={submit} noValidate>
        <label htmlFor="cloud-source-url">API 地址</label>
        <input
          id="cloud-source-url"
          type="url"
          value={url}
          onChange={(event) => {
            setUrl(event.target.value)
            setError('')
          }}
          placeholder="https://example.com/stringroom.zip"
          maxLength={2000}
          autoFocus
        />

        <label htmlFor="cloud-source-headers">请求头（可选，JSON）</label>
        <textarea
          id="cloud-source-headers"
          value={headersText}
          onChange={(event) => {
            setHeadersText(event.target.value)
            setError('')
          }}
          rows={4}
          placeholder={'{\n  "Authorization": "Bearer ..."\n}'}
          spellCheck={false}
        />

        <p className="cloud-help">
          接口需要直接返回 ZIP 文件，并允许当前页面跨域访问（CORS）。
          如果填写了自定义请求头，接口还需要正确处理跨域预检请求。
          配置后，每次打开应用进入首页会自动获取一次；未设置时不会请求任何云端接口。
        </p>

        {error && <p className="form-error" role="alert">{error}</p>}
      </form>
    </DialogShell>
  )
}