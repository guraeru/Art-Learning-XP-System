import { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode, useMemo } from 'react'
import { getStatus, getConstants, logTime } from '../services/api'
import type { UserStatus, Constants } from '../types'

// === Types ===
export type TimerMode = 'work' | 'shortBreak' | 'longBreak'

export const DEFAULT_TIMER_SETTINGS = {
  workDuration: 25,
  shortBreakDuration: 5,
  longBreakDuration: 15,
  sessionsUntilLongBreak: 4,
  autoStartBreaks: true,
  autoStartPomodoros: false,
  showNotifications: true,
  alwaysShowMiniWindow: false,
} as const

export interface TimerSettings {
  workDuration: number
  shortBreakDuration: number
  longBreakDuration: number
  sessionsUntilLongBreak: number
  autoStartBreaks: boolean
  autoStartPomodoros: boolean
  showNotifications: boolean
  alwaysShowMiniWindow: boolean
}

export interface Toast {
  message: string
  type: 'success' | 'error'
}

// === XP Calculator Utility ===
export function calculateExpectedXP(
  activityType: string,
  durationMinutes: number,
  xpRates: Record<string, number> | undefined
): number {
  if (!activityType || !xpRates) return 0
  const rate = xpRates[activityType] || 0
  return Math.floor(rate * durationMinutes)
}

// === Context Interface ===
interface PomodoroContextType {
  // Data State
  status: UserStatus | null
  constants: Constants | null
  isLoading: boolean
  
  // Timer Settings
  settings: TimerSettings
  setSettings: (settings: TimerSettings) => void
  
  // Timer State
  mode: TimerMode
  setMode: (mode: TimerMode) => void
  timeLeft: number
  isRunning: boolean
  
  // Session State
  completedSessions: number
  todaySessions: number
  
  // UI State
  showMiniWindow: boolean
  setShowMiniWindow: (show: boolean) => void
  toast: Toast | null
  setToast: (toast: Toast | null) => void
  xpGained: number | null
  
  // Actions
  toggleTimer: () => void
  resetTimer: () => void
  skipToNextMode: () => void
  
  // Utilities
  formatTime: (seconds: number) => string
  getModeColor: () => string
  progressPercent: () => number
  getExpectedXP: () => number
  getElapsedMinutes: () => number
  refreshStatus: () => void
}

const PomodoroContext = createContext<PomodoroContextType | null>(null)

export function usePomodoroContext() {
  const context = useContext(PomodoroContext)
  if (!context) {
    throw new Error('usePomodoroContext must be used within PomodoroProvider')
  }
  return context
}

// === Storage Keys ===
const STORAGE_KEYS = {
  SETTINGS: 'pomodoro_settings',
  TODAY_DATA: 'pomodoro_today',
} as const

// === Helper Functions ===
function loadFromStorage<T>(key: string, defaultValue: T): T {
  try {
    const saved = localStorage.getItem(key)
    return saved ? { ...defaultValue, ...JSON.parse(saved) } : defaultValue
  } catch {
    return defaultValue
  }
}

function getTodaysSessions(): { completedSessions: number; todaySessions: number } {
  const today = new Date().toDateString()
  const savedData = localStorage.getItem(STORAGE_KEYS.TODAY_DATA)
  if (savedData) {
    try {
      const parsed = JSON.parse(savedData)
      if (parsed.date === today) {
        return { completedSessions: 0, todaySessions: parsed.sessions }
      }
    } catch {
      // Reset if invalid
    }
  }
  return { completedSessions: 0, todaySessions: 0 }
}

function saveTodaysSessions(sessions: number): void {
  localStorage.setItem(
    STORAGE_KEYS.TODAY_DATA,
    JSON.stringify({ date: new Date().toDateString(), sessions })
  )
}

// === Provider Component ===
interface PomodoroProviderProps {
  children: ReactNode
}

