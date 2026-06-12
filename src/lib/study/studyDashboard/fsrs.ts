/** Simplified FSRS-4.5 scheduling for spaced repetition. */

const DECAY = -0.5
const FACTOR = 19 / 81

function forgettingCurve(elapsedDays: number, stability: number): number {
  if (stability <= 0) return 0
  return Math.pow(1 + FACTOR * elapsedDays / stability, DECAY)
}

function nextInterval(stability: number, requestRetention = 0.9): number {
  const interval = (stability / FACTOR) * (Math.pow(requestRetention, 1 / DECAY) - 1)
  return Math.max(1, Math.round(interval))
}

export interface FsrsState {
  stability: number
  difficulty: number
  elapsedDays: number
  repetitionCount: number
}

export interface FsrsGradeResult {
  repetitionCount: number
  easinessFactor: number
  intervalDays: number
  stability: number
  difficulty: number
  elapsedDays: number
}

export function calculateFSRS(
  grade: number,
  prev: Partial<FsrsState> = {},
  initialEasinessFactor = 2.5,
): FsrsGradeResult {
  const q = Math.max(0, Math.min(5, grade))
  let stability = prev.stability ?? initialEasinessFactor
  let difficulty = prev.difficulty ?? 5
  let repetitionCount = prev.repetitionCount ?? 0
  const elapsedDays = prev.elapsedDays ?? 0

  if (q < 3) {
    repetitionCount = 0
    stability = Math.max(0.5, stability * 0.5)
    difficulty = Math.min(10, difficulty + 1)
    return {
      repetitionCount,
      easinessFactor: stability,
      intervalDays: 1,
      stability,
      difficulty,
      elapsedDays: 0,
    }
  }

  if (repetitionCount === 0) {
    stability = 1 + (q - 3) * 0.5
    difficulty = Math.max(1, difficulty - 0.2)
    repetitionCount = 1
    return {
      repetitionCount,
      easinessFactor: stability,
      intervalDays: 1,
      stability,
      difficulty,
      elapsedDays: 0,
    }
  }

  const retrievability = forgettingCurve(elapsedDays, stability)
  const gradeFactor = 1 + (q - 3) * 0.15
  stability = stability * (1 + gradeFactor * (1 - retrievability))
  difficulty = Math.max(1, Math.min(10, difficulty - (q - 3) * 0.1))
  repetitionCount += 1
  const intervalDays = nextInterval(stability)

  return {
    repetitionCount,
    easinessFactor: stability,
    intervalDays,
    stability,
    difficulty,
    elapsedDays: 0,
  }
}
