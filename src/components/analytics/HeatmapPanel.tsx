import { useMemo } from 'react'
import { hexToRgb } from '../../lib/studyDashboard'

interface HeatmapDay {
  dateStr: string
  minutes: number
}

interface HeatmapPanelProps {
  heatmapData: HeatmapDay[]
  accentBlue: string
}

export function HeatmapPanel({ heatmapData, accentBlue }: HeatmapPanelProps) {
  const rgbStr = useMemo(() => {
    const rgb = hexToRgb(accentBlue) || { r: 59, g: 130, b: 246 }
    return `${rgb.r}, ${rgb.g}, ${rgb.b}`
  }, [accentBlue])

  return (
    <div className="border border-white/5 bg-white/[0.02] dynamic-card p-6 flex flex-col gap-5" aria-labelledby="analytics-heatmap">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <h3 id="analytics-heatmap" className="text-xs font-semibold text-white/85 tracking-wider uppercase">Yearly Focus Horizon (365 Days)</h3>
        <div className="flex items-center gap-1.5 text-[10px] text-white/40 font-semibold select-none">
          <span>Less</span>
          <div className="h-2.5 w-2.5 rounded-[2px] bg-white/5" />
          <div className="h-2.5 w-2.5 rounded-[2px]" style={{ backgroundColor: `rgba(${rgbStr}, 0.20)` }} />
          <div className="h-2.5 w-2.5 rounded-[2px]" style={{ backgroundColor: `rgba(${rgbStr}, 0.45)` }} />
          <div className="h-2.5 w-2.5 rounded-[2px]" style={{ backgroundColor: `rgba(${rgbStr}, 0.70)` }} />
          <div className="h-2.5 w-2.5 rounded-[2px]" style={{ backgroundColor: `rgba(${rgbStr}, 1.00)` }} />
          <span>More</span>
        </div>
      </div>

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
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:flex flex-col w-32 bg-[#161620]/95 backdrop-blur-xl border border-white/10 p-2 rounded-[12px] text-[8px] font-mono text-left pointer-events-none z-30 shadow-[0_8px_32px_rgba(0,0,0,0.35)] leading-normal">
                <div className="font-bold text-white mb-0.5 border-b border-white/10 pb-0.5">{day.dateStr}</div>
                <div className="text-white/80">⏱️ Study: {day.minutes}m</div>
                <div className="text-accent-blue font-bold mt-0.5">
                  Intensity: {day.minutes < 60 ? 'Low' : day.minutes < 120 ? 'Med' : day.minutes < 180 ? 'High' : 'Epic'}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
