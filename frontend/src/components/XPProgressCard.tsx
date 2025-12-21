import type { UserStatus } from '../types'
import { Sparkles, Target, TrendingUp } from 'lucide-react'

interface Props {
  status: UserStatus
}

export default function XPProgressCard({ status }: Props) {
  const progressPercent = Math.min(
    100,
    ((status.total_xp - status.xp_start_of_current_level) /
      (status.next_xp_goal - status.xp_start_of_current_level)) *
      100
  )

  return (
    <div className="bg-gradient-to-br from-blue-600 via-blue-700 to-purple-700 rounded-3xl p-6 text-white shadow-xl shadow-blue-400/30">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        {/* Left: Rank & Title */}
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 bg-white/30 backdrop-blur rounded-2xl flex items-center justify-center">
            <span className="text-4xl font-bold">{status.rank}</span>
          </div>
          <div>
            <p className="text-blue-100 text-sm font-medium">現在のランク</p>
            <h2 className="text-xl font-bold text-white">{status.title}</h2>
            <p className="text-blue-200 text-sm mt-1">{status.username}</p>
          </div>
        </div>

        {/* Right: XP Details */}
        <div className="flex-1 md:max-w-md">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5" />
              <span className="font-semibold text-white">{status.total_xp.toLocaleString()} XP</span>
            </div>
            <div className="flex items-center gap-2 text-blue-100">
              <Target className="w-4 h-4" />
              <span className="text-sm font-medium">{status.next_xp_goal.toLocaleString()} XP</span>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="relative h-4 bg-white/30 rounded-full overflow-hidden mb-2">
            <div
              className="absolute h-full bg-yellow-300 rounded-full xp-bar-animate transition-all duration-1000 shadow-lg shadow-yellow-400/50"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-blue-100 font-medium">
              <TrendingUp className="w-4 h-4 inline mr-1" />
              進捗 {progressPercent.toFixed(1)}%
            </span>
            <span className="text-blue-100 font-medium">
              あと {status.xp_to_next_rank.toLocaleString()} XP で次のランク
            </span>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-white/30">
        <div className="text-center">
          <p className="text-2xl font-bold text-white">{status.total_time_hours}</p>
          <p className="text-blue-100 text-sm font-medium">総学習時間</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-white">{status.total_time_minutes % 60}</p>
          <p className="text-blue-100 text-sm font-medium">分</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-white">{Math.floor(progressPercent)}%</p>
          <p className="text-blue-100 text-sm font-medium">レベル進捗</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-white">{status.rank}</p>
          <p className="text-blue-100 text-sm font-medium">現在ランク</p>
        </div>
      </div>
    </div>
  )
}
