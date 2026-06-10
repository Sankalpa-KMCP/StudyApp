import { useCallback, useState, type ReactNode } from 'react'
import { ConfirmDialog } from '../components/shared/ConfirmDialog'
import { ConfirmContext, type ConfirmContextValue } from './useConfirm'

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<{
    title: string
    message: string
    confirmLabel?: string
    danger?: boolean
    resolve: (v: boolean) => void
  } | null>(null)

  const requestConfirm = useCallback<ConfirmContextValue['requestConfirm']>(options => {
    return new Promise<boolean>(resolve => {
      setPending({ ...options, resolve })
    })
  }, [])

  const close = (result: boolean) => {
    pending?.resolve(result)
    setPending(null)
  }

  return (
    <ConfirmContext.Provider value={{ requestConfirm }}>
      {children}
      <ConfirmDialog
        open={!!pending}
        title={pending?.title ?? ''}
        message={pending?.message ?? ''}
        confirmLabel={pending?.confirmLabel}
        danger={pending?.danger}
        onConfirm={() => close(true)}
        onCancel={() => close(false)}
      />
    </ConfirmContext.Provider>
  )
}
