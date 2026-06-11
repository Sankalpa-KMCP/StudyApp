interface ChartSummaryProps {
  children: string
}

export function ChartSummary({ children }: ChartSummaryProps) {
  return <p className="sr-only">{children}</p>
}
