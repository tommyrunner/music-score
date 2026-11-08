import { DialogShell } from './DialogShell'

interface EditorGuideDialogProps {
  open: boolean
  onClose: () => void
}

/**
 * 首次进入编辑器时显示的操作说明弹框。
 *
 * @param props 弹框开关状态与关闭回调。
 */
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
          <li><strong>快捷填写</strong>：点击右下角闪电图标开启后，数字 0–6 填写音级，X 填写闷音，L 填写或取消单竖线，D 打开当前列的单节多音，↑↓ 切换上下弦，Delete / 退格删除上一个节点；填完自动跳到下一个空白节点，点任意格子可以重新指定位置。快捷键固定为这些，不支持自定义。</li>
          <li><strong>写和弦</strong>：点击每列上方的空白处，选择或输入和弦。</li>
          <li><strong>写歌词</strong>：直接点击谱表下方的歌词行就地编辑，失去焦点自动保存；清空内容会删除该行。</li>
          <li><strong>加符号</strong>：符号菜单里可以添加琶音、扫弦、延音线、击弦 H 和勾弦 P；点击已绘制符号可以清除。</li>
          <li><strong>编辑菜单</strong>：可以撤回、重做、复制或清除选中的音符、修改页面信息；节点多选和拖拽框选在右下角快捷菜单里，右键音符节点可以粘贴或清除。</li>
          <li><strong>页面与预览</strong>：右上角「目录」切换或新增页面，顶部「预览」查看整本谱。</li>
          <li><strong>文件</strong>：在「文件」菜单导出当前页或当前谱本 JSON；底部左右文字可在「编辑信息」中修改。</li>
        </ol>
        <p className="editor-guide-note">这份提示只会在第一次进入编辑器时出现。</p>
      </div>
    </DialogShell>
  )
}