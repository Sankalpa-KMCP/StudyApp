export function elapsedFromAnchor(anchorWallMs: number, anchorElapsed: number): number {
  return anchorElapsed + Math.floor((Date.now() - anchorWallMs) / 1000)
}

export function createAnchorState(elapsed: number) {
  return { wallMs: Date.now(), elapsed }
}
