export function calculateSM2(q: number, prevRep = 0, prevEF = 2.5, prevInterval = 0) {
  const quality = Number.isFinite(q) ? Math.max(0, Math.min(5, q)) : 0
  let repetitionCount = prevRep
  let intervalDays: number

  if (quality >= 3) {
    if (repetitionCount === 0) {
      intervalDays = 1
    } else if (repetitionCount === 1) {
      intervalDays = 6
    } else {
      intervalDays = Math.round(prevInterval * prevEF)
    }
    repetitionCount++
  } else {
    repetitionCount = 0
    intervalDays = 1
  }

  let easinessFactor = prevEF + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
  if (easinessFactor < 1.3) easinessFactor = 1.3

  return { repetitionCount, easinessFactor, intervalDays }
}
