import { useMemo } from 'react'
import { hexToRgb } from '../../lib/studyDashboard'

export function useLedgerIntensityStyles(accentBlue: string) {
  return useMemo(() => {
    const accentBlueRgb = hexToRgb(accentBlue) || { r: 56, g: 189, b: 248 }
    const accentBlueRgbStr = `${accentBlueRgb.r}, ${accentBlueRgb.g}, ${accentBlueRgb.b}`

    const getIntensityStyle = (intensity: 0 | 1 | 2 | 3) => {
      if (intensity === 0) return { backgroundColor: 'rgba(255, 255, 255, 0.03)' }
      const opacity = intensity === 1 ? '0.25' : intensity === 2 ? '0.6' : '1.0'
      return {
        backgroundColor: `rgba(${accentBlueRgbStr}, ${opacity})`,
        color: intensity === 3 ? '#080b11' : '#ffffff',
      }
    }

    const getLegendStyle = (intensity: 0 | 1 | 2 | 3) => {
      if (intensity === 0) return { backgroundColor: 'rgba(255, 255, 255, 0.03)' }
      const opacity = intensity === 1 ? '0.25' : intensity === 2 ? '0.6' : '1.0'
      return { backgroundColor: `rgba(${accentBlueRgbStr}, ${opacity})` }
    }

    return { getIntensityStyle, getLegendStyle }
  }, [accentBlue])
}
