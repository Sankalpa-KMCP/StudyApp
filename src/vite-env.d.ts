/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_E2E_SYNC?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
