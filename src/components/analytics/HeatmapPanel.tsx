import { memo, useMemo } from 'react'
import { hexToRgb } from '../../lib/study/studyDashboard'
import { PanelCard } from '../shared/PanelCard'
import { PanelHeader } from '../shared/PanelHeader'
import { EmptyState } from '../shared/EmptyState'
import { getHeatmapIntensityLabel } from '../../lib/study/analyticsChartData'
import { useTranslation } from '../../i18n/useTranslation'

interface HeatmapDay {
  dateStr: string
  minutes: number
}

interface HeatmapPanelProps {
  heatmapData: HeatmapDay[]
  accentBlue: string
  className?: string
  suppressEmptyState?: boolean
}

export const HeatmapPanel = memo(function HeatmapPanel({ heatmapData, accentBlue, className = '', suppressEmptyState = false }: HeatmapPanelProps) {
  const { t } = useTranslation()
  const rgbStr = useMemo(() => {
    const rgb = hexToRgb(accentBlue) || { r: 59, g: 130, b: 246 }
    return `${rgb.r}, ${rgb.g}, ${rgb.b}`
  }, [accentBlue])

  const totalStudyMinutes = useMemo(
    () => heatmapData.reduce((sum, day) => sum + day.minutes, 0),
    [heatmapData],
  )

  return (
    <PanelCard className={`flex flex-col gap-5 ${className}`.trim()} aria-labelledby="analytics-heatmap">
      <PanelHeader
        title={t('analyticsYearlyFocus')}
        bordered={false}
        className="mb-0"
        id="analytics-heatmap"
        action={
          <div className="flex items-center gap-1.5 text-micro text-muted font-semibold select-none">
            <span>{t('analyticsHeatmapLess')}</span>
            <div className="h-2.5 w-2.5 rounded-[2px] surface-subtle" />
            <div className="h-2.5 w-2.5 rounded-[2px]" style={{ backgroundColor: `rgba(${rgbStr}, 0.20)` }} />
            <div className="h-2.5 w-2.5 rounded-[2px]" style={{ backgroundColor: `rgba(${rgbStr}, 0.45)` }} />
            <div className="h-2.5 w-2.5 rounded-[2px]" style={{ backgroundColor: `rgba(${rgbStr}, 0.70)` }} />
            <div className="h-2.5 w-2.5 rounded-[2px]" style={{ backgroundColor: `rgba(${rgbStr}, 1.00)` }} />
            <span>{t('analyticsHeatmapMore')}</span>
          </div>
        }
      />

      {totalStudyMinutes === 0 ? (
        suppressEmptyState ? null : (
        <EmptyState
          title={t('analyticsNoHistoryTitle')}
          description={t('analyticsNoHistoryDesc')}
        />
        )
      ) : (
      <div className="relative w-full overflow-x-auto custom-scrollbar p-2 surface-subtle border border-card rounded-2xl">
        <div className="grid grid-flow-col grid-rows-7 gap-1 min-w-[650px] justify-start">
          {heatmapData.map(day => (
            <button
              key={day.dateStr}
              type="button"
              aria-label={t('analyticsHeatmapDayAria', { date: day.dateStr, minutes: day.minutes })}
              title={`${day.dateStr}: ${day.minutes}m`}
              className="focus-ring w-2.5 h-2.5 rounded-[2px] cursor-pointer transition-transform hover:scale-125 relative group"
              style={{
                backgroundColor: day.minutes === 0
                  ? 'color-mix(in srgb, var(--color-text-primary) 3%, transparent)'
                  : day.minutes < 60
                  ? `rgba(${rgbStr}, 0.20)`
                  : day.minutes < 120
                  ? `rgba(${rgbStr}, 0.45)`
                  : day.minutes < 180
                  ? `rgba(${rgbStr}, 0.70)`
                  : `rgba(${rgbStr}, 1.00)`,
              }}
            >
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:flex group-focus-within:flex flex-col w-32 surface-overlay border border-card p-2 rounded-2xl text-micro font-mono text-left pointer-events-none z-30 leading-normal" style={{ boxShadow: 'var(--shadow-elevated)' }}>
                <div className="font-bold text-primary mb-0.5 border-b border-card pb-0.5">{day.dateStr}</div>
                <div className="text-secondary">{t('analyticsHeatmapStudy', { minutes: day.minutes })}</div>
                <div className="text-accent-blue font-bold mt-0.5">
                  {t('analyticsHeatmapIntensity', { level: getHeatmapIntensityLabel(day.minutes) })}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
      )}
    </PanelCard>
  )
})
