import type { ComponentProps } from 'react'
import type { ToastState } from '../../types/app'
import { AppShellStatusBanners } from './AppShellStatusBanners'
import { AppToastOverlay } from './AppToastOverlay'

export type AppShellBannersProps = ComponentProps<typeof AppShellStatusBanners>

export function AppShellBanners(props: AppShellBannersProps) {
  return <AppShellStatusBanners {...props} />
}

export function AppShellToast({ toast }: { toast: ToastState | null }) {
  return <AppToastOverlay toast={toast} />
}
