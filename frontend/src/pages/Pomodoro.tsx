import { useState, useMemo } from 'react'
import {
  Clock,
  Play,
  Pause,
  RotateCcw,
  Coffee,
  Flame,
  Settings,
  Volume2,
  CheckCircle2,
  Sparkles,
  SkipForward,
  ExternalLink,
  Loader2,
  Bell,
  RefreshCw,
} from 'lucide-react'
import { usePomodoroContext, DEFAULT_TIMER_SETTINGS, type TimerSettings } from '../contexts/PomodoroContext'
import Toast from '../components/Toast'

// === Settings Card Configuration ===
interface SettingCardConfig {
  key: keyof Pick<TimerSettings, 'workDuration' | 'shortBreakDuration' | 'longBreakDuration' | 'sessionsUntilLongBreak'>
  label: string
  icon: typeof Flame
  min: number
  max: number
  unit: string
  color: {
    bg: string
    text: string
    border: string
    lightBg: string
  }
}

const SETTINGS_CARDS: SettingCardConfig[] = [
  {
    key: 'workDuration',
    label: '作業時間',
    icon: Flame,
    min: 1,
    max: 60,
    unit: '分',
    color: { bg: 'bg-red-100', text: 'text-red-600', border: 'border-red-300', lightBg: 'bg-red-50' },
  },
  {
    key: 'shortBreakDuration',
    label: '短休憩',
    icon: Coffee,
    min: 1,
    max: 30,
    unit: '分',
    color: { bg: 'bg-green-100', text: 'text-green-600', border: 'border-green-300', lightBg: 'bg-green-50' },
  },
  {
    key: 'longBreakDuration',
    label: '長休憩',
    icon: Coffee,
    min: 1,
    max: 60,
    unit: '分',
    color: { bg: 'bg-blue-100', text: 'text-blue-600', border: 'border-blue-300', lightBg: 'bg-blue-50' },
  },
  {
    key: 'sessionsUntilLongBreak',
    label: '長休憩まで',
    icon: CheckCircle2,
    min: 1,
    max: 10,
    unit: '回',
    color: { bg: 'bg-purple-100', text: 'text-purple-600', border: 'border-purple-300', lightBg: 'bg-purple-50' },
  },
]

// === Toggle Settings Configuration ===
interface ToggleSettingConfig {
  key: keyof Pick<TimerSettings, 'autoStartBreaks' | 'autoStartPomodoros' | 'showNotifications' | 'alwaysShowMiniWindow'>
  label: string
  description: string
  icon: typeof Bell
  color: string
}

const TOGGLE_SETTINGS: ToggleSettingConfig[] = [
  {
    key: 'autoStartBreaks',
    label: '休憩を自動開始',
    description: '作業完了後、自動的に休憩タイマーを開始します',
    icon: RefreshCw,
    color: 'text-green-600',
  },
  {
    key: 'autoStartPomodoros',
    label: '作業を自動開始',
    description: '休憩完了後、自動的に作業タイマーを開始します',
    icon: RefreshCw,
    color: 'text-red-600',
  },
  {
    key: 'showNotifications',
    label: '通知音',
    description: 'タイマー完了時に通知音を鳴らします',
    icon: Volume2,
    color: 'text-purple-600',
  },
  {
    key: 'alwaysShowMiniWindow',
    label: 'ミニウィンドウを常に表示',
    description: 'アプリ使用中は常にミニウィンドウを表示します',
    icon: ExternalLink,
    color: 'text-blue-600',
  },
]

// === Mode Selector Items ===
const MODE_ITEMS = [
  { mode: 'work' as const, label: '作業', icon: Flame },
  { mode: 'shortBreak' as const, label: '短休憩', icon: Coffee },
  { mode: 'longBreak' as const, label: '長休憩', icon: Coffee },
]