export function PomodoroProvider({ children }: PomodoroProviderProps) {
  // === Data State ===
  const [status, setStatus] = useState<UserStatus | null>(null)
  const [constants, setConstants] = useState<Constants | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  
  // === Timer Settings ===
  const [settings, setSettingsInternal] = useState<TimerSettings>(() =>
    loadFromStorage(STORAGE_KEYS.SETTINGS, DEFAULT_TIMER_SETTINGS)
  )
  
  // === Timer State ===
  const [mode, setModeInternal] = useState<TimerMode>('work')
  const [timeLeft, setTimeLeft] = useState(settings.workDuration * 60)
  const [isRunning, setIsRunning] = useState(false)
  
  // === Session State ===
  const [completedSessions, setCompletedSessions] = useState(() => getTodaysSessions().completedSessions)
  const [todaySessions, setTodaySessions] = useState(() => getTodaysSessions().todaySessions)
  
  // === UI State ===
  const [showMiniWindow, setShowMiniWindowState] = useState<boolean>(() => !!(settings as any)?.alwaysShowMiniWindow)
  const [toast, setToast] = useState<Toast | null>(null)
  const [xpGained, setXpGained] = useState<number | null>(null)
  
  // === Wrapper for setShowMiniWindow that syncs with settings ===
  const setShowMiniWindow = useCallback((show: boolean) => {
    setShowMiniWindowState(show)
  }, [])
  
  // === Refs ===
  const intervalRef = useRef<number | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const startTimeRef = useRef<number | null>(null)
  const elapsedSecondsRef = useRef<number>(0)

  // === Initialize Data ===
  useEffect(() => {
    setIsLoading(true)
    Promise.all([getStatus(), getConstants()])
      .then(([statusRes, constantsRes]) => {
        setStatus(statusRes.data)
        setConstants(constantsRes.data)
      })
      .catch((err) => {
        console.error('Failed to load data:', err)
        setToast({ message: 'データ読み込みエラー', type: 'error' })
      })
      .finally(() => {
        setIsLoading(false)
      })

    // Create audio element
    audioRef.current = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdH2JkYuDd29zeH6Dgn53c3V6goWFgn1+gYWLjYuJhoSBfHVtaGRpa3N7hIuLiISBgIGFioqHgXx4c3N1d3t/g4aIiouLiouKiYiIiImJi4yMjIuKiIeFhISCf318fH5/goWHiYqLi4uLioqJiIiHhoaFhYWFhoaHiImKioqKiomIh4aEg4KBgICBgoOFh4iJioqKioqJiIeGhYSCgoGAgYKEhYaHiImJiYmJiIiHhoWEg4KCgoKCg4SFhoeIiImJiIiIh4aGhYSDg4KCgoODhIWGh4eIiIiIiIeHhoaFhISEg4ODg4SFhYaGh4eHh4eHh4aGhoWFhYWEhISEhYWFhYaGhoaGhoaGhoaGhoaFhYWFhYWFhQA=')
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [])

  // === Persist Settings ===
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings))
  }, [settings])

  // === Sync showMiniWindow with alwaysShowMiniWindow setting ===
  useEffect(() => {
    if (settings.alwaysShowMiniWindow) {
      setShowMiniWindowState(true)
    }
  }, [settings.alwaysShowMiniWindow])

  // === Update Duration when Mode or Settings Change (not running) ===
  // Track the previous mode to detect mode changes
  const prevModeRef = useRef<TimerMode>('work')
  useEffect(() => {
    if (prevModeRef.current !== mode && !isRunning) {
      // Mode changed while not running - reset time for new mode
      const durations: Record<TimerMode, number> = {
        work: settings.workDuration * 60,
        shortBreak: settings.shortBreakDuration * 60,
        longBreak: settings.longBreakDuration * 60,
      }
      setTimeLeft(durations[mode])
    }
    prevModeRef.current = mode
  }, [mode, settings, isRunning])

  // === Play Sound ===
  const playNotificationSound = useCallback(() => {
    if (settings.showNotifications && audioRef.current) {
      audioRef.current.currentTime = 0
      audioRef.current.play().catch((err) => {
        console.debug('Could not play audio:', err)
      })
    }
  }, [settings.showNotifications])

  // === Log Completed Session to API (自動XP登録) ===
  const logCompletedSession = useCallback(async (sessionDuration: number): Promise<number> => {
    try {
      const res = await logTime({
        activity_type: 'ポモドーロ',
        duration: sessionDuration,
        description: `ポモドーロセッション (${sessionDuration}分)`,
      })
      
      if (res.data.success) {
        // Refresh status to get updated XP
        const statusRes = await getStatus()
        setStatus(statusRes.data)
        return res.data.xp_gained || 0
      }
    } catch (err) {
      console.error('Failed to log time:', err)
      setToast({ message: 'XP記録に失敗しました', type: 'error' })
    }
    return 0
  }, [])

  // === Handle Session Complete ===
  const handleTimerComplete = useCallback(async () => {
    setIsRunning(false)
    playNotificationSound()

    if (mode === 'work') {
      const newCompletedSessions = completedSessions + 1
      const newTodaySessions = todaySessions + 1

      setCompletedSessions(newCompletedSessions)
      setTodaySessions(newTodaySessions)
      saveTodaysSessions(newTodaySessions)

      // Log time and get XP
      const earnedXP = await logCompletedSession(settings.workDuration)
      
      if (earnedXP > 0) {
        setXpGained(earnedXP)
        setToast({ message: `🎉 セッション完了！ +${earnedXP} XP`, type: 'success' })
        setTimeout(() => setXpGained(null), 3000)
      }

      // Determine next mode
      const isLongBreak = newCompletedSessions % settings.sessionsUntilLongBreak === 0
      const nextMode = isLongBreak ? 'longBreak' : 'shortBreak'
      
      setTimeout(() => {
        setModeInternal(nextMode)
        setToast({
          message: isLongBreak
            ? '🌟 長休憩の時間です！お疲れ様でした'
            : '☕ 短い休憩を取りましょう',
          type: 'success',
        })
        // Auto start breaks if enabled
        if (settings.autoStartBreaks) {
          setTimeout(() => setIsRunning(true), 1500)
        }
      }, 1000)
    } else {
      // Break finished, back to work
      setModeInternal('work')
      setToast({ message: '💪 さあ、次のセッションを始めましょう！', type: 'success' })
      // Auto start next pomodoro if enabled
      if (settings.autoStartPomodoros) {
        setTimeout(() => setIsRunning(true), 1500)
      }
    }
  }, [mode, completedSessions, todaySessions, settings, logCompletedSession, playNotificationSound])

  // === Timer Loop ===
  useEffect(() => {
    if (isRunning) {
      startTimeRef.current = Date.now()
      intervalRef.current = window.setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            handleTimerComplete()
            return 0
          }
          // 経過時間を更新
          elapsedSecondsRef.current += 1
          return prev - 1
        })
      }, 1000)
    } else {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [isRunning, handleTimerComplete])

  // === Show Mini Window when Timer Running ===
  useEffect(() => {
    if (isRunning && !showMiniWindow) {
      setShowMiniWindow(true)
    }
  }, [isRunning, showMiniWindow])

  // === Sync Mini Window with "alwaysShowMiniWindow" setting ===
  useEffect(() => {
    if ((settings as any).alwaysShowMiniWindow) {
      setShowMiniWindow(true)
    }
  }, [settings.alwaysShowMiniWindow])

  // === Actions ===
  const toggleTimer = useCallback(() => {
    setIsRunning(prev => !prev)
  }, [])

  const resetTimer = useCallback(() => {
    setIsRunning(false)
    elapsedSecondsRef.current = 0
    const durations: Record<TimerMode, number> = {
      work: settings.workDuration * 60,
      shortBreak: settings.shortBreakDuration * 60,
      longBreak: settings.longBreakDuration * 60,
    }
    setTimeLeft(durations[mode])
  }, [settings, mode])

  const skipToNextMode = useCallback(async () => {
    setIsRunning(false)
    
    // 作業モードから拨ける時、経過時間分を自動精算
    if (mode === 'work' && elapsedSecondsRef.current > 0) {
      const elapsedMinutes = Math.floor(elapsedSecondsRef.current / 60)
      if (elapsedMinutes >= 1) {
        try {
          const earnedXP = await logCompletedSession(elapsedMinutes)
          if (earnedXP > 0) {
            setXpGained(earnedXP)
            setToast({ message: `💰 自動精算！${elapsedMinutes}分 → +${earnedXP} XP`, type: 'success' })
            setTimeout(() => setXpGained(null), 3000)
          }
        } catch (err) {
          console.error('Failed to settle session:', err)
        }
      }
      elapsedSecondsRef.current = 0
    }
    
    if (mode === 'work') {
      const nextMode = (completedSessions + 1) % settings.sessionsUntilLongBreak === 0
        ? 'longBreak'
        : 'shortBreak'
      setModeInternal(nextMode)
    } else {
      setModeInternal('work')
      elapsedSecondsRef.current = 0
    }
  }, [mode, completedSessions, settings.sessionsUntilLongBreak, logCompletedSession])

  const setMode = useCallback((newMode: TimerMode) => {
    if (!isRunning) {
      setModeInternal(newMode)
    }
  }, [isRunning])

  const setSettings = useCallback((newSettings: TimerSettings) => {
    setSettingsInternal(newSettings)
  }, [])

  const refreshStatus = useCallback(() => {
    getStatus()
      .then(r => setStatus(r.data))
      .catch(err => console.error('Failed to refresh status:', err))
  }, [])

  // === Utility Functions ===
  const formatTime = useCallback((seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }, [])

  const getModeColor = useCallback((): string => {
    switch (mode) {
      case 'work':
        return 'from-red-500 to-orange-500'
      case 'shortBreak':
        return 'from-green-500 to-teal-500'
      case 'longBreak':
        return 'from-blue-500 to-purple-500'
    }
  }, [mode])

  const progressPercent = useCallback((): number => {
    const totalTime: Record<TimerMode, number> = {
      work: settings.workDuration * 60,
      shortBreak: settings.shortBreakDuration * 60,
      longBreak: settings.longBreakDuration * 60,
    }
    const total = totalTime[mode]
    return total > 0 ? ((total - timeLeft) / total) * 100 : 0
  }, [mode, settings, timeLeft])

  const getExpectedXP = useCallback((): number => {
    // ポモドーロの固定XPレート (25 XP/分) で計算
    const pomodoroRate = constants?.xp_rates?.['ポモドーロ'] || 25
    return Math.floor(pomodoroRate * settings.workDuration)
  }, [settings.workDuration, constants?.xp_rates])

  const getElapsedMinutes = useCallback((): number => {
    return Math.floor(elapsedSecondsRef.current / 60)
  }, [])

  // === Context Value ===
  const value = useMemo<PomodoroContextType>(() => ({
    // Data
    status,
    constants,
    isLoading,
    // Settings
    settings,
    setSettings,
    // Timer
    mode,
    setMode,
    timeLeft,
    isRunning,
    // Sessions
    completedSessions,
    todaySessions,
    // UI
    showMiniWindow,
    setShowMiniWindow,
    toast,
    setToast,
    xpGained,
    // Actions
    toggleTimer,
    resetTimer,
    skipToNextMode,
    // Utilities
    formatTime,
    getModeColor,
    progressPercent,
    getExpectedXP,
    getElapsedMinutes,
    refreshStatus,
  }), [
    status, constants, isLoading,
    settings, setSettings,
    mode, setMode, timeLeft, isRunning,
    completedSessions, todaySessions,
    showMiniWindow, setShowMiniWindow, toast, xpGained,
    toggleTimer, resetTimer, skipToNextMode,
    formatTime, getModeColor, progressPercent, getExpectedXP, getElapsedMinutes, refreshStatus,
  ])

  return (
    <PomodoroContext.Provider value={value}>
      {children}
    </PomodoroContext.Provider>
  )
}
