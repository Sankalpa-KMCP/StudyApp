export function E2eCrashProbe() {
  if (import.meta.env.DEV && new URLSearchParams(window.location.search).get('e2e_force_error') === '1') {
    throw new Error('E2E forced error')
  }
  return null
}
