import { DialogShell } from './DialogShell'

interface EditorGuideDialogProps {
  open: boolean
  onClose: () => void
}

export function EditorGuideDialog({ open, onClose }: EditorGuideDialogProps) {
  return (
    <DialogShell
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose()
      }}
      title="先熟悉一下编辑器"
      description="第一次进入六线谱页面，这些操作可以帮你快速开始。"
      showClose={false}
      dismissible={false}
      footer={(
        <div className="dialog-footer-actions">
          <button className="primary-button" type="button" onClick={onClose}>
            知道了
          </button>
        </div>
      )}
    >
      <div className="editor-guide">
        <p className="editor-guide-lead">写谱时常用的操作都在这几处：</p>
        <ol>
          <li><strong>写音符</strong>：点击六线谱上的弦线，选择 X 或 0–6 品。</li>
          <li><strong>写和弦</strong>：点击每列上方的空白处，选择或输入和弦。</li>
          <li><strong>加符号</strong>：符号菜单里可以添加琶音、扫弦、延音线、击弦 H 和勾弦 P；点击已绘制符号可以清除。</li>
          <li><strong>编辑菜单</strong>：可以撤回、重做、选择节点、拖拽框选、复制音符和修改页面信息。</li>
          <li><strong>页面与预览</strong>：右上角「目录」切换或新增页面，顶部「预览」查看整本谱。</li>
          <li><strong>文件</strong>：在「文件」菜单导出当前页或当前谱本 JSON；底部左右文字可在「编辑信息」中修改。</li>
        </ol>
        <p className="editor-guide-note">这份提示只会在第一次进入编辑器时出现。</p>
      </div>
    </DialogShell>
  )
}