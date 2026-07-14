import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import './i18n'
import App from './App.tsx'
import { installTestSyncAdapter, isE2eSyncMode } from './lib/sync/testSyncAdapter'

if (isE2eSyncMode()) {
  installTestSyncAdapter()
}

registerSW({ immediate: true })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
