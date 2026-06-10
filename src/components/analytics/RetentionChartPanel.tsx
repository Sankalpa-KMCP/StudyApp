import type { CSSProperties } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { PanelCard } from '../shared/PanelCard'
import { PanelHeader } from '../shared/PanelHeader'
import { EmptyState } from '../shared/EmptyState'
import { ChartSummary } from './ChartSummary'

interface RetentionChartPanelProps {
  retentionData: Array<{ date: string; avgGrade: number }>
  tooltipStyle: CSSProperties
  className?: string
}

export function RetentionChartPanel({ retentionData, tooltipStyle, className = '' }: RetentionChartPanelProps) {
  const hasRetentionData = retentionData.length > 0
  const latestGrade = hasRetentionData ? retentionData[retentionData.length - 1]?.avgGrade : 0

  return (
    <PanelCard className={className} aria-labelledby="analytics-retention">
      <PanelHeader
        title="Recall over time"
        bordered={false}
        className="mb-5"
        id="analytics-retention"
      />
      <p className="text-micro text-white/40 mb-4 -mt-2">Average recall score from card reviews</p>
      {hasRetentionData ? (
        <>
        <ChartSummary>
          {`Retention trend across ${retentionData.length} review sessions. Latest average recall score: ${latestGrade.toFixed(1)} out of 5.`}
        </ChartSummary>
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
        </>
      ) : (
        <EmptyState
          icon={<span className="text-2xl">📈</span>}
          title="No retention data yet"
          description="Complete active recall reviews to display retention metrics."
        />
      )}
    </PanelCard>
  )
}
