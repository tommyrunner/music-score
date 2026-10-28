import type { ReactNode } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X } from '@phosphor-icons/react'

interface DialogShellProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  children: ReactNode
  footer?: ReactNode
}

export function DialogShell({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
}: DialogShellProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="dialog-panel">
          <div className="dialog-heading">
            <div>
              <Dialog.Title>{title}</Dialog.Title>
              <Dialog.Description>{description}</Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button className="icon-button" aria-label="关闭弹框">
                <X size={18} weight="bold" />
              </button>
            </Dialog.Close>
          </div>
          <div className="dialog-body">{children}</div>
          {footer && <div className="dialog-footer">{footer}</div>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
