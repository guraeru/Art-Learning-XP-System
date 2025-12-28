import { useState, useEffect } from 'react'
import { BarChart3, TrendingUp, Clock, Youtube, Download } from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from 'recharts'
import {
  getXpByTechnique,
  getXpByEvaluation,
  getLearningPatterns,
  getYoutubeProgress,
  exportCSV,
  exportJSON,
} from '../services/api'
import ActivityHeatmap from '../components/ActivityHeatmap'

const COLORS = ['#0ea5e9', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#6366f1']

export default function Statistics() {
  const [techniqueData, setTechniqueData] = useState<{ labels: string[]; data: number[] } | null>(null)
  const [evaluationData, setEvaluationData] = useState<{ labels: string[]; data: number[] } | null>(null)
  const [patternsData, setPatternsData] = useState<{
    by_day: { labels: string[]; data: number[] }
    by_hour: { labels: string[]; data: number[] }
  } | null>(null)
  const [youtubeData, setYoutubeData] = useState<
    Array<{ id: number; title: string; total_xp: number; completed_count: number; total_watch_time_formatted: string }>
  >([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      getXpByTechnique(),
      getXpByEvaluation(),
      getLearningPatterns(),
      getYoutubeProgress(),
    ]).then(([techRes, evalRes, patternRes, ytRes]) => {
      setTechniqueData(techRes.data)
      setEvaluationData(evalRes.data)
      setPatternsData(patternRes.data)
      setYoutubeData(ytRes.data)
      setLoading(false)
    })
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  const techniqueChartData = techniqueData
    ? techniqueData.labels.map((label, i) => ({
        name: label,
        xp: techniqueData.data[i],
      }))
    : []

  const evaluationChartData = evaluationData
    ? evaluationData.labels.map((label, i) => ({
        name: `評価${label}`,
        value: evaluationData.data[i],
      }))
    : []

  const dayChartData = patternsData
    ? patternsData.by_day.labels.map((label, i) => ({
        name: label,
        count: patternsData.by_day.data[i],
      }))
    : []

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-br from-primary-500 to-accent-500 rounded-xl flex items-center justify-center">
            <BarChart3 className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">統計・分析</h1>
            <p className="text-gray-500 text-sm sm:text-base">学習の傾向を把握しましょう</p>
          </div>
        </div>

        {/* Export Buttons */}
        <div className="flex gap-2">
          <button
            onClick={() => exportCSV()}
            className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-xl transition-colors text-sm sm:text-base"
          >
            <Download className="w-4 h-4" />
            CSV
          </button>
          <button
            onClick={() => exportJSON()}
            className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-xl transition-colors text-sm sm:text-base"
          >
            <Download className="w-4 h-4" />
            JSON
          </button>
        </div>
      </div>

      {/* Activity Heatmap */}
      <ActivityHeatmap />

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* XP by Technique */}
        <div className="bg-white rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-6">
            <TrendingUp className="w-5 h-5 text-primary-500" />
            <h2 className="text-lg font-semibold text-gray-800">技法別XP獲得量</h2>
          </div>
          {techniqueChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={techniqueChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#fff',
                    border: 'none',
                    borderRadius: '12px',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                  }}
                />
                <Bar dataKey="xp" fill="#0ea5e9" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-gray-400">
              データがありません
            </div>
          )}
        </div>

        {/* XP by Evaluation */}
        <div className="bg-white rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-6">
            <BarChart3 className="w-5 h-5 text-purple-500" />
            <h2 className="text-lg font-semibold text-gray-800">評価別XP分布</h2>
          </div>
          {evaluationChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={evaluationChartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {evaluationChartData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#fff',
                    border: 'none',
                    borderRadius: '12px',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-gray-400">
              データがありません
            </div>
          )}
          {/* Legend */}
          <div className="flex flex-wrap justify-center gap-4 mt-4">
            {evaluationChartData.map((entry, index) => (
              <div key={entry.name} className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: COLORS[index % COLORS.length] }}
                />
                <span className="text-sm text-gray-700 font-medium">{entry.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Learning Patterns by Day */}
        <div className="bg-white rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-6">
            <Clock className="w-5 h-5 text-green-500" />
            <h2 className="text-lg font-semibold text-gray-800">曜日別学習パターン</h2>
          </div>
          {dayChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={dayChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#fff',
                    border: 'none',
                    borderRadius: '12px',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke="#10b981"
                  strokeWidth={3}
                  dot={{ fill: '#10b981', strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-gray-400">
              データがありません
            </div>
          )}
        </div>

        {/* YouTube Progress */}
        <div className="bg-white rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-6">
            <Youtube className="w-5 h-5 text-red-500" />
            <h2 className="text-lg font-semibold text-gray-800">YouTube学習進捗</h2>
          </div>
          {youtubeData.length > 0 ? (
            <div className="space-y-4 max-h-[300px] overflow-auto">
              {youtubeData.map((playlist) => (
                <div
                  key={playlist.id}
                  className="p-4 bg-gray-50 rounded-xl"
                >
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-medium text-gray-800 text-sm truncate flex-1">
                      {playlist.title}
                    </h3>
                    <span className="text-primary-600 font-semibold text-sm ml-2">
                      +{playlist.total_xp.toLocaleString()} XP
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span>{playlist.completed_count} 動画完了</span>
                    <span>{playlist.total_watch_time_formatted}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-gray-400">
              プレイリストがありません
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