// === Main Component ===
export default function Pomodoro() {
  const {
    status,
    isLoading,
    settings,
    setSettings,
    mode,
    setMode,
    timeLeft,
    isRunning,
    completedSessions,
    todaySessions,
    toast,
    setToast,
    xpGained,
    toggleTimer,
    resetTimer,
    skipToNextMode,
    formatTime,
    getModeColor,
    progressPercent,
    getExpectedXP,
  } = usePomodoroContext()

  const [showSettings, setShowSettings] = useState(false)

  // === Computed Values ===
  const modeBgColor = useMemo(() => {
    switch (mode) {
      case 'work':
        return 'bg-red-50'
      case 'shortBreak':
        return 'bg-green-50'
      case 'longBreak':
        return 'bg-blue-50'
    }
  }, [mode])

  const modeLabelJa = useMemo(() => {
    switch (mode) {
      case 'work':
        return '集中タイム'
      case 'shortBreak':
        return '短い休憩'
      case 'longBreak':
        return '長い休憩'
    }
  }, [mode])

  const progressToLongBreak = useMemo(() => {
    const current = completedSessions % settings.sessionsUntilLongBreak
    return (current / settings.sessionsUntilLongBreak) * 100
  }, [completedSessions, settings.sessionsUntilLongBreak])

  // === Handlers ===
  const handleSettingChange = (key: keyof TimerSettings, value: number | boolean) => {
    setSettings({ ...settings, [key]: value })
  }

  const handleNumericInputChange = (key: keyof TimerSettings, inputValue: string, min: number, max: number) => {
    const value = parseInt(inputValue, 10)
    if (!isNaN(value)) {
      const clampedValue = Math.max(min, Math.min(max, value))
      setSettings({ ...settings, [key]: clampedValue })
    }
  }

  // === Loading State ===
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex items-center gap-3 text-gray-500">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span>読み込み中...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Toast Notification */}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* XP Gained Animation */}
      {xpGained !== null && (
        <div className="fixed top-1/3 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 animate-bounce">
          <div className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white px-8 py-4 rounded-2xl shadow-2xl flex items-center gap-3">
            <Sparkles className="w-8 h-8" />
            <span className="text-3xl font-bold">+{xpGained} XP</span>
          </div>
        </div>
      )}

      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">ポモドーロタイマー</h1>
        <p className="text-gray-600 mt-1 font-medium text-sm sm:text-base">集中して学習しましょう！</p>
      </div>

      {/* Mode Selector */}
      <div className="bg-white rounded-2xl p-2 shadow-sm">
        <div className="flex gap-2">
          {MODE_ITEMS.map((item) => (
            <button
              key={item.mode}
              onClick={() => !isRunning && setMode(item.mode)}
              disabled={isRunning}
              className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-semibold transition-all ${
                mode === item.mode
                  ? `bg-gradient-to-r ${getModeColor()} text-white shadow-lg`
                  : 'text-gray-600 hover:bg-gray-100'
              } ${isRunning ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <item.icon className="w-4 h-4" />
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Timer Display */}
      <div className={`${modeBgColor} rounded-3xl p-8 shadow-sm relative overflow-hidden`}>
        <div className="relative w-64 h-64 mx-auto">
          <svg className="w-full h-full transform -rotate-90">
            <circle
              cx="128"
              cy="128"
              r="120"
              stroke="currentColor"
              strokeWidth="8"
              fill="none"
              className="text-gray-200"
            />
            <circle
              cx="128"
              cy="128"
              r="120"
              stroke="url(#gradient)"
              strokeWidth="8"
              fill="none"
              strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 120}
              strokeDashoffset={2 * Math.PI * 120 * (1 - progressPercent() / 100)}
              className="transition-all duration-1000"
            />
            <defs>
              <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop
                  offset="0%"
                  stopColor={mode === 'work' ? '#ef4444' : mode === 'shortBreak' ? '#22c55e' : '#3b82f6'}
                />
                <stop
                  offset="100%"
                  stopColor={mode === 'work' ? '#f97316' : mode === 'shortBreak' ? '#14b8a6' : '#8b5cf6'}
                />
              </linearGradient>
            </defs>
          </svg>

          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-6xl font-bold text-gray-800 font-mono">{formatTime(timeLeft)}</span>
            <span className="text-gray-500 mt-2 font-medium">{modeLabelJa}</span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex justify-center gap-4 mt-8">
          <button
            onClick={resetTimer}
            className="p-4 rounded-2xl bg-white shadow-md hover:shadow-lg transition-all text-gray-600 hover:text-gray-800"
            title="リセット"
          >
            <RotateCcw className="w-6 h-6" />
          </button>
          <button
            onClick={toggleTimer}
            className={`px-8 py-4 rounded-2xl bg-gradient-to-r ${getModeColor()} text-white shadow-lg hover:shadow-xl transition-all flex items-center gap-3 font-semibold`}
          >
            {isRunning ? (
              <>
                <Pause className="w-6 h-6" />
                <span>一時停止</span>
              </>
            ) : (
              <>
                <Play className="w-6 h-6" />
                <span>スタート</span>
              </>
            )}
          </button>
          <button
            onClick={skipToNextMode}
            className="p-4 rounded-2xl bg-white shadow-md hover:shadow-lg transition-all text-gray-600 hover:text-gray-800"
            title="スキップ"
          >
            <SkipForward className="w-6 h-6" />
          </button>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-4 rounded-2xl bg-white shadow-md hover:shadow-lg transition-all text-gray-600 hover:text-gray-800"
            title="設定"
          >
            <Settings className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* XP Info - Work Mode Only */}
      {mode === 'work' && (
        <div className="bg-white rounded-2xl p-6 shadow-sm">
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-4">
            <p className="text-blue-800 font-medium text-center">
              🎯 セッション完了時の獲得XP: <span className="font-bold text-lg">{getExpectedXP()} XP</span>
            </p>
            <p className="text-gray-500 text-sm text-center mt-1">
              ポモドーロセッション完了で自動的にXPが記録されます
            </p>
            <p className="text-orange-600 text-xs text-center mt-2 font-medium">
              スキップを押すと経過時間分を自動精算します
            </p>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                <Settings className="w-6 h-6 text-gray-500" />
                タイマー設定
              </h3>
              <button
                onClick={() => setShowSettings(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Settings Cards Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {SETTINGS_CARDS.map((card) => {
                const value = settings[card.key]
                const isActive =
                  (mode === 'work' && card.key === 'workDuration') ||
                  (mode === 'shortBreak' && card.key === 'shortBreakDuration') ||
                  (mode === 'longBreak' && card.key === 'longBreakDuration')

                return (
                  <div
                    key={String(card.key)}
                    className={`rounded-xl p-4 border-2 transition-all ${
                      isActive ? `${card.color.border} ${card.color.lightBg}` : 'border-gray-100 bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <div className={`w-8 h-8 ${card.color.bg} rounded-lg flex items-center justify-center`}>
                        <card.icon className={`w-4 h-4 ${card.color.text}`} />
                      </div>
                      <span className="text-sm font-semibold text-gray-700">{card.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={value}
                        onChange={(e) => handleNumericInputChange(card.key, e.target.value, card.min, card.max)}
                        disabled={isRunning}
                        min={card.min}
                        max={card.max}
                        className="w-full text-center text-2xl font-bold text-gray-800 bg-white border border-gray-200 rounded-lg py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                      <span className="text-sm text-gray-500 min-w-[2rem]">{card.unit}</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-1 text-center">
                      {card.min}〜{card.max}{card.unit}
                    </p>
                  </div>
                )
              })}
            </div>

            {/* Advanced Settings */}
            <div className="mb-6">
              <h4 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                <Settings className="w-4 h-4" />
                詳細設定
              </h4>
              <div className="space-y-3">
                {TOGGLE_SETTINGS.map((toggle) => (
                  <label
                    key={toggle.key}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <toggle.icon className={`w-5 h-5 ${toggle.color}`} />
                      <div>
                        <span className="font-medium text-gray-800">{toggle.label}</span>
                        <p className="text-xs text-gray-500">{toggle.description}</p>
                      </div>
                    </div>
                    <div className="relative">
                      <input
                        type="checkbox"
                        checked={settings[toggle.key]}
                        onChange={(e) => handleSettingChange(toggle.key, e.target.checked)}
                        disabled={isRunning}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-100 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 peer-disabled:opacity-50 peer-disabled:cursor-not-allowed"></div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Progress Indicator */}
            <div className="mb-6 p-4 bg-gray-50 rounded-xl">
              <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
                <span>長休憩までの進捗</span>
                <span className="font-medium">
                  {completedSessions % settings.sessionsUntilLongBreak} / {settings.sessionsUntilLongBreak} セッション
                </span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-purple-500 to-blue-500 rounded-full transition-all duration-300"
                  style={{ width: `${progressToLongBreak}%` }}
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setSettings(DEFAULT_TIMER_SETTINGS)}
                disabled={isRunning}
                className="px-6 py-2 text-blue-600 hover:text-blue-800 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                デフォルトに戻す
              </button>
              <button
                onClick={() => setShowSettings(false)}
                className="px-6 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:shadow-lg transition-all font-medium"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon={Flame}
          iconBg="bg-red-100"
          iconColor="text-red-600"
          value={todaySessions}
          label="今日のセッション"
        />
        <StatCard
          icon={CheckCircle2}
          iconBg="bg-orange-100"
          iconColor="text-orange-600"
          value={completedSessions}
          label="連続セッション"
        />
        <StatCard
          icon={Clock}
          iconBg="bg-blue-100"
          iconColor="text-blue-600"
          value={todaySessions * settings.workDuration}
          label="今日の学習（分）"
        />
        <StatCard
          icon={Sparkles}
          iconBg="bg-purple-100"
          iconColor="text-purple-600"
          value={status?.total_xp.toLocaleString() || '0'}
          label="累計XP"
        />
      </div>

      {/* Tips */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-2xl p-6">
        <h3 className="font-bold text-gray-800 mb-3">💡 ポモドーロテクニックのコツ</h3>
        <ul className="space-y-2 text-sm text-gray-600">
          <li>• 作業中は通知やSNSをオフにして集中しましょう</li>
          <li>• 休憩時間は必ず取りましょう。脳をリフレッシュすることが大切です</li>
          <li>• 4セッション完了後の長休憩では、軽いストレッチや水分補給を</li>
          <li>• 無理せず、自分のペースで続けることが重要です</li>
        </ul>
      </div>
    </div>
  )
}

// === Stat Card Component ===
interface StatCardProps {
  icon: typeof Flame
  iconBg: string
  iconColor: string
  value: number | string
  label: string
}

function StatCard({ icon: Icon, iconBg, iconColor, value, label }: StatCardProps) {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 ${iconBg} rounded-xl flex items-center justify-center`}>
          <Icon className={`w-5 h-5 ${iconColor}`} />
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-800">{value}</p>
          <p className="text-xs text-gray-600 font-medium">{label}</p>
        </div>
      </div>
    </div>
  )
}
