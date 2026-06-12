import { useMemo } from 'react'
import { hexToRgb } from '../../lib/study/studyDashboard'
import { PanelCard } from '../shared/PanelCard'
import { PanelHeader } from '../shared/PanelHeader'
import { EmptyState } from '../shared/EmptyState'

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

export function HeatmapPanel({ heatmapData, accentBlue, className = '', suppressEmptyState = false }: HeatmapPanelProps) {
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
        title="Yearly focus horizon"
        bordered={false}
        className="mb-0"
        id="analytics-heatmap"
        action={
          <div className="flex items-center gap-1.5 text-micro text-white/40 font-semibold select-none">
            <span>Less</span>
            <div className="h-2.5 w-2.5 rounded-[2px] bg-white/5" />
            <div className="h-2.5 w-2.5 rounded-[2px]" style={{ backgroundColor: `rgba(${rgbStr}, 0.20)` }} />
            <div className="h-2.5 w-2.5 rounded-[2px]" style={{ backgroundColor: `rgba(${rgbStr}, 0.45)` }} />
            <div className="h-2.5 w-2.5 rounded-[2px]" style={{ backgroundColor: `rgba(${rgbStr}, 0.70)` }} />
            <div className="h-2.5 w-2.5 rounded-[2px]" style={{ backgroundColor: `rgba(${rgbStr}, 1.00)` }} />
            <span>More</span>
          </div>
        }
      />

      {totalStudyMinutes === 0 ? (
        suppressEmptyState ? null : (
        <EmptyState
          title="No study history yet"
          description="Complete a focus block to fill your year map."
        />
        )
      ) : (
      <div className="relative w-full overflow-x-auto custom-scrollbar p-2 bg-black/20 border border-white/5 rounded-2xl">
        <div className="grid grid-flow-col grid-rows-7 gap-1 min-w-[650px] justify-start">
          {heatmapData.map(day => (
            <div
              key={day.dateStr}
              role="img"
              aria-label={`${day.dateStr}: ${day.minutes} minutes studied`}
              title={`${day.dateStr}: ${day.minutes}m`}
              className="w-2.5 h-2.5 rounded-[2px] cursor-pointer transition-transform hover:scale-125 relative group"
              style={{
                backgroundColor: day.minutes === 0
                  ? 'rgba(255, 255, 255, 0.03)'
                  : day.minutes < 60
                  ? `rgba(${rgbStr}, 0.20)`
                  : day.minutes < 120
                  ? `rgba(${rgbStr}, 0.45)`
                  : day.minutes < 180
                  ? `rgba(${rgbStr}, 0.70)`
                  : `rgba(${rgbStr}, 1.00)`,
              }}
            >
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:flex flex-col w-32 surface-overlay border border-white/10 p-2 rounded-[12px] text-micro font-mono text-left pointer-events-none z-30 shadow-[0_8px_32px_rgba(0,0,0,0.35)] leading-normal">
                <div className="font-bold text-white mb-0.5 border-b border-white/10 pb-0.5">{day.dateStr}</div>
                <div className="text-white/80">Study: {day.minutes}m</div>
                <div className="text-accent-blue font-bold mt-0.5">
                  Intensity: {day.minutes < 60 ? 'Low' : day.minutes < 120 ? 'Med' : day.minutes < 180 ? 'High' : 'Epic'}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      )}
    </PanelCard>
  )
}
