const isDev = import.meta.env.DEV

export function devLog(scope: string, event: string, detail?: unknown) {
  if (!isDev) return
  if (detail !== undefined) {
    console.info(`[${scope}] ${event}`, detail)
  } else {
    console.info(`[${scope}] ${event}`)
  }
}
