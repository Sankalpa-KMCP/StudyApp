import type { CSSProperties } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

interface RetentionChartPanelProps {
  retentionData: Array<{ date: string; avgGrade: number }>
  tooltipStyle: CSSProperties
}

export function RetentionChartPanel({ retentionData, tooltipStyle }: RetentionChartPanelProps) {
  const hasRetentionData = retentionData.length > 0

  return (
    <div className="border border-white/5 bg-white/[0.02] dynamic-card p-6" aria-labelledby="analytics-retention">
      <h3 id="analytics-retention" className="text-xs font-semibold text-white/80 tracking-wider uppercase mb-5">Retention Telemetry (SM-2 Active Recall)</h3>
      {hasRetentionData ? (
        <div className="h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={retentionData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.02)" horizontal={true} vertical={false} />
              <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 600 }} />
              <YAxis domain={[0, 5]} ticks={[0, 1, 2, 3, 4, 5]} axisLine={false} tickLine={false} tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 600 }} />
              <Tooltip contentStyle={tooltipStyle} formatter={(val) => [`${val} / 5`, 'Avg Recall Score']} />
              <Line type="monotone" dataKey="avgGrade" stroke="var(--color-accent-amber)" strokeWidth={2.5} activeDot={{ r: 6 }} dot={{ strokeWidth: 2, r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="flex h-[180px] items-center justify-center flex-col gap-2 border border-dashed border-white/10 rounded-[24px] bg-black/20">
          <span className="text-2xl">📈</span>
          <p className="text-xs text-white/40 italic">Complete active recall reviews to display retention metrics.</p>
        </div>
      )}
    </div>
  )
}
