import { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { getActivityHeatmap } from '../services/api'

interface HeatmapData {
  date: string
  xp: number
  times?: string
  week: number
  day: number
}

interface HeatmapResponse {
  data: HeatmapData[]
  start_date: string
  end_date: string
  total_xp: number
  days_active: number
}

interface DayCell {
  date: string
  xp: number
  times: string
  exists: boolean
}

export default function ActivityHeatmap() {
  const [allHeatmapData, setAllHeatmapData] = useState<HeatmapResponse | null>(null)
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getActivityHeatmap(selectedYear)
      .then((res) => {
        setAllHeatmapData(res.data)
      })
      .catch((err) => {
        console.error('Error fetching heatmap data:', err)
      })
      .finally(() => {
        setLoading(false)
      })
  }, [selectedYear])

  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full" />
        </div>
      </div>
    )
  }

  // Create data map from API response
  const dataMap = new Map<string, { xp: number; times: string }>()
  if (allHeatmapData?.data) {
    allHeatmapData.data.forEach((d: HeatmapData) => {
      dataMap.set(d.date, { xp: d.xp, times: d.times || '' })
    })
  }

  // Generate calendar for selected year
  const generateYearCalendar = (year: number): DayCell[][] => {
    const weeks: DayCell[][] = []
    
    // Start from Jan 1st of the year
    const startDate = new Date(year, 0, 1)
    
    // First week - pad with empty cells for days before Jan 1st
    let currentWeek: DayCell[] = []
    const startDayOfWeek = startDate.getDay() // 0 = Sunday, 3 = Wednesday
    
    // Add empty cells for days before Jan 1st (these don't exist)
    for (let i = 0; i < startDayOfWeek; i++) {
      currentWeek.push({ date: '', xp: 0, times: '', exists: false })
    }
    
    // Iterate through each day of the year - only this year's dates
    const currentDate = new Date(year, 0, 1) // Ensure we start exactly at Jan 1
    currentDate.setHours(0, 0, 0, 0) // Remove time portion
    
    while (currentDate.getFullYear() === year) {
      const dateStr = currentDate.toISOString().split('T')[0]
      
      // Only include dates that are actually in this year
      if (new Date(dateStr).getFullYear() === year) {
        const data = dataMap.get(dateStr) || { xp: 0, times: '' }
        currentWeek.push({ date: dateStr, xp: data.xp, times: data.times, exists: true })
      }
      
      if (currentWeek.length === 7) {
        weeks.push(currentWeek)
        currentWeek = []
      }
      
      currentDate.setDate(currentDate.getDate() + 1)
    }
    
    // Last week - pad with empty cells for days after Dec 31st
    if (currentWeek.length > 0) {
      while (currentWeek.length < 7) {
        currentWeek.push({ date: '', xp: 0, times: '', exists: false })
      }
      weeks.push(currentWeek)
    }
    
    return weeks
  }

  const weeks = generateYearCalendar(selectedYear)

  // Calculate stats
  const yearTotalXp = weeks.flat().filter(d => d.exists).reduce((sum, d) => sum + d.xp, 0)
  const yearActiveDays = weeks.flat().filter(d => d.exists && d.xp > 0).length

  // Color function based on total minutes (converted to hours)
  const getColor = (totalMinutes: number, exists: boolean): string => {
    if (!exists) return 'invisible'
    const hours = totalMinutes / 60
    if (hours === 0) return 'bg-gray-100'
    if (hours < 1) return 'bg-green-200'
    if (hours < 2) return 'bg-green-400'
    if (hours < 3) return 'bg-green-500'
    if (hours < 4) return 'bg-green-600'
    return 'bg-green-700'
  }

  const dayLabels = ['日', '月', '火', '水', '木', '金', '土']
  const monthLabels = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-800 mb-1">アクティビティ</h2>
          <div className="flex gap-4 text-sm text-gray-600">
            <span>
              <span className="font-medium">総XP:</span>{' '}
              <span className="text-primary-600 font-semibold">{yearTotalXp.toLocaleString()}</span>
            </span>
            <span>
              <span className="font-medium">活動日数:</span>{' '}
              <span className="text-primary-600 font-semibold">{yearActiveDays}日</span>
            </span>
          </div>
        </div>

        {/* Year Navigation */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setSelectedYear(selectedYear - 1)}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
          <span className="px-3 py-1 font-semibold text-gray-800 min-w-[60px] text-center">
            {selectedYear}
          </span>
          <button
            onClick={() => setSelectedYear(selectedYear + 1)}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronRight className="w-5 h-5 text-gray-600" />
          </button>
        </div>
      </div>

      {/* Heatmap */}
      <div className="overflow-x-auto">
        <div className="inline-block">
          {/* Month labels row */}
          <div className="flex gap-1 mb-2">
            {/* Spacer matching day labels width */}
            <div className="w-6" />
            
            {/* Month labels */}
            <div className="flex gap-1">
              {monthLabels.map((month, monthIdx) => {
                // Find first week that contains this month
                const firstWeekIdx = weeks.findIndex(week => {
                  const day = week.find(d => d.exists && new Date(d.date).getMonth() === monthIdx)
                  return !!day
                })
                
                if (firstWeekIdx === -1) return null
                
                // Find last week that contains this month
                let lastWeekIdx = firstWeekIdx
                for (let i = weeks.length - 1; i >= 0; i--) {
                  const day = weeks[i].find(d => d.exists && new Date(d.date).getMonth() === monthIdx)
                  if (day) {
                    lastWeekIdx = i
                    break
                  }
                }
                
                // Calculate width based on week indices (each week is 20px: 5px width + 4px gap)
                const weekSpan = lastWeekIdx - firstWeekIdx + 1
                const width = weekSpan * 20 - 4 // Remove gap from last week
                
                return (
                  <div key={monthIdx} style={{ width: `${width}px` }} className="text-xs text-gray-500 font-medium flex items-center">
                    {month}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Grid */}
          <div className="flex gap-1">
            {/* Day labels */}
            <div className="flex flex-col gap-px">
              {dayLabels.map((label) => (
                <div
                  key={label}
                  className="h-5 w-6 text-xs text-gray-500 font-medium flex items-center justify-center"
                >
                  {label}
                </div>
              ))}
            </div>

            {/* Cells */}
            <div className="flex gap-1">
              {weeks.map((week, weekIdx) => (
                <div key={weekIdx} className="flex flex-col gap-px">
                  {week.map((day, dayIdx) => {
                    // Convert total minutes to hours and minutes format
                    const totalMinutes = typeof day.times === 'string' ? parseInt(day.times) || 0 : (day.times as number)
                    const hours = Math.floor(totalMinutes / 60)
                    const minutes = totalMinutes % 60
                    const timeDisplay = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`
                    const tooltipText = day.exists 
                      ? `${day.date}: ${day.xp} XP\n学習時間: ${timeDisplay}`
                      : ''
                    return (
                      <div
                        key={`${weekIdx}-${dayIdx}`}
                        className={`w-5 h-5 rounded-sm ${getColor(totalMinutes, day.exists)} ${
                          day.exists ? 'hover:ring-1 hover:ring-gray-400 cursor-pointer border border-gray-200' : ''
                        }`}
                        title={tooltipText}
                      />
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-end gap-2 mt-4 text-xs">
        <span className="text-gray-500">0h</span>
        <div className="flex gap-1">
          <div className="w-3 h-3 bg-gray-100 rounded-sm" />
          <div className="w-3 h-3 bg-green-200 rounded-sm" />
          <div className="w-3 h-3 bg-green-400 rounded-sm" />
          <div className="w-3 h-3 bg-green-500 rounded-sm" />
          <div className="w-3 h-3 bg-green-600 rounded-sm" />
          <div className="w-3 h-3 bg-green-700 rounded-sm" />
        </div>
        <span className="text-gray-500">4h+</span>
      </div>
    </div>
  )
}




